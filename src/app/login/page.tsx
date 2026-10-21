import { redirect } from "next/navigation";
import { login } from "@/lib/supabase/actions";
import AuthForm from "@/components/auth-form";
import { googleAttivo } from "@/lib/supabase/google";
import { safeNext, withNext } from "@/lib/next-path";

// Errori che arrivano da Supabase nell'indirizzo (link scaduto o già usato): in italiano.
const LINK_ERRORS = new Set(["access_denied", "otp_expired", "server_error", "unauthorized_client"]);

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; error_code?: string; message?: string; next?: string | string[]; code?: string }>;
}) {
  const params = await searchParams;
  // Dove tornare dopo l'accesso: solo percorsi interni, altrimenti si ignora.
  const next = safeNext(Array.isArray(params.next) ? params.next[0] : params.next);
  // Link dell'email di conferma (/login?code=…): si apre la sessione nella route apposita.
  if (typeof params.code === "string" && params.code) {
    redirect(withNext(`/auth/conferma?code=${encodeURIComponent(params.code)}`, next));
  }
  const linkError = (params.error && LINK_ERRORS.has(params.error)) || (params.error_code && LINK_ERRORS.has(params.error_code));
  const error = linkError
    ? "Il link non è più valido (scaduto o già usato). Accedi con email e password, oppure registrati di nuovo."
    : params.error;
  return <AuthForm mode="login" action={login} error={error} message={params.message} next={next} google={await googleAttivo()} />;
}
