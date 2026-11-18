import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// "Qualcosa non va?" (proposta 54): un tester segnala un difetto dal Profilo.
// Si salvano il testo, il percorso della pagina (senza query string: niente ricerche o nomi),
// il browser troncato e la larghezza dello schermo. Al massimo 10 segnalazioni per persona al giorno.
// Le righe le legge solo il server (/admin/numeri): RLS senza lettura per gli utenti.

const MIN = 5;
const MAX = 1000;
const LIMITE_GIORNO = 10;

// Solo il percorso: via query string e frammento, al massimo 200 caratteri.
function soloPercorso(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const p = v.split(/[?#]/)[0].trim();
  if (!p.startsWith("/")) return null;
  return p.slice(0, 200);
}

function larghezzaValida(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v > 0 && v <= 10_000 ? v : null;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { testo?: unknown; pagina?: unknown; larghezza?: unknown } | null;
  const testo = typeof body?.testo === "string" ? body.testo.trim() : "";
  if (testo.length < MIN || testo.length > MAX) {
    return NextResponse.json({ error: `Scrivi tra ${MIN} e ${MAX} caratteri.` }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // Giro automatico in sviluppo: utente finto, nessuna scrittura vera.
  if (!user && process.env.NODE_ENV === "development" && process.env.E2E_FAKE_USER) return NextResponse.json({ ok: true });
  if (!user) return NextResponse.json({ error: "Accedi per inviare una segnalazione." }, { status: 401 });

  // Anti-spam: si contano le ultime 24 ore con la chiave di servizio (gli utenti non leggono la tabella).
  const da = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: errConto } = await createAdminClient()
    .from("segnalazioni")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", da);
  if (errConto) {
    console.warn(`[segnalazioni] conteggio non riuscito ${errConto.code ?? ""}`);
    return NextResponse.json({ error: "Non sono riuscito a inviarla. Riprova tra poco." }, { status: 500 });
  }
  if ((count ?? 0) >= LIMITE_GIORNO) {
    return NextResponse.json({ error: "Hai già inviato 10 segnalazioni oggi. Riprova domani." }, { status: 429 });
  }

  const ua = request.headers.get("user-agent");
  const { error } = await supabase.from("segnalazioni").insert({
    user_id: user.id,
    testo,
    pagina: soloPercorso(body?.pagina),
    user_agent: ua ? ua.slice(0, 200) : null,
    larghezza: larghezzaValida(body?.larghezza),
  });
  if (error) {
    console.warn(`[segnalazioni] non salvata ${error.code ?? ""}`);
    return NextResponse.json({ error: "Non sono riuscito a inviarla. Riprova tra poco." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
