"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { afterLoginPath, safeNext, withNext } from "@/lib/next-path";

// Messaggi di Supabase Auth in italiano semplice (arrivano in inglese).
function authErrorIt(error: { code?: string; message: string }): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Email o password non corrette.";
    case "email_not_confirmed":
      return "Conferma prima la tua email: trovi il link nella posta in arrivo.";
    case "user_already_exists":
    case "email_exists":
      return "Esiste già un account con questa email: prova ad accedere.";
    case "weak_password":
      return "Password troppo debole: usa almeno 6 caratteri.";
    case "email_address_invalid":
      return "Questa email non sembra valida.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Troppi tentativi ravvicinati: riprova tra qualche minuto.";
    default:
      return "Non è andata a buon fine. Riprova tra poco.";
  }
}

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  // Dove tornare dopo l'accesso (link condiviso, Stasera, Importa…): solo percorsi interni.
  const next = safeNext(formData.get("next"));

  const { data: auth, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("[auth] login:", error.code, error.message);
    redirect(withNext(`/login?error=${encodeURIComponent(authErrorIt(error))}`, next));
  }

  // Dopo l'accesso si torna dov'eri (`next`) oppure alla mappa (è lì che si usa l'app);
  // solo chi non ha ancora indicato i suoi gusti passa prima dall'onboarding, che poi
  // prosegue verso `next`. Le preferenze restano in /me.
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", auth.user!.id)
    .single();

  revalidatePath("/", "layout");
  redirect(afterLoginPath(next, Boolean(profile?.onboarding_completed)));
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const next = safeNext(formData.get("next"));

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mapetite-web.vercel.app";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // Il link di conferma via email riporta al login con lo stesso `next`.
    options: { emailRedirectTo: `${siteUrl}${withNext("/login", next)}` },
  });

  if (error) {
    console.error("[auth] signup:", error.code, error.message);
    redirect(withNext(`/signup?error=${encodeURIComponent(authErrorIt(error))}`, next));
  }

  if (data.session) {
    // La conferma email è disabilitata sul progetto Supabase:
    // l'utente ha già una sessione attiva. Con `next` passa dall'onboarding e poi torna lì;
    // senza, resta il comportamento di sempre (/me).
    revalidatePath("/", "layout");
    redirect(next ? withNext("/onboarding", next) : "/me");
  }

  redirect(
    withNext(
      `/login?message=${encodeURIComponent(
        "Registrazione effettuata. Controlla la tua email per confermare l'account."
      )}`,
      next
    )
  );
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/login");
}
