import Link from "next/link";
import Image from "next/image";
import SubmitButton from "@/components/submit-button";
import { withNext } from "@/lib/next-path";
import PendingSaveNote from "@/components/pending-save-note";
import { loginGoogle } from "@/lib/supabase/actions";

// Frase sotto il titolo quando dopo l'accesso si torna a una pagina precisa.
function returnHint(next: string): string {
  if (next.startsWith("/locali/")) return "Poi torni al locale che stavi guardando, pronto da salvare.";
  if (next.startsWith("/stasera")) return "Poi torni a “Stasera dove andiamo?”.";
  if (next.startsWith("/importa")) return "Poi torni a Importa: il link che stavi salvando resta lì.";
  return "Poi torni alla pagina di prima.";
}

// Accesso e registrazione con lo stesso aspetto del resto dell'app.
// Campi a 16px: sotto quella misura Safari su iPhone ingrandisce la pagina al tocco.
const FIELD =
  "mt-1 block h-12 w-full rounded-btn border border-border bg-white px-3.5 text-base font-sans text-text focus:outline-none focus:ring-2 focus:ring-brand";

export default function AuthForm({
  mode,
  action,
  error,
  message,
  next = null,
  google = false,
}: {
  mode: "login" | "signup";
  action: (formData: FormData) => Promise<void>;
  error?: string;
  message?: string;
  // Percorso già validato (safeNext) dove tornare dopo l'accesso.
  next?: string | null;
  // Accesso con Google acceso su Supabase: il pulsante in cima, un tocco e si entra.
  google?: boolean;
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
          {next && (
            <p data-testid="auth-ritorno" className="mt-1 text-sm font-sans text-text-muted">
              {returnHint(next)}
            </p>
          )}
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

        {google && (
          <>
            <form action={loginGoogle} className="mt-6">
              {next && <input type="hidden" name="next" value={next} />}
              <SubmitButton data-testid="auth-google" className="flex h-12 w-full items-center justify-center gap-2.5 rounded-pill border border-border bg-white px-4 text-base font-display font-semibold text-text shadow-card active:scale-[0.98] disabled:opacity-60">
                <svg aria-hidden width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
                Continua con Google
              </SubmitButton>
            </form>
            <p aria-hidden className="mt-4 flex items-center gap-3 text-xs font-sans text-text-muted before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">oppure con l&apos;email</p>
          </>
        )}

        <form action={action} className={google ? "mt-4 space-y-4" : "mt-6 space-y-4"}>
          {next && <input type="hidden" name="next" value={next} />}
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

        <p className="mt-4 text-center text-sm font-sans text-text-muted">
          {login ? "Non hai un account? " : "Hai già un account? "}
          <Link href={withNext(login ? "/signup" : "/login", next)} className="inline-flex min-h-10 items-center font-display font-semibold text-brand underline-offset-2 hover:underline">
            {login ? "Registrati" : "Accedi"}
          </Link>
        </p>
        <p className="text-center text-sm font-sans">
          <Link href="/mappa" className="inline-flex min-h-10 items-center text-text-muted underline underline-offset-2">
            Intanto prova a cercare senza account
          </Link>
        </p>
      </div>
    </div>
  );
}
