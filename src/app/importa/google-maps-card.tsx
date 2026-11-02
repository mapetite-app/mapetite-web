"use client";

import { useImperativeHandle, useState, useSyncExternalStore, type Ref } from "react";
import Link from "next/link";
import LinkResults from "@/components/link-results";
import { clearPendingLink, readPendingLink, saveFromLinks, type LinkOutcome } from "@/lib/save-from-link";
import { extractMapsLinks } from "@/lib/maps-link";
import { extractAllLinks } from "@/lib/multi-link";
import { findSocialLink } from "@/lib/social-link";
import ReelSave from "@/components/reel-save";
import { trackFeature } from "@/lib/track";

const HAS_LINK = /https?:\/\/\S+/;

function errorText(e: unknown): string {
  if (e instanceof TypeError) return "Errore di rete. Controlla la connessione e riprova.";
  return e instanceof Error && e.message ? e.message : "Qualcosa è andato storto, riprova.";
}

// "Incolla un link" in cima a Importa (stile "Aggiungi qualsiasi cosa" di Albo): un solo pulsante
// che capisce da solo il link. Un link di Google Maps si salva subito; un reel di
// Instagram/TikTok/YouTube passa a "Salva dal reel" (src/components/reel-save.tsx); più link insieme
// (una chat, una nota, tanti link di Maps) passano all'elenco di "Incolla più link" (multi-link-card.tsx).
export default function GoogleMapsCard({
  userId,
  onMulti,
  ref,
}: {
  userId: string | null;
  // Tanti link misti (chat, nota): li legge la lista di MultiLinkCard.
  onMulti?: (text: string) => void;
  // "Incolla il link copiato" della guida in cima (SalvaDaTelefono) usa lo stesso percorso.
  ref?: Ref<{ paste: () => void }>;
}) {
  // Link arrivato da Condividi prima dell'accesso (vedi /importa/condividi).
  const pending = useSyncExternalStore(() => () => {}, readPendingLink, () => null);
  const [draft, setDraft] = useState<string | null>(null);
  const [showField, setShowField] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<LinkOutcome[] | null>(null);
  // Reel incollato: il numero fa ripartire la lettura se si incolla di nuovo.
  const [reel, setReel] = useState<{ text: string; n: number } | null>(null);
  const text = draft ?? pending ?? "";

  const save = async (value: string) => {
    if (!userId) return;
    setReel(null);
    if (!HAS_LINK.test(value)) {
      setShowField(true);
      setError("Non vedo un link. Nell'app tocca Condividi → Copia link, poi torna qui.");
      return;
    }
    const all = extractAllLinks(value).links;
    // Più di un link (anche solo di Google Maps): prima l'elenco dei posti trovati, poi "Salva tutti".
    if (onMulti && all.length > 1) {
      setError(null);
      setResults(null);
      setDraft("");
      setShowField(false);
      onMulti(value);
      return;
    }
    // Link di Instagram/TikTok/YouTube senza link di Maps: "Salva dal reel".
    if (extractMapsLinks(value).length === 0 && findSocialLink(value)) {
      setError(null);
      setResults(null);
      setDraft("");
      setShowField(false);
      clearPendingLink();
      setReel((r) => ({ text: value, n: (r?.n ?? 0) + 1 }));
      return;
    }
    setBusy(true);
    setError(null);
    trackFeature("import_link");
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

  useImperativeHandle(ref, () => ({ paste: () => void pasteFromClipboard() }));

  return (
    // Revisore 2/11, terzo giro: niente più riquadro scuro attorno al pulsante (pesava): il pulsante corallo da
    // solo sul fondo carta della pagina, con il sottotitolo sotto.
    <section id="importa-google-card" className="scroll-mt-4 text-text" data-testid="importa-google">
      {!userId ? (
        <div className="rounded-card border border-[#e8e2d8] bg-white p-5">
          <p className="font-display text-lg font-semibold">📋 Incolla un link</p>
          <p className="mt-1 text-sm text-text-muted">
            <Link href="/login?next=%2Fimporta" className="font-semibold text-brand underline">Accedi</Link> per salvare i locali.
          </p>
        </div>
      ) : (
        <>
          {pending && draft === null && (
            <p className="mb-3 text-sm" data-testid="link-in-attesa">
              Hai un link in attesa da Google Maps: tocca Salva.
            </p>
          )}

          <button
            type="button"
            onClick={pasteFromClipboard}
            disabled={busy}
            data-testid="importa-incolla"
            className="min-h-16 w-full rounded-pill bg-accent px-4 text-lg font-display font-semibold text-white shadow-float active:scale-[0.99] disabled:opacity-60"
          >
            {busy ? "Salvo..." : "Incolla un link"}
          </button>
          <p className="mt-2 text-center text-[13px] text-text-muted" data-testid="importa-incolla-fonti">
            Google Maps, un reel o una chat di link
          </p>

          {/* Revisore 2/11 (quinto giro): niente più "Scrivi o incolla a mano" qui (sembrava "Scrivi il nome" in
              Altri modi): il campo compare da solo quando "Incolla" non riesce a leggere gli appunti. */}
          {(showField || pending) && (
            <div className="mt-3 space-y-2">
              <textarea
                value={text}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                placeholder={"https://maps.app.goo.gl/…\nAnche una chat piena di link"}
                aria-label="Link da incollare"
                className="w-full rounded-btn border border-[#ddd5c8] bg-white px-3 py-2 text-base text-text focus:border-brand focus:outline-none"
              />
              <button
                type="button"
                onClick={() => save(text)}
                disabled={busy || !text.trim()}
                className="min-h-11 w-full rounded-pill bg-brand px-4 text-sm font-display font-semibold text-white disabled:opacity-60"
              >
                Salva
              </button>
            </div>
          )}

          {error && <p className="mt-3 rounded-btn border border-[#e8e2d8] bg-white px-4 py-3 text-sm text-error" data-testid="incolla-errore">{error}</p>}
          {reel && (
            // Fondo bianco senza margini interni, con il filo come le altre card della pagina.
            <div className="mt-4 overflow-hidden rounded-card border border-[#e8e2d8] bg-white text-text">
              <ReelSave key={reel.n} text={reel.text} userId={userId} />
            </div>
          )}
          {results && <div className="mt-4 rounded-card border border-[#e8e2d8] bg-white p-3 text-text"><LinkResults results={results} userId={userId} /></div>}
        </>
      )}
    </section>
  );
}
