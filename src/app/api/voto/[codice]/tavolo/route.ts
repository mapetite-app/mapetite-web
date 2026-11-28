import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { clientKey } from "@/lib/ai-limit";
import { CODICE_RE, VOTANTE_RE, romaAlle } from "@/lib/voto-gruppo";
import { VOTANTE_COOKIE, adessoPer, leggiVoto, permesso, segnaTavolo } from "@/lib/voto-gruppo-server";

// "Chi viene?" (proposta 94): a voto chiuso chi l'ha proposto dice per quando e per quanti ha prenotato
// il posto vincitore. Solo lui (account), solo a voto chiuso, ora entro 21 giorni dal voto. Nessuna
// chiamata a Google o all'AI.

const NO_STORE = { "Cache-Control": "private, no-store" };
type Ctx = { params: Promise<{ codice: string }> };

const MESSAGGI: Record<string, [number, string]> = {
  nessuno: [404, "Questo voto non esiste."],
  tuo: [403, "Solo chi ha proposto il voto può dire quando si va."],
  aperto: [409, "Si vota ancora: aspetta che il voto si chiuda."],
  posto: [400, "Questo posto non è nel voto."],
  quando: [400, "Scegli un giorno e un'ora nelle prossime tre settimane."],
  errore: [500, "Non sono riuscito a salvarlo. Riprova."],
};

export async function POST(request: Request, { params }: Ctx) {
  const { codice } = await params;
  if (!CODICE_RE.test(codice)) return NextResponse.json({ error: "Link non valido." }, { status: 404 });
  const body = (await request.json().catch(() => null)) as { posto?: unknown; giorno?: unknown; ora?: unknown; persone?: unknown } | null;
  const posto = typeof body?.posto === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(body.posto) ? body.posto : null;
  const alle = typeof body?.giorno === "string" && typeof body?.ora === "string" ? romaAlle(body.giorno, body.ora) : null;
  const persone = typeof body?.persone === "number" ? body.persone : NaN;
  if (!posto || !alle) return NextResponse.json({ error: MESSAGGI.quando[1] }, { status: 400 });

  const jar = await cookies();
  let utente: string | null = null;
  if (process.env.NODE_ENV === "development" && process.env.E2E_FAKE_USER) utente = jar.get("e2e_anonimo") ? null : process.env.E2E_FAKE_USER;
  else utente = (await (await createClient()).auth.getUser()).data?.user?.id ?? null;
  if (!utente) return NextResponse.json({ error: "Accedi per dire quando si va." }, { status: 401 });
  if (!permesso("vota", clientKey(request))) return NextResponse.json({ error: "Troppe modifiche da qui: riprova tra poco." }, { status: 429 });

  const adesso = adessoPer(jar.get("e2e_voto_ora")?.value);
  const esito = await segnaTavolo(codice, utente, posto, alle, persone, adesso);
  if (esito !== "ok") {
    const [status, error] = MESSAGGI[esito];
    return NextResponse.json({ error, esito }, { status });
  }
  const votante = jar.get(VOTANTE_COOKIE)?.value;
  const stato = await leggiVoto(codice, utente, votante && VOTANTE_RE.test(votante) ? votante : null, adesso);
  return NextResponse.json(stato && stato !== "errore" ? stato : { ok: true }, { headers: NO_STORE });
}
