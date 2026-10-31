import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pulisciPrenotazione, type PrenotazioneAccount } from "@/lib/prenotazioni-account";

// Prenotazioni sull'account ("Cliente di parola", passo 2, PROPOSTE.md 3). Solo con il consenso
// esplicito della persona (tabella prenotazioni_consenso; la RLS rifiuta le scritture senza).
//  GET    → { utente, consenso, prenotazioni, tolte }   (401 senza accesso)
//  PUT    → "Attiva": accende il consenso e carica quelle del telefono { prenotazioni }
//  POST   → salva o aggiorna { prenotazioni: [...] , utente } (solo con consenso, mai lo accende)
//  DELETE → { id, utente } la toglie lasciando una lapide (un altro telefono non la ricarica);
//           { tutte: true } "Spegni": prima toglie il consenso, poi cancella tutti i dati (restano
//           solo le lapidi, un codice senza dati).
// `utente` è l'account a cui il telefono le ha legate: se è cambiato, nessuna scrittura (409).

const MAX = 30;
const MAX_RIGHE = 300;        // tetto di prenotazioni vive per persona (le lapidi non contano)
const MAX_CORPO = 64_000;     // byte

// Giro automatico in sviluppo: utente finto, nessuna scrittura vera (memoria del processo).
type Dev = { id: string; consenso: boolean; list: Map<string, PrenotazioneAccount>; tolte: Set<string> };
const devStore = new Map<string, Dev>();
async function utente() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const fake = process.env.NODE_ENV === "development" && process.env.E2E_FAKE_USER ? process.env.E2E_FAKE_USER : null;
  const dev = !user && fake ? fake : null;
  if (dev && !devStore.has(dev)) devStore.set(dev, { id: dev, consenso: false, list: new Map(), tolte: new Set() });
  return { supabase, userId: user?.id ?? null, dev: dev ? devStore.get(dev)! : null };
}

