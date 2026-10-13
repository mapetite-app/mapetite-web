import { login } from "@/lib/supabase/actions";
import AuthForm from "@/components/auth-form";
import { safeNext } from "@/lib/next-path";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; next?: string | string[] }>;
}) {
  const params = await searchParams;
  // Dove tornare dopo l'accesso: solo percorsi interni, altrimenti si ignora.
  const next = safeNext(Array.isArray(params.next) ? params.next[0] : params.next);
  return <AuthForm mode="login" action={login} error={params.error} message={params.message} next={next} />;
}
