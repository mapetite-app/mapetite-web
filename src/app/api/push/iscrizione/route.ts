import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Iscrizione agli avvisi push di questo telefono (proposta 6): POST la salva, DELETE la toglie.
// Si scrive solo la propria riga (RLS su push_subscriptions). Nessun avviso parte da qui.

const MAX = 1000;
const str = (v: unknown, max: number) => (typeof v === "string" && v.length > 0 && v.length <= max ? v : null);

async function utente() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // Giro automatico in sviluppo: utente finto, nessuna scrittura vera.
  const dev = process.env.NODE_ENV === "development" && process.env.E2E_FAKE_USER ? process.env.E2E_FAKE_USER : null;
  return { supabase, userId: user?.id ?? null, dev: !user && dev ? dev : null };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null;
  const endpoint = str(body?.endpoint, MAX);
  const p256dh = str(body?.keys?.p256dh, 200);
  const auth = str(body?.keys?.auth, 100);
  if (!endpoint || !endpoint.startsWith("https://") || !p256dh || !auth) {
    return NextResponse.json({ error: "Iscrizione non valida." }, { status: 400 });
  }
  const { supabase, userId, dev } = await utente();
  if (dev) return NextResponse.json({ ok: true });
  if (!userId) return NextResponse.json({ error: "Accedi per ricevere gli avvisi." }, { status: 401 });
  const { error } = await supabase.from("push_subscriptions").upsert({ user_id: userId, endpoint, p256dh, auth }, { onConflict: "endpoint" });
  if (error) {
    console.warn(`[push] iscrizione non salvata ${error.code ?? ""}`);
    return NextResponse.json({ error: "Non sono riuscito a salvare l'iscrizione." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  const endpoint = str(body?.endpoint, MAX);
  if (!endpoint) return NextResponse.json({ error: "Iscrizione non valida." }, { status: 400 });
  const { supabase, userId, dev } = await utente();
  if (dev) return NextResponse.json({ ok: true });
  if (!userId) return NextResponse.json({ error: "Accedi." }, { status: 401 });
  await supabase.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", endpoint);
  return NextResponse.json({ ok: true });
}
