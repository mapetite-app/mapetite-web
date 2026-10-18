import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { puoGestireLocale } from "@/lib/ristoratore-accesso";
import { pulisciGiorni } from "@/lib/serate";

// "Serate tranquille" (POSIZIONAMENTO.md, proposta 1; migrazione 20261018_serate_tranquille.sql).
// GET ?id=<UUID o Place ID Google> → { verificato, giorni, at } per la riga della scheda (pubblico,
// come places). POST { id: UUID, giorni: [0..6] } → li salva: solo admin o titolare verificato,
// e solo su un locale verificato. Nessuna chiamata a Google.

const NO_STORE = { headers: { "Cache-Control": "private, no-store" } };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VUOTO = { verificato: false, giorni: [] as number[], at: null as string | null };
type Riga = { verified_at: string | null; giorni_tranquilli?: number[] | null; giorni_tranquilli_at?: string | null };

// Solo in sviluppo con E2E_FAKE_USER: il giro scrive e rilegge dal cookie "e2e_serate".
const dev = () => process.env.NODE_ENV === "development" && !!process.env.E2E_FAKE_USER;

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!/^[A-Za-z0-9_-]{2,200}$/.test(id)) return NextResponse.json(VUOTO, NO_STORE);
  if (dev()) {
    const raw = (await cookies()).get("e2e_serate")?.value;
    try {
      const v = raw ? JSON.parse(decodeURIComponent(raw)) : null;
      return NextResponse.json(v && (v.id === id || v.gid === id) ? { verificato: !!v.verificato, giorni: pulisciGiorni(v.giorni), at: v.at ?? null } : VUOTO, NO_STORE);
    } catch {
      return NextResponse.json(VUOTO, NO_STORE);
    }
  }
  try {
    const supabase = await createClient();
    const col = UUID_RE.test(id) ? "id" : "google_place_id";
    let { data, error } = await supabase.from("places").select("verified_at, giorni_tranquilli, giorni_tranquilli_at").eq(col, id).limit(1).maybeSingle<Riga>();
    // 42703 = colonna assente (migrazioni non applicate): nessuna riga, la scheda non cambia.
    if (error?.code === "42703") ({ data, error } = { data: null, error: null });
    if (error) console.error("[serate] lettura:", error.message);
    if (!data?.verified_at) return NextResponse.json(VUOTO, NO_STORE);
    return NextResponse.json({ verificato: true, giorni: pulisciGiorni(data.giorni_tranquilli), at: data.giorni_tranquilli_at ?? null }, NO_STORE);
  } catch (err) {
    console.error("[serate] lettura fallita:", err instanceof Error ? err.message : err);
    return NextResponse.json(VUOTO, NO_STORE);
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!UUID_RE.test(id) || !Array.isArray(body?.giorni)) return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  const giorni = pulisciGiorni(body.giorni);
  const at = new Date().toISOString();

  if (dev()) {
    const jar = await cookies();
    const raw = jar.get("e2e_serate")?.value;
    let prev: Record<string, unknown> = {};
    try { prev = raw ? JSON.parse(decodeURIComponent(raw)) : {}; } catch { /* cookie rovinato */ }
    if (prev.id !== id) return NextResponse.json({ error: "Non puoi modificare questo locale" }, { status: 403 });
    jar.set("e2e_serate", encodeURIComponent(JSON.stringify({ ...prev, giorni, at })), { path: "/" });
    return NextResponse.json({ giorni, at });
  }

  if (!(await puoGestireLocale(id))) return NextResponse.json({ error: "Non puoi modificare questo locale" }, { status: 403 });
  const db = createAdminClient();
  const { data, error } = await db
    .from("places")
    .update({ giorni_tranquilli: giorni.length ? giorni : null, giorni_tranquilli_at: giorni.length ? at : null })
    .eq("id", id)
    .not("verified_at", "is", null)
    .select("id");
  if (error) {
    console.error("[serate] scrittura:", error.code, error.message);
    return NextResponse.json({ error: "Non sono riuscito a salvare. Riprova tra poco." }, { status: 500 });
  }
  if (!data?.length) return NextResponse.json({ error: "Prima serve la verifica del locale." }, { status: 409 });
  return NextResponse.json({ giorni, at: giorni.length ? at : null });
}
