import Link from "next/link";
import Image from "next/image";
import SubmitButton from "@/components/submit-button";
import PendingSaveNote from "@/components/pending-save-note";

// Accesso e registrazione con lo stesso aspetto del resto dell'app.
// Campi a 16px: sotto quella misura Safari su iPhone ingrandisce la pagina al tocco.
const FIELD =
  "mt-1 block h-12 w-full rounded-btn border border-border bg-white px-3.5 text-base font-sans text-text focus:outline-none focus:ring-2 focus:ring-brand";

export default function AuthForm({
  mode,
  action,
  error,
  message,
}: {
  mode: "login" | "signup";
  action: (formData: FormData) => Promise<void>;
  error?: string;
  message?: string;
}) {
  const login = mode === "login";
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <Image src="/icon-192.png" alt="" width={64} height={64} className="rounded-2xl shadow-card" priority />
          <h1 className="mt-4 font-title text-2xl font-semibold text-brand">
            {login ? "Accedi a Mapetite" : "Crea il tuo account"}
          </h1>
          <p className="mt-1.5 text-sm font-sans text-text-muted">
            {login
              ? "Ritrova i tuoi locali salvati, le note e le ricerche."
              : "Salva i posti che ti piacciono, con note e tag, e ritrovali sulla mappa."}
          </p>
        </div>

        {message && (
          <p role="status" className="mt-6 rounded-btn bg-success/10 px-4 py-3 text-sm font-sans text-success">
            {message}
          </p>
        )}
        {!login && !message && <PendingSaveNote />}
        {error && (
          <p role="alert" className="mt-6 rounded-btn bg-error/10 px-4 py-3 text-sm font-sans text-error">
            {error}
          </p>
        )}

        <form action={action} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-display font-medium text-text">
              Email
            </label>
            <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required className={FIELD} />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-display font-medium text-text">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={login ? "current-password" : "new-password"}
              minLength={login ? undefined : 6}
              required
              className={FIELD}
            />
            {!login && <p className="mt-1 text-xs font-sans text-text-muted">Almeno 6 caratteri.</p>}
            {login && (
              <Link href="/password-dimenticata" className="mt-1.5 inline-block text-sm font-sans text-text-muted underline underline-offset-2">
                Password dimenticata?
              </Link>
            )}
          </div>
          <SubmitButton className="h-12 w-full rounded-pill bg-brand px-4 text-base font-display font-semibold text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60">
            {login ? "Accedi" : "Registrati"}
          </SubmitButton>
        </form>

        <p className="mt-6 text-center text-sm font-sans text-text-muted">
          {login ? "Non hai un account? " : "Hai già un account? "}
          <Link href={login ? "/signup" : "/login"} className="font-display font-semibold text-brand underline-offset-2 hover:underline">
            {login ? "Registrati" : "Accedi"}
          </Link>
        </p>
        <p className="mt-3 text-center text-sm font-sans">
          <Link href="/mappa" className="text-text-muted underline underline-offset-2">
            Intanto prova a cercare senza account
          </Link>
        </p>
      </div>
    </div>
  );
}
