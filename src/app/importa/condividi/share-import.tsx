"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import LinkResults from "@/components/link-results";
import { clearPendingLink, rememberPendingLink, saveFromLinks, type LinkOutcome } from "@/lib/save-from-link";

function errorText(e: unknown): string {
  if (e instanceof TypeError) return "Errore di rete. Controlla la connessione e riprova.";
  return e instanceof Error && e.message ? e.message : "Qualcosa è andato storto, riprova.";
}

export default function ShareImport({
  title,
  sharedText,
  userId,
}: {
  title: string;
  sharedText: string;
  userId: string | null;
}) {
  const [results, setResults] = useState<LinkOutcome[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fullText = [title, sharedText].filter(Boolean).join("\n");
  const [busy, setBusy] = useState(Boolean(fullText && userId));
  const started = useRef(false);

  // "In corso" si accende prima: con lo stato iniziale o dal pulsante Riprova.
  const save = (uid: string) =>
    saveFromLinks(fullText, uid, title)
      .then((r) => { setResults(r); clearPendingLink(); })
      .catch((e) => setError(errorText(e)))
      .finally(() => setBusy(false));

  useEffect(() => {
    if (started.current || !fullText) return;
    started.current = true;
    // Senza accesso il link resta in attesa: lo ritrova la pagina Importa dopo il login.
    if (!userId) { rememberPendingLink(fullText); return; }
    void save(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-2 font-title text-3xl font-semibold text-brand">Salva da Google Maps</h1>

      {!fullText && (
        <p className="rounded-btn bg-error/10 px-4 py-3 text-sm text-error">
          Non è arrivato nessun link. In Google Maps apri il locale, tocca Condividi e scegli Mapetite.
        </p>
      )}

      {fullText && !userId && (
        <div className="space-y-3 rounded-card border border-border bg-surface p-5" data-testid="condividi-accedi">
          <p className="text-sm text-text">Per salvare il locale accedi a Mapetite. Il link resta qui: lo ritrovi in Importa dopo l&apos;accesso.</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/login" className="inline-flex min-h-11 items-center rounded-pill bg-brand px-4 text-sm font-display font-semibold text-white">
              Accedi
            </Link>
            <Link href="/signup" className="inline-flex min-h-11 items-center rounded-pill border border-border bg-white px-4 text-sm font-medium text-text">
              Crea un account
            </Link>
          </div>
        </div>
      )}

      {busy && (
        <p className="text-sm text-text-muted" data-testid="condividi-attesa">Cerco il locale su Google Maps…</p>
      )}

      {userId && results && <LinkResults results={results} userId={userId} />}

      {error && (
        <div className="space-y-3">
          <p className="rounded-btn bg-error/10 px-4 py-3 text-sm text-error">{error}</p>
          <button
            type="button"
            onClick={() => { setBusy(true); setError(null); if (userId) void save(userId); }}
            disabled={busy}
            className="min-h-11 rounded-pill border border-border bg-white px-4 text-sm font-medium text-text disabled:opacity-60"
          >
            Riprova
          </button>
        </div>
      )}

      {(results || error) && (
        <p className="mt-6 text-sm text-text-muted">
          <Link href="/importa" className="underline text-text">Salva altri locali</Link>
        </p>
      )}
    </div>
  );
}
