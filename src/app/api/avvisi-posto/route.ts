import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// "Avvisami quando c'è posto" su un salvato (PROPOSTE.md 72; migrazione 20261121f_avvisi_posto.sql).
// GET ?id=<UUID locale> → { attivo }. POST { id, attivo } → accende o spegne l'avviso per quel locale.
// Solo la propria riga (RLS). L'avviso parte da /api/ristoratore/serate quando il titolare segna giorni nuovi.
// Nessuna chiamata Google o AI.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX = 50; // locali seguiti per persona
const NO_STORE = { headers: { "Cache-Control": "private, no-store" } };
// Solo in sviluppo con E2E_FAKE_USER: il giro scrive e rilegge dal cookie "e2e_avvisi_posto" (elenco di UUID).
const dev = () => process.env.NODE_ENV === "development" && !!process.env.E2E_FAKE_USER;

async function elencoDev(): Promise<string[]> {
  const raw = (await cookies()).get("e2e_avvisi_posto")?.value;
  try {
    const v = raw ? JSON.parse(decodeURIComponent(raw)) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && UUID_RE.test(x)) : [];
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!UUID_RE.test(id)) return NextResponse.json({ attivo: false }, NO_STORE);
  if (dev()) return NextResponse.json({ attivo: (await elencoDev()).includes(id) }, NO_STORE);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ attivo: false }, NO_STORE);
  const { data, error } = await supabase.from("avvisi_posto").select("place_id").eq("user_id", user.id).eq("place_id", id).maybeSingle();
  if (error) console.warn(`[avvisi-posto] lettura ${error.code ?? ""}`);
  return NextResponse.json({ attivo: !!data }, NO_STORE);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { id?: unknown; attivo?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!UUID_RE.test(id) || typeof body?.attivo !== "boolean") return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  const attivo = body.attivo;
  if (dev()) {
    const prima = await elencoDev();
    const dopo = attivo ? [...new Set([...prima, id])] : prima.filter((x) => x !== id);
    (await cookies()).set("e2e_avvisi_posto", encodeURIComponent(JSON.stringify(dopo)), { path: "/" });
    return NextResponse.json({ attivo });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Accedi per ricevere l'avviso." }, { status: 401 });
  if (!attivo) {
    const { error } = await supabase.from("avvisi_posto").delete().eq("user_id", user.id).eq("place_id", id);
    if (error) return NextResponse.json({ error: "Non sono riuscito a toglierlo. Riprova." }, { status: 500 });
    return NextResponse.json({ attivo: false });
  }
  const { count } = await supabase.from("avvisi_posto").select("place_id", { count: "exact", head: true }).eq("user_id", user.id);
  if ((count ?? 0) >= MAX) return NextResponse.json({ error: `Segui già ${MAX} locali: togline uno per aggiungere questo.` }, { status: 409 });
  // Solo locali verificati: per gli altri nessuno può dire "c'è posto", l'avviso non arriverebbe mai.
  const { data: locale } = await supabase.from("places").select("verified_at").eq("id", id).maybeSingle<{ verified_at: string | null }>();
  if (!locale?.verified_at) return NextResponse.json({ error: "Questo locale non dice ancora quando ha posto." }, { status: 409 });
  // ignoreDuplicates: già acceso resta com'è (avvisato_at non torna a null).
  const { error } = await supabase.from("avvisi_posto").upsert({ user_id: user.id, place_id: id }, { onConflict: "user_id,place_id", ignoreDuplicates: true });
  if (error) {
    console.warn(`[avvisi-posto] scrittura ${error.code ?? ""}`);
    return NextResponse.json({ error: "Non sono riuscito a salvarlo. Riprova." }, { status: 500 });
  }
  return NextResponse.json({ attivo: true });
}
