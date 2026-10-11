"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  const { data: auth, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("[auth] login:", error.code, error.message);
    redirect(`/login?error=${encodeURIComponent(authErrorIt(error))}`);
  }

  // Dopo l'accesso si torna alla mappa (è lì che si usa l'app); solo chi non ha
  // ancora indicato i suoi gusti passa dall'onboarding. Le preferenze restano in /me.
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", auth.user!.id)
    .single();

  revalidatePath("/", "layout");
  redirect(profile?.onboarding_completed ? "/mappa" : "/onboarding");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mapetite-web.vercel.app";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${siteUrl}/login` },
  });

  if (error) {
    console.error("[auth] signup:", error.code, error.message);
    redirect(`/signup?error=${encodeURIComponent(authErrorIt(error))}`);
  }

  if (data.session) {
    // La conferma email è disabilitata sul progetto Supabase:
    // l'utente ha già una sessione attiva.
    revalidatePath("/", "layout");
    redirect("/me");
  }

  redirect(
    `/login?message=${encodeURIComponent(
      "Registrazione effettuata. Controlla la tua email per confermare l'account."
    )}`
  );
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/login");
}
