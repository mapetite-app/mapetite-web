import Link from "next/link";
import { signup } from "@/lib/supabase/actions";
import SubmitButton from "@/components/submit-button";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="font-title text-3xl font-semibold text-brand text-center">
          Crea un account
        </h1>
        <p className="mb-6 mt-2 text-center text-sm text-text-muted">Salva i locali che ti piacciono e ritrovali sulla tua mappa.</p>

        {params.error && (
          <p className="mb-4 rounded-btn bg-red-50 px-4 py-2 text-sm text-red-700">
            {params.error}
          </p>
        )}

        <form action={signup} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-text"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="mt-1 min-h-12 w-full rounded-btn border border-border bg-white px-4 text-base focus:border-brand focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-text"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={6}
              required
              className="mt-1 min-h-12 w-full rounded-btn border border-border bg-white px-4 text-base focus:border-brand focus:outline-none"
            />
          </div>

          <SubmitButton className="min-h-12 w-full rounded-pill bg-brand px-4 text-base font-display font-semibold text-white active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed">
            Registrati
          </SubmitButton>
        </form>

        <p className="mt-6 text-center text-sm text-text-muted">
          Hai già un account?{" "}
          <Link
            href="/login"
            className="font-semibold text-brand hover:underline"
          >
            Accedi
          </Link>
        </p>
      </div>
    </div>
  );
}
