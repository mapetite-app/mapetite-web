"use client";

import Link from "next/link";
import { useEffect } from "react";

// Errore imprevisto: messaggio umano, riprova e via d'uscita (quella di Next è in inglese).
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[errore-pagina]", error);
  }, [error]);

  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center px-6 text-center">
      <span aria-hidden className="text-5xl">🍳</span>
      <h1 className="mt-4 font-title text-2xl font-semibold text-brand">Qualcosa è andato storto</h1>
      <p className="mt-2 max-w-xs text-sm text-text-muted">Non è colpa tua. Riprova tra un attimo; se succede ancora, scrivici da “Feedback”.</p>
      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="inline-flex min-h-11 items-center rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white"
        >
          Riprova
        </button>
        <Link href="/mappa" className="inline-flex min-h-11 items-center rounded-pill border border-border px-5 text-sm font-display font-semibold text-brand">
          Torna alla mappa
        </Link>
      </div>
    </div>
  );
}
