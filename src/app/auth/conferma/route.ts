import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { afterLoginPath, safeNext, withNext } from "@/lib/next-path";

// Arrivo dal link dell'email di conferma (e da ogni link di Supabase con `?code=`).
// Supabase ha già confermato l'email; qui si apre la sessione così il tester entra
// subito, senza riscrivere la password. Il link porta a /login?code=…: la pagina di
// login lo gira qui (le pagine non possono scrivere i cookie, le route sì).
// Se il link è stato aperto in un altro browser (es. dentro l'app della posta) la
// sessione non si può aprire: l'email resta confermata e si chiede di accedere.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  const next = safeNext(params.get("next"));
  const supabase = await createClient();

  let userId: string | null = null;
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) console.warn("[auth] conferma con code:", error.code, error.message);
    userId = data?.user?.id ?? null;
  } else if (tokenHash && (type === "signup" || type === "email" || type === "magiclink")) {
    // Formato alternativo del modello email di Supabase ({{ .TokenHash }}): funziona in qualsiasi browser.
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) console.warn("[auth] conferma con token:", error.code, error.message);
    userId = data?.user?.id ?? null;
  }

  if (!userId) {
    redirect(withNext(`/login?message=${encodeURIComponent("Email confermata. Accedi con la tua email e password.")}`, next));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", userId)
    .single();
  redirect(afterLoginPath(next, Boolean(profile?.onboarding_completed)));
}
