import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { clientKey } from "@/lib/ai-limit";
import { CODICE_RE, VOTANTE_RE, nomePulito } from "@/lib/voto-gruppo";
import { VOTANTE_COOKIE, adessoPer, leggiVoto, nuovoVotante, permesso, rispondi } from "@/lib/voto-gruppo-server";

// "Chi viene?" (proposta 94): "Ci sei? Sì / No" dal link del voto, senza account, basta il nome.
// Una risposta per telefono (lo stesso cookie del voto, si può cambiare), al massimo 30 telefoni,
// limitatore per indirizzo IP come il voto.

const NO_STORE = { "Cache-Control": "private, no-store" };
type Ctx = { params: Promise<{ codice: string }> };

const MESSAGGI: Record<string, [number, string]> = {
  nessuno: [404, "Questo voto non esiste."],
  senza: [409, "Il tavolo non è ancora prenotato."],
  passato: [409, "La cena è già passata."],
  pieno: [409, "Hanno già risposto in 30."],
  errore: [500, "Non sono riuscito a salvare la risposta. Riprova."],
};

async function viewer(): Promise<string | null> {
  if (process.env.NODE_ENV === "development" && process.env.E2E_FAKE_USER) {
    return (await cookies()).get("e2e_anonimo") ? null : process.env.E2E_FAKE_USER;
  }
  const { data } = await (await createClient()).auth.getUser();
  return data?.user?.id ?? null;
}

export async function POST(request: Request, { params }: Ctx) {
  const { codice } = await params;
  if (!CODICE_RE.test(codice)) return NextResponse.json({ error: "Link non valido." }, { status: 404 });
  const body = (await request.json().catch(() => null)) as { nome?: unknown; ciSono?: unknown } | null;
  const nome = nomePulito(body?.nome);
  if (!nome) return NextResponse.json({ error: "Scrivi il tuo nome (fino a 30 lettere)." }, { status: 400 });
  if (typeof body?.ciSono !== "boolean") return NextResponse.json({ error: "Rispondi Sì o No." }, { status: 400 });
  if (!permesso("vota", clientKey(request))) return NextResponse.json({ error: "Troppe risposte da qui: riprova tra poco." }, { status: 429 });

  const jar = await cookies();
  const letto = jar.get(VOTANTE_COOKIE)?.value;
  const votante = letto && VOTANTE_RE.test(letto) ? letto : nuovoVotante();
  const adesso = adessoPer(jar.get("e2e_voto_ora")?.value);
  const esito = await rispondi(codice, votante, nome, body.ciSono, adesso);
  if (esito !== "ok") {
    const [status, error] = MESSAGGI[esito];
    return NextResponse.json({ error, esito }, { status });
  }
  if (votante !== letto) jar.set(VOTANTE_COOKIE, votante, { maxAge: 60 * 60 * 24 * 90, sameSite: "lax", path: "/", httpOnly: true, secure: process.env.NODE_ENV === "production" });
  const stato = await leggiVoto(codice, await viewer(), votante, adesso);
  return NextResponse.json(stato && stato !== "errore" ? stato : { ok: true }, { headers: NO_STORE });
}
