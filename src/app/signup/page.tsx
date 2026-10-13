import { signup } from "@/lib/supabase/actions";
import AuthForm from "@/components/auth-form";
import { safeNext } from "@/lib/next-path";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string | string[] }>;
}) {
  const params = await searchParams;
  // Dove tornare dopo la registrazione (e l'onboarding): solo percorsi interni.
  const next = safeNext(Array.isArray(params.next) ? params.next[0] : params.next);
  return <AuthForm mode="signup" action={signup} error={params.error} next={next} />;
}
