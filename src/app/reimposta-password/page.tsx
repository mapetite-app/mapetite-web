"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

// Arrivo dal link dell'email "Password dimenticata?": Supabase mette la sessione di
// recupero nell'indirizzo (#access_token=…&type=recovery). La si attiva qui, poi si
// sceglie la nuova password. Link scaduto o già usato: lo si dice e si richiede.
const FIELD =
  "mt-1 block h-12 w-full rounded-btn border border-border bg-white px-3.5 text-base font-sans text-text focus:outline-none focus:ring-2 focus:ring-brand";

type Stato = "verifica" | "pronto" | "salvo" | "fatto" | "scaduto";

export default function ReimpostaPasswordPage() {
  const router = useRouter();
  const [stato, setStato] = useState<Stato>("verifica");
  const [password, setPassword] = useState("");
  const [conferma, setConferma] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const access = hash.get("access_token");
    const refresh = hash.get("refresh_token");
    // Il token non deve restare nell'indirizzo (cronologia, screenshot, condivisione).
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
    if (!access || !refresh || hash.get("error")) {
      if (hash.get("error")) console.warn("[auth] link di recupero:", hash.get("error_code"), hash.get("error_description"));
      setTimeout(() => setStato("scaduto"), 0);
      return;
    }
    createClient().auth.setSession({ access_token: access, refresh_token: refresh }).then(({ data, error: err }) => {
      if (err) console.error("[auth] sessione di recupero:", err.code, err.message);
      setEmail(data.user?.email ?? "");
      setStato(err ? "scaduto" : "pronto");
    });
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setError("Password troppo corta: usa almeno 6 caratteri."); return; }
    if (password !== conferma) { setError("Le due password non coincidono."); return; }
    setError(null);
    setStato("salvo");
    const { error: err } = await createClient().auth.updateUser({ password });
    if (err) {
      console.error("[auth] nuova password:", err.code, err.message);
      setError(
        err.code === "same_password"
          ? "È uguale a quella di prima: scegline una diversa."
          : err.code === "weak_password"
            ? "Password troppo debole: usa almeno 6 caratteri."
            : "Non sono riuscito a salvarla. Riprova.",
      );
      setStato("pronto");
      return;
    }
    setStato("fatto");
    // La sessione è nuova solo nel browser: senza refresh la barra in basso resterebbe su "Entra".
    router.refresh();
  };

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <Image src="/icon-192.png" alt="" width={64} height={64} className="rounded-2xl shadow-card" priority />
          <h1 className="mt-4 font-title text-2xl font-semibold text-brand">
            {stato === "fatto" ? "Password aggiornata" : stato === "scaduto" ? "Link non valido" : "Scegli una nuova password"}
          </h1>
        </div>

        {stato === "verifica" && <p className="mt-6 text-center text-sm font-sans text-text-muted">Controllo il link…</p>}

        {stato === "scaduto" && (
          <div data-testid="reset-scaduto" className="mt-6 text-center">
            <p className="text-sm font-sans text-text-muted">
              Il link è scaduto o è già stato usato. Chiedine uno nuovo: arriva in un minuto.
            </p>
            <Link href="/password-dimenticata" className="mt-5 inline-flex h-12 items-center rounded-pill bg-brand px-6 text-base font-display font-semibold text-white">
              Mandami un nuovo link
            </Link>
          </div>
        )}

        {(stato === "pronto" || stato === "salvo") && (
          <form onSubmit={submit} className="mt-6 space-y-4">
            {error && <p role="alert" className="rounded-btn bg-error/10 px-4 py-3 text-sm font-sans text-error">{error}</p>}
            {/* Per il portachiavi del telefono: salva la nuova password sull'account giusto. */}
            <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
            {email && <p className="text-center text-sm font-sans text-text-muted">Account: {email}</p>}
            <div>
              <label htmlFor="password" className="block text-sm font-display font-medium text-text">Nuova password</label>
              <input id="password" type="password" autoComplete="new-password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} className={FIELD} />
              <p className="mt-1 text-xs font-sans text-text-muted">Almeno 6 caratteri.</p>
            </div>
            <div>
              <label htmlFor="conferma" className="block text-sm font-display font-medium text-text">Riscrivila</label>
              <input id="conferma" type="password" autoComplete="new-password" required value={conferma} onChange={(e) => setConferma(e.target.value)} className={FIELD} />
            </div>
            <button
              type="submit"
              disabled={stato === "salvo"}
              className="h-12 w-full rounded-pill bg-brand px-4 text-base font-display font-semibold text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {stato === "salvo" ? "Attendere…" : "Salva la nuova password"}
            </button>
          </form>
        )}

        {stato === "fatto" && (
          <div data-testid="reset-fatto" className="mt-6 text-center">
            <p className="text-sm font-sans text-text-muted">
              Sei dentro. Se usi Mapetite dall&apos;icona sulla Home, accedi lì con la nuova password.
            </p>
            <Link href="/mappa" className="mt-5 inline-flex h-12 items-center rounded-pill bg-brand px-6 text-base font-display font-semibold text-white">
              Vai alla mappa
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
