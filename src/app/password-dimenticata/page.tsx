"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient as createSupabase } from "@supabase/supabase-js";

// "Password dimenticata?": Supabase manda un'email con un link per sceglierne una nuova.
// Flusso "implicit" (non PKCE): il link funziona anche se si apre in un altro browser
// (app Gmail, Safari invece dell'app installata), perché non serve un cookie salvato qui.
const FIELD =
  "mt-1 block h-12 w-full rounded-btn border border-border bg-white px-3.5 text-base font-sans text-text focus:outline-none focus:ring-2 focus:ring-brand";

export default function PasswordDimenticataPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState("sending");
    setError(null);
    const supabase = createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reimposta-password`,
    });
    if (err) {
      console.error("[auth] reset password:", err.code, err.message);
      setError(
        err.code === "over_email_send_rate_limit" || err.status === 429
          ? "Troppe richieste ravvicinate: riprova tra qualche minuto."
          : err.code === "email_address_invalid"
            ? "Questa email non sembra valida."
            : "Non sono riuscito a mandare l'email. Riprova tra poco.",
      );
      setState("error");
      return;
    }
    setState("sent");
  };

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <Image src="/icon-192.png" alt="" width={64} height={64} className="rounded-2xl shadow-card" priority />
          <h1 className="mt-4 font-title text-2xl font-semibold text-brand">Password dimenticata?</h1>
          <p className="mt-1.5 text-sm font-sans text-text-muted">
            Scrivi la tua email: ti mando un link per sceglierne una nuova.
          </p>
        </div>

        {state === "sent" ? (
          <div role="status" data-testid="reset-inviato" className="mt-6 rounded-btn bg-success/10 px-4 py-3 text-sm font-sans text-success">
            Fatto. Se <strong>{email.trim()}</strong> è registrata, tra poco ti arriva un&apos;email da Mapetite (guarda anche nello spam).
            Apri il link e scegli la nuova password.
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            {error && (
              <p role="alert" className="rounded-btn bg-error/10 px-4 py-3 text-sm font-sans text-error">{error}</p>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-display font-medium text-text">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={FIELD}
              />
            </div>
            <button
              type="submit"
              disabled={state === "sending"}
              className="h-12 w-full rounded-pill bg-brand px-4 text-base font-display font-semibold text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {state === "sending" ? "Attendere…" : "Mandami il link"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm font-sans">
          <Link href="/login" className="font-display font-semibold text-brand underline-offset-2 hover:underline">
            ← Torna ad Accedi
          </Link>
        </p>
      </div>
    </div>
  );
}
