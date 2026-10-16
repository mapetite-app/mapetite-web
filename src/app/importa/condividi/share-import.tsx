"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { extractMapsLinks } from "@/lib/maps-link";
import { findSocialLink, placeHintFromText } from "@/lib/social-link";
import SocialLinkHelp from "../social-link-help";
import { findVideoLink } from "@/lib/video-caption";
import { findReelLink } from "@/lib/reel";
import ManualAddCard from "../manual-add-card";
import LinkResults from "@/components/link-results";
import { clearPendingLink, rememberPendingLink, saveFromLinks, type LinkOutcome } from "@/lib/save-from-link";
import { trackFeature } from "@/lib/track";

function errorText(e: unknown): string {
  if (e instanceof TypeError) return "Errore di rete. Controlla la connessione e riprova.";
  return e instanceof Error && e.message ? e.message : "Qualcosa è andato storto, riprova.";
}

// Esito già ottenuto in questa sessione del browser per lo stesso testo condiviso.
const DONE_KEY = "mapetite.condividi-fatto";
function readDone(text: string): LinkOutcome[] | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(DONE_KEY) ?? "null");
    return saved?.text === text && Array.isArray(saved.results) ? saved.results : null;
  } catch { return null; }
}
function rememberDone(text: string, results: LinkOutcome[]) {
  try { sessionStorage.setItem(DONE_KEY, JSON.stringify({ text, results })); } catch { /* storage non disponibile */ }
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
  // Link di Instagram/TikTok/YouTube Shorts (senza link di Maps): non si chiama il server.
  const social = fullText && extractMapsLinks(fullText).length === 0 ? findSocialLink(fullText) : null;
  const hint = social ? placeHintFromText(fullText) : null;
  const video = social ? findVideoLink(fullText) : null;
  const [manualQuery, setManualQuery] = useState<string | null>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(Boolean(fullText && userId && !social));
  const started = useRef(false);

  // "In corso" si accende prima: con lo stato iniziale o dal pulsante Riprova.
  const save = (uid: string) =>
    saveFromLinks(fullText, uid, title)
      .then((r) => { setResults(r); clearPendingLink(); rememberDone(fullText, r); })
      .catch((e) => setError(errorText(e)))
      .finally(() => setBusy(false));

  useEffect(() => {
    if (started.current || !fullText || social) return;
    started.current = true;
    // Senza accesso il link resta in attesa: lo ritrova la pagina Importa dopo il login.
    if (!userId) { rememberPendingLink(fullText); return; }
    // Ricaricata (o riaperta dalle app recenti): si mostra l'esito di prima senza richiamare
    // Google, che costerebbe di nuovo 1 ricerca per link sulle 50 al giorno.
    const done = readDone(fullText);
    if (done) { void Promise.resolve(done).then((r) => { setResults(r); setBusy(false); }); return; }
    trackFeature("import_condivisione");
    void save(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 font-title text-3xl font-semibold text-brand">{social ? "Salva un locale" : "Salva da Google Maps"}</h1>

      {social && (
        <div className="space-y-6">
          <SocialLinkHelp
            source={social}
            hint={hint}
            onScreenshot={() => router.push("/importa#da-screenshot")}
            onSearch={(q) => setManualQuery(q)}
            // Condiviso da TikTok/YouTube: Importa legge la didascalia del video e propone il locale.
            onReadVideo={video ? () => router.push(`/importa?video=${encodeURIComponent(video)}#da-screenshot`) : undefined}
          />
          {manualQuery && <ManualAddCard userId={userId} initialQuery={manualQuery} autoSearch reelUrl={findReelLink(fullText)} />}
        </div>
      )}

      {!fullText && (
        <div className="space-y-3" data-testid="condividi-vuoto">
          <p className="rounded-btn bg-error/10 px-4 py-3 text-sm text-error">
            Non è arrivato nessun link. In Google Maps apri il locale, tocca Condividi e scegli Mapetite.
          </p>
          {/* Senza un'azione la pagina restava un vicolo cieco. */}
          <Link href="/importa" className="inline-flex min-h-11 items-center rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white">
            Incolla il link in Importa
          </Link>
        </div>
      )}

      {fullText && !userId && !social && (
        <div className="space-y-3 rounded-card border border-border bg-surface p-5" data-testid="condividi-accedi">
          <p className="text-sm text-text">Per salvare il locale accedi a Mapetite. Il link resta qui: lo ritrovi in Importa dopo l&apos;accesso.</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/login?next=%2Fimporta" className="inline-flex min-h-11 items-center rounded-pill bg-brand px-4 text-sm font-display font-semibold text-white">
              Accedi
            </Link>
            <Link href="/signup?next=%2Fimporta" className="inline-flex min-h-11 items-center rounded-pill border border-border bg-white px-4 text-sm font-display font-semibold text-brand">
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
            className="min-h-11 rounded-pill border border-border bg-white px-4 text-sm font-display font-semibold text-brand disabled:opacity-60"
          >
            Riprova
          </button>
        </div>
      )}

      {(results || error) && (
        <p className="mt-6 text-sm text-text-muted">
          <Link href="/importa" className="inline-flex min-h-11 items-center font-display font-semibold text-brand underline underline-offset-2">Salva altri locali</Link>
        </p>
      )}
    </div>
  );
}