async function corpo(request: Request): Promise<Record<string, unknown> | null> {
  const len = Number(request.headers.get("content-length") ?? "0");
  if (len > MAX_CORPO) return null;
  const text = await request.text().catch(() => "");
  if (text.length > MAX_CORPO) return null;
  try {
    const j = JSON.parse(text || "null");
    return j && typeof j === "object" ? (j as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
function lista(v: unknown): PrenotazioneAccount[] | null {
  if (!Array.isArray(v) || v.length > MAX) return null;
  return v.map(pulisciPrenotazione).filter((p): p is PrenotazioneAccount => p !== null);
}
function riga(userId: string, p: PrenotazioneAccount) {
  // Niente cancellata_at qui: un upsert su una lapide la lascia lapide.
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

type Sb = Awaited<ReturnType<typeof createClient>>;
async function stato(supabase: Sb, userId: string) {
  const { data: c } = await supabase.from("prenotazioni_consenso").select("user_id").eq("user_id", userId).maybeSingle();
  if (!c) {
    // Consenso spento ma righe rimaste (uno "Spegni" a metà, o una scrittura arrivata insieme): si
    // cancellano adesso. Le lapidi restano (solo un codice, nessun dato).
    await supabase.from("prenotazioni").delete().eq("user_id", userId).is("cancellata_at", null);
    return { utente: userId, consenso: false, prenotazioni: [], tolte: [] };
  }
  const [vive, lapidi] = await Promise.all([
    supabase.from("prenotazioni").select("dati").eq("user_id", userId).is("cancellata_at", null).order("created_at", { ascending: false }).limit(MAX),
    supabase.from("prenotazioni").select("id").eq("user_id", userId).not("cancellata_at", "is", null).order("cancellata_at", { ascending: false }).limit(200),
  ]);
  if (vive.error || lapidi.error) return null;
  const prenotazioni = (vive.data ?? []).map((r) => pulisciPrenotazione(r.dati)).filter((p): p is PrenotazioneAccount => p !== null);
  return { utente: userId, consenso: true, prenotazioni, tolte: (lapidi.data ?? []).map((r) => r.id as string) };
}
async function salva(supabase: Sb, userId: string, list: PrenotazioneAccount[]): Promise<number> {
  if (list.length === 0) return 200;
  // Le lapidi non si riempiono di nuovo: le prenotazioni già tolte si saltano.
  const { data: gia, error: ge } = await supabase.from("prenotazioni").select("id, cancellata_at").eq("user_id", userId).in("id", list.map((p) => p.id));
  if (ge) return 500;
  const lapidi = new Set((gia ?? []).filter((r) => r.cancellata_at).map((r) => r.id as string));
  const esistenti = new Set((gia ?? []).map((r) => r.id as string));
  const vive = list.filter((p) => !lapidi.has(p.id));
  if (vive.length === 0) return 200;
  const nuove = vive.filter((p) => !esistenti.has(p.id)).length;
  if (nuove > 0) {
    const { count } = await supabase.from("prenotazioni").select("id", { count: "exact", head: true }).eq("user_id", userId).is("cancellata_at", null);
    if ((count ?? 0) + nuove > MAX_RIGHE) return 409;
  }
  const { error } = await supabase.from("prenotazioni").upsert(vive.map((p) => riga(userId, p)), { onConflict: "user_id,id" });
  if (!error) return 200;
  console.warn(`[prenotazioni] salvataggio non riuscito ${error.code ?? ""}`);
  return error.code === "42501" ? 403 : 500; // 42501: RLS, consenso spento
}
function devStato(d: Dev) {
  return { utente: d.id, consenso: d.consenso, prenotazioni: d.consenso ? [...d.list.values()] : [], tolte: d.consenso ? [...d.tolte] : [] };
}

export async function GET() {
  const { supabase, userId, dev } = await utente();
  if (dev) return NextResponse.json(devStato(dev));
  if (!userId) return NextResponse.json({ error: "Accedi." }, { status: 401 });
  const s = await stato(supabase, userId);
  return s ? NextResponse.json(s) : NextResponse.json({ error: "Non riesco a leggere le prenotazioni." }, { status: 500 });
}

export async function PUT(request: Request) {
  const body = await corpo(request);
  const list = lista(body?.prenotazioni ?? []);
  if (!list) return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  const { supabase, userId, dev } = await utente();
  if (dev) {
    dev.consenso = true;
    for (const p of list) if (!dev.tolte.has(p.id)) dev.list.set(p.id, p);
    return NextResponse.json({ ok: true, ...devStato(dev) });
  }
  if (!userId) return NextResponse.json({ error: "Accedi per tenerle sul tuo account." }, { status: 401 });
  const { error: ce } = await supabase.from("prenotazioni_consenso").upsert({ user_id: userId }, { onConflict: "user_id" });
  if (ce) {
    console.warn(`[prenotazioni] consenso non salvato ${ce.code ?? ""}`);
    return NextResponse.json({ error: "Non sono riuscito a salvare la scelta." }, { status: 500 });
  }
  const st = await salva(supabase, userId, list);
  if (st !== 200) return NextResponse.json({ error: "Non sono riuscito a caricarle." }, { status: st });
  const s = await stato(supabase, userId);
  return NextResponse.json({ ok: true, ...(s ?? { utente: userId, consenso: true, prenotazioni: [], tolte: [] }) });
}

export async function POST(request: Request) {
  const body = await corpo(request);
  const list = lista(body?.prenotazioni);
  const per = typeof body?.utente === "string" ? body.utente : null;
  if (!list || !per) return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  const { supabase, userId, dev } = await utente();
  if (dev) {
    if (per !== dev.id) return NextResponse.json({ error: "Account diverso." }, { status: 409 });
    if (!dev.consenso) return NextResponse.json({ error: "Consenso spento." }, { status: 403 });
    for (const p of list) if (!dev.tolte.has(p.id)) dev.list.set(p.id, p);
    return NextResponse.json({ ok: true });
  }
  if (!userId) return NextResponse.json({ error: "Accedi." }, { status: 401 });
  if (per !== userId) return NextResponse.json({ error: "Account diverso." }, { status: 409 });
  const st = await salva(supabase, userId, list);
  return st === 200 ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Non salvate sull'account." }, { status: st });
}

export async function DELETE(request: Request) {
  const body = await corpo(request);
  const id = typeof body?.id === "string" && body.id.length >= 4 && body.id.length <= 40 ? body.id : null;
  const per = typeof body?.utente === "string" ? body.utente : null;
  const tutte = body?.tutte === true;
  if (!tutte && (!id || !per)) return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  const { supabase, userId, dev } = await utente();
  if (dev) {
    if (tutte) { dev.consenso = false; dev.list.clear(); return NextResponse.json({ ok: true }); }
    if (per !== dev.id) return NextResponse.json({ error: "Account diverso." }, { status: 409 });
    if (dev.consenso) { dev.list.delete(id!); dev.tolte.add(id!); }
    return NextResponse.json({ ok: true });
  }
  if (!userId) return NextResponse.json({ error: "Accedi." }, { status: 401 });
  if (tutte) {
    // Prima il consenso: da quel momento la RLS rifiuta ogni scrittura in arrivo.
    const { error: ce } = await supabase.from("prenotazioni_consenso").delete().eq("user_id", userId);
    if (ce) return NextResponse.json({ error: "Non sono riuscito a spegnere." }, { status: 500 });
    // Le lapidi restano (solo il codice della prenotazione tolta, nessun dato): se si riaccende, un
    // altro telefono non può ricaricare quelle già tolte. Se questo passo fallisce, lo rifà la GET dopo.
    const { error } = await supabase.from("prenotazioni").delete().eq("user_id", userId).is("cancellata_at", null);
    if (error) return NextResponse.json({ error: "Non sono riuscito a toglierle." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (per !== userId) return NextResponse.json({ error: "Account diverso." }, { status: 409 });
  // Lapide: si tengono solo id e locale, i dati si svuotano. Se non c'era, si crea (un altro telefono
  // potrebbe ancora averla e ricaricarla). Senza consenso la RLS rifiuta: niente da togliere.
  const { error } = await supabase.from("prenotazioni").upsert(
    { user_id: userId, id: id!, place_id: "-", giorno: null, esito: null, disdetta_at: null, dati: {}, cancellata_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { onConflict: "user_id,id" },
  );
  if (error && error.code !== "42501") return NextResponse.json({ error: "Non tolta dall'account." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
