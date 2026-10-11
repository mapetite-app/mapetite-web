import { login } from "@/lib/supabase/actions";
import AuthForm from "@/components/auth-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;
  return <AuthForm mode="login" action={login} error={params.error} message={params.message} />;
}
