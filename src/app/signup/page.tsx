import { signup } from "@/lib/supabase/actions";
import AuthForm from "@/components/auth-form";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return <AuthForm mode="signup" action={signup} error={params.error} />;
}
