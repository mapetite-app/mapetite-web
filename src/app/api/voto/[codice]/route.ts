import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { clientKey } from "@/lib/ai-limit";
import { CODICE_RE, VOTANTE_RE, nomePulito } from "@/lib/voto-gruppo";
import { VOTANTE_COOKIE, adessoPer, leggiVoto, nuovoVotante, permesso, vota } from "@/lib/voto-gruppo-server";

// "Manda al gruppo" (proposta 56): stato del voto (GET, per aggiornare la pagina mentre gli altri votano)
// e voto con un tocco (POST), senza account. Un voto per telefono (cookie casuale, si può cambiare),
// al massimo 30 telefoni per sondaggio (controllo atomico nel database), limitatore per indirizzo IP.

const NO_STORE = { "Cache-Control": "private, no-store" };
type Ctx = { params: Promise<{ codice: string }> };

async function viewer(): Promise<string | null> {
  if (process.env.NODE_ENV === "development" && process.env.E2E_FAKE_USER) {
    return (await cookies()).get("e2e_anonimo") ? null : process.env.E2E_FAKE_USER;
  }
  const { data } = await (await createClient()).auth.getUser();
  return data?.user?.id ?? null;
}

export async function GET(_request: Request, { params }: Ctx) {
  const { codice } = await params;
  if (!CODICE_RE.test(codice)) return NextResponse.json({ error: "Link non valido." }, { status: 404, headers: NO_STORE });
  const jar = await cookies();
  const votante = jar.get(VOTANTE_COOKIE)?.value ?? null;
  const stato = await leggiVoto(codice, await viewer(), votante && VOTANTE_RE.test(votante) ? votante : null, adessoPer(jar.get("e2e_voto_ora")?.value));
  if (stato === "errore") return NextResponse.json({ error: "Non riesco a leggere il voto." }, { status: 500, headers: NO_STORE });
  if (!stato) return NextResponse.json({ error: "Questo voto non esiste." }, { status: 404, headers: NO_STORE });
  return NextResponse.json(stato, { headers: NO_STORE });
}

const MESSAGGI: Record<string, [number, string]> = {
  nessuno: [404, "Questo voto non esiste."],
  chiuso: [409, "Il voto è chiuso."],
  posto: [400, "Questo posto non è nel voto."],
  pieno: [409, "Hanno già votato in 30: il voto è pieno."],
  errore: [500, "Non sono riuscito a salvare il voto. Riprova."],
};

export async function POST(request: Request, { params }: Ctx) {
  const { codice } = await params;
  if (!CODICE_RE.test(codice)) return NextResponse.json({ error: "Link non valido." }, { status: 404 });
  const body = (await request.json().catch(() => null)) as { nome?: unknown; posto?: unknown } | null;
  const nome = nomePulito(body?.nome);
  if (!nome) return NextResponse.json({ error: "Scrivi il tuo nome (fino a 30 lettere)." }, { status: 400 });
  const posto = typeof body?.posto === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(body.posto) ? body.posto : null;
  if (!posto) return NextResponse.json({ error: "Tocca un posto per votarlo." }, { status: 400 });
  if (!permesso("vota", clientKey(request))) return NextResponse.json({ error: "Troppi voti da qui: riprova tra poco." }, { status: 429 });

  const jar = await cookies();
  const letto = jar.get(VOTANTE_COOKIE)?.value;
  const votante = letto && VOTANTE_RE.test(letto) ? letto : nuovoVotante();
  const adesso = adessoPer(jar.get("e2e_voto_ora")?.value);
  const esito = await vota(codice, votante, nome, posto, adesso);
  if (esito !== "ok") {
    const [status, error] = MESSAGGI[esito];
    return NextResponse.json({ error, esito }, { status });
  }
  if (votante !== letto) jar.set(VOTANTE_COOKIE, votante, { maxAge: 60 * 60 * 24 * 90, sameSite: "lax", path: "/", httpOnly: true, secure: process.env.NODE_ENV === "production" });
  const stato = await leggiVoto(codice, await viewer(), votante, adesso);
  return NextResponse.json(stato && stato !== "errore" ? stato : { ok: true }, { headers: NO_STORE });
}
