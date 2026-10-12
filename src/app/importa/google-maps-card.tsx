"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import LinkResults from "@/components/link-results";
import { clearPendingLink, readPendingLink, saveFromLinks, type LinkOutcome } from "@/lib/save-from-link";

const HAS_LINK = /https?:\/\/\S+/;

function errorText(e: unknown): string {
  if (e instanceof TypeError) return "Errore di rete. Controlla la connessione e riprova.";
  return e instanceof Error && e.message ? e.message : "Qualcosa è andato storto, riprova.";
}

// "Da Google Maps": su iPhone le app web non compaiono nel Condividi, quindi si copia
// il link in Google Maps e lo si incolla qui (anche più link, uno per riga).
export default function GoogleMapsCard({ userId }: { userId: string | null }) {
  // Link arrivato da Condividi prima dell'accesso (vedi /importa/condividi).
  const pending = useSyncExternalStore(() => () => {}, readPendingLink, () => null);
  const [draft, setDraft] = useState<string | null>(null);
  const [showField, setShowField] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<LinkOutcome[] | null>(null);
  const text = draft ?? pending ?? "";

  const save = async (value: string) => {
    if (!userId) return;
    if (!HAS_LINK.test(value)) {
      setShowField(true);
      setError("Non vedo un link. In Google Maps tocca Condividi e poi Copia link, poi torna qui.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setResults(await saveFromLinks(value, userId));
      clearPendingLink();
      setDraft("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const pasteFromClipboard = async () => {
    setError(null);
    let clip = "";
    try {
      clip = (await navigator.clipboard?.readText?.()) ?? "";
    } catch {
      // Permesso negato o browser che non lo consente: si incolla a mano nel campo.
    }
    if (clip.trim()) {
      setDraft(clip);
      await save(clip);
    } else {
      setShowField(true);
      setError("Non riesco a leggere gli appunti: tieni premuto nel campo qui sotto e scegli Incolla.");
    }
  };

  return (
    <section className="rounded-card border border-border bg-surface p-5" data-testid="importa-google">
      <h2 className="font-display text-lg font-semibold text-brand">
        <span aria-hidden>📍 </span>Da Google Maps
      </h2>
      <p className="mt-1 text-sm text-text-muted">Salva in Mapetite un locale che hai trovato su Google Maps.</p>

      <ol className="mt-4 space-y-2">
        {["In Google Maps apri il locale", "Tocca Condividi → Copia link", "Torna qui e tocca Incolla link"].map((s, i) => (
          <li key={s} className="flex items-start gap-3 text-sm text-text">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">
              {i + 1}
            </span>
            <span className="pt-0.5">{s}</span>
          </li>
        ))}
      </ol>

      {!userId ? (
        <p className="mt-4 text-sm text-text-muted">
          <Link href="/login" className="underline text-text">Accedi</Link> per salvare i locali.
        </p>
      ) : (
        <>
          {pending && draft === null && (
            <p className="mt-4 text-sm text-text" data-testid="link-in-attesa">
              Hai un link in attesa da Google Maps: tocca Salva.
            </p>
          )}

          <button
            type="button"
            onClick={pasteFromClipboard}
            disabled={busy}
            className="mt-4 min-h-14 w-full rounded-pill bg-brand px-4 text-base font-display font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Salvo..." : "📋 Incolla link"}
          </button>

          {(showField || pending) ? (
            <div className="mt-3 space-y-2">
              <textarea
                value={text}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                placeholder={"https://maps.app.goo.gl/…\nAnche più link, uno per riga"}
                aria-label="Link di Google Maps"
                className="w-full rounded-btn border border-border bg-white px-3 py-2 text-base focus:border-brand focus:outline-none"
              />
              <button
                type="button"
                onClick={() => save(text)}
                disabled={busy || !text.trim()}
                className="min-h-11 w-full rounded-pill border border-brand bg-white px-4 text-sm font-display font-semibold text-brand disabled:opacity-60"
              >
                Salva
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowField(true)}
              className="mt-2 w-full text-center text-sm text-text-muted underline"
            >
              Oppure incolla a mano
            </button>
          )}

          <p className="mt-3 text-xs text-text-muted">
            Su Android, con Mapetite installata, puoi anche scegliere Mapetite direttamente da Condividi.
          </p>

          {error && <p className="mt-3 rounded-btn bg-error/10 px-4 py-3 text-sm text-error">{error}</p>}
          {results && <div className="mt-4"><LinkResults results={results} userId={userId} /></div>}
        </>
      )}
    </section>
  );
}
