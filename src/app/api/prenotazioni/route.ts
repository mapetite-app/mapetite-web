import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pulisciPrenotazione, type PrenotazioneAccount } from "@/lib/prenotazioni-account";

// Prenotazioni sull'account ("Cliente di parola", passo 2, PROPOSTE.md 3). Solo con il consenso
// esplicito della persona (tabella prenotazioni_consenso, RLS: ognuno la propria riga).
//  GET    → { consenso, prenotazioni }        (401 senza accesso)
//  PUT    → accende il consenso e carica quelle del telefono { prenotazioni }
//  POST   → salva o aggiorna una prenotazione { prenotazione } (solo con consenso)
//  DELETE → { id } ne toglie una; { tutte: true } spegne: cancella tutto e toglie il consenso.

const MAX = 30;

// Giro automatico in sviluppo: utente finto, nessuna scrittura vera (memoria del processo).
const devStore = new Map<string, { consenso: boolean; list: Map<string, PrenotazioneAccount> }>();
async function utente() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const fake = process.env.NODE_ENV === "development" && process.env.E2E_FAKE_USER ? process.env.E2E_FAKE_USER : null;
  const dev = !user && fake ? fake : null;
  if (dev && !devStore.has(dev)) devStore.set(dev, { consenso: false, list: new Map() });
  return { supabase, userId: user?.id ?? null, dev: dev ? devStore.get(dev)! : null };
}

function riga(userId: string, p: PrenotazioneAccount) {
  return {
    user_id: userId,
    id: p.id,
    place_id: p.placeId,
    giorno: p.date,
    esito: p.outcome ?? null,
    disdetta_at: p.disdetta != null ? new Date(p.disdetta).toISOString() : null,
    dati: p,
    updated_at: new Date().toISOString(),
  };
}

export async function GET() {
  const { supabase, userId, dev } = await utente();
  if (dev) return NextResponse.json({ consenso: dev.consenso, prenotazioni: [...dev.list.values()] });
  if (!userId) return NextResponse.json({ error: "Accedi." }, { status: 401 });
  const { data: c } = await supabase.from("prenotazioni_consenso").select("user_id").eq("user_id", userId).maybeSingle();
  if (!c) return NextResponse.json({ consenso: false, prenotazioni: [] });
  const { data, error } = await supabase.from("prenotazioni").select("dati").eq("user_id", userId).order("created_at", { ascending: false }).limit(MAX);
  if (error) return NextResponse.json({ error: "Non riesco a leggere le prenotazioni." }, { status: 500 });
  const prenotazioni = (data ?? []).map((r) => pulisciPrenotazione(r.dati)).filter((p): p is PrenotazioneAccount => p !== null);
  return NextResponse.json({ consenso: true, prenotazioni });
}

function lista(v: unknown): PrenotazioneAccount[] | null {
  if (!Array.isArray(v) || v.length > MAX) return null;
  return v.map(pulisciPrenotazione).filter((p): p is PrenotazioneAccount => p !== null);
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as { prenotazioni?: unknown } | null;
  const list = lista(body?.prenotazioni ?? []);
  if (!list) return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  const { supabase, userId, dev } = await utente();
  if (dev) {
    dev.consenso = true;
    for (const p of list) dev.list.set(p.id, p);
    return NextResponse.json({ ok: true, prenotazioni: [...dev.list.values()] });
  }
  if (!userId) return NextResponse.json({ error: "Accedi per tenerle sul tuo account." }, { status: 401 });
  const { error: ce } = await supabase.from("prenotazioni_consenso").upsert({ user_id: userId }, { onConflict: "user_id" });
  if (ce) {
    console.warn(`[prenotazioni] consenso non salvato ${ce.code ?? ""}`);
    return NextResponse.json({ error: "Non sono riuscito a salvare la scelta." }, { status: 500 });
  }
  if (list.length > 0) {
    const { error } = await supabase.from("prenotazioni").upsert(list.map((p) => riga(userId, p)), { onConflict: "user_id,id" });
    if (error) console.warn(`[prenotazioni] caricamento non riuscito ${error.code ?? ""}`);
  }
  const { data } = await supabase.from("prenotazioni").select("dati").eq("user_id", userId).order("created_at", { ascending: false }).limit(MAX);
  const prenotazioni = (data ?? []).map((r) => pulisciPrenotazione(r.dati)).filter((p): p is PrenotazioneAccount => p !== null);
  return NextResponse.json({ ok: true, prenotazioni });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { prenotazione?: unknown } | null;
  const p = pulisciPrenotazione(body?.prenotazione);
  if (!p) return NextResponse.json({ error: "Prenotazione non valida." }, { status: 400 });
  const { supabase, userId, dev } = await utente();
  if (dev) {
    if (!dev.consenso) return NextResponse.json({ error: "Consenso spento." }, { status: 403 });
    dev.list.set(p.id, p);
    return NextResponse.json({ ok: true });
  }
  if (!userId) return NextResponse.json({ error: "Accedi." }, { status: 401 });
  // La policy RLS rifiuta la scrittura senza consenso: niente salvataggi "di nascosto".
  const { error } = await supabase.from("prenotazioni").upsert(riga(userId, p), { onConflict: "user_id,id" });
  if (error) return NextResponse.json({ error: "Non salvata sull'account." }, { status: error.code === "42501" ? 403 : 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => null)) as { id?: unknown; tutte?: unknown } | null;
  const id = typeof body?.id === "string" && body.id.length <= 40 ? body.id : null;
  const tutte = body?.tutte === true;
  if (!id && !tutte) return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  const { supabase, userId, dev } = await utente();
  if (dev) {
    if (tutte) { dev.consenso = false; dev.list.clear(); } else dev.list.delete(id!);
    return NextResponse.json({ ok: true });
  }
  if (!userId) return NextResponse.json({ error: "Accedi." }, { status: 401 });
  if (tutte) {
    const { error } = await supabase.from("prenotazioni").delete().eq("user_id", userId);
    if (error) return NextResponse.json({ error: "Non sono riuscito a toglierle." }, { status: 500 });
    await supabase.from("prenotazioni_consenso").delete().eq("user_id", userId);
  } else {
    await supabase.from("prenotazioni").delete().eq("user_id", userId).eq("id", id!);
  }
  return NextResponse.json({ ok: true });
}
