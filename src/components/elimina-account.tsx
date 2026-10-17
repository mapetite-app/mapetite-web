"use client";

import { useEffect, useState } from "react";
import { trackFeature } from "@/lib/track";
import { INTRO_KEY } from "@/components/home-intro";

// "Elimina il mio account" (in fondo al profilo, discreto). Conferma in due passi: un foglio
// che dice cosa si cancella, poi "Elimina definitivamente". Niente parole da digitare.
// La cancellazione la fa il server (src/app/api/account/elimina/route.ts).
const COSA = [
  "I tuoi locali salvati, le raccolte e le note",
  "Il diario, i voti, la classifica e le recensioni",
  "Le foto che hai caricato",
  "Il profilo pubblico, chi segui e le liste di gruppo",
];

export default function EliminaAccount() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => { if (!busy) { setOpen(false); setError(null); } };

  useEffect(() => {
    if (!open || busy) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setError(null); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy]);

  async function elimina() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/elimina", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.ok) {
        setError(typeof body?.error === "string" ? body.error : "Non sono riuscito a eliminare l'account. Riprova tra poco.");
        setBusy(false);
        return;
      }
    } catch {
      setError("Connessione assente: riprova quando sei online.");
      setBusy(false);
      return;
    }
    // Anche i dati tenuti su questo telefono (ricerche recenti, gusti, bozze). L'intro già vista
    // resta: la home non deve ripartire dalle tre schermate di benvenuto.
    try {
      for (const k of Object.keys(window.localStorage)) if (k.startsWith("mapetite") && k !== INTRO_KEY) window.localStorage.removeItem(k);
      for (const k of Object.keys(window.sessionStorage)) if (k.startsWith("mapetite")) window.sessionStorage.removeItem(k);
    } catch { /* storage non disponibile */ }
    // Pagina nuova (non navigazione interna): niente dati dell'account rimasti in memoria.
    window.location.assign("/?account=eliminato");
  }

  return (
    <>
      <div className="mt-6 flex justify-center">
        <button
          type="button"
          data-testid="elimina-account"
          onClick={() => { setOpen(true); trackFeature("elimina_account", { contesto: "apri" }); }}
          className="inline-flex min-h-11 items-center px-3 text-xs font-display font-semibold text-text-muted underline-offset-2 active:underline"
        >
          Elimina il mio account
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center" data-testid="elimina-account-foglio">
          <button type="button" aria-label="Chiudi" onClick={close} className="absolute inset-0 bg-black/40" />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="elimina-account-titolo"
            className="relative flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-y-auto rounded-t-[24px] bg-white px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3 shadow-float"
          >
            <span aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
            <h3 id="elimina-account-titolo" className="font-title text-lg font-semibold text-brand">Eliminare il tuo account?</h3>
            <p className="mt-2 text-sm text-text">Si cancella tutto, per sempre. Non si può tornare indietro.</p>
            <ul className="mt-3 space-y-1.5 rounded-card border border-border bg-surface px-4 py-3 text-sm text-text">
              {COSA.map((c) => (
                <li key={c} className="flex gap-2"><span aria-hidden className="text-error">✕</span>{c}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-text-muted">
              Restano solo segnali d&apos;uso anonimi (per esempio quante ricerche si fanno), senza alcun legame con te.
              Potrai sempre creare un nuovo account con la stessa email.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                data-testid="elimina-account-conferma"
                disabled={busy}
                onClick={() => void elimina()}
                className="flex min-h-12 w-full items-center justify-center rounded-pill bg-error px-5 text-sm font-display font-semibold text-white active:scale-[0.99] disabled:opacity-60"
              >
                {busy ? "Elimino…" : "Elimina definitivamente"}
              </button>
              <button
                type="button"
                data-testid="elimina-account-annulla"
                disabled={busy}
                onClick={close}
                className="flex min-h-12 w-full items-center justify-center rounded-pill border border-border px-5 text-sm font-display font-semibold text-brand active:scale-[0.99] disabled:opacity-40"
              >
                No, tienilo
              </button>
            </div>
            {error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}
