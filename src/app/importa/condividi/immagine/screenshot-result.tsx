"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import LinkResults from "@/components/link-results";
import { cityFromAddress, displayAddress } from "@/lib/city";
import { withNext } from "@/lib/next-path";
import { saveSearchPlace, type LinkOutcome, type SearchPlace } from "@/lib/save-from-link";

const ERRORI: Record<string, string> = {
  illeggibile: "Non riesco a leggere un locale in questa immagine.",
  limite: "Hai condiviso tante immagini in poco tempo: riprova tra qualche minuto.",
  formato: "Non riesco ad aprire questa immagine: prova con uno screenshot (PNG o JPG).",
  grande: "L'immagine è troppo grande (massimo 5 MB): prova con uno screenshot.",
};

function errorText(e: unknown): string {
  if (e instanceof TypeError) return "Errore di rete. Controlla la connessione e riprova.";
  return e instanceof Error && e.message ? e.message : "Qualcosa è andato storto, riprova.";
}

const SEARCH_KEY = "mapetite.screenshot-ricerca";

export default function ScreenshotResult({
  nome,
  citta,
  errore,
  piu,
  userId,
}: {
  nome: string;
  citta: string;
  errore: string;
  piu: boolean;
  userId: string | null;
}) {
  const query = [nome, citta].filter(Boolean).join(" ");
  const canSearch = Boolean(nome && !errore && userId);
  const [results, setResults] = useState<SearchPlace[] | null>(null);
  const [searching, setSearching] = useState(canSearch);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [others, setOthers] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState<LinkOutcome | null>(null);
  const started = useRef(false);

  // Una sola ricerca Google, come nell'import manuale dello screenshot.
  const search = () =>
    fetch("/api/places/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error("Non riesco a cercare il locale su Google Maps. Riprova.");
        const found = ((data.results ?? []) as SearchPlace[]).slice(0, 5);
        setResults(found);
        try { sessionStorage.setItem(SEARCH_KEY, JSON.stringify({ query, found })); } catch { /* storage non disponibile */ }
      })
      .catch((e) => setSearchError(errorText(e)))
      .finally(() => setSearching(false));

  useEffect(() => {
    if (started.current || !canSearch) return;
    started.current = true;
    // Ricaricata o riaperta: stessi risultati di prima, senza una seconda ricerca Google a pagamento.
    try {
      const cached = JSON.parse(sessionStorage.getItem(SEARCH_KEY) ?? "null");
      if (cached?.query === query && Array.isArray(cached.found)) {
        void Promise.resolve(cached.found as SearchPlace[]).then((found) => { setResults(found); setSearching(false); });
        return;
      }
    } catch { /* storage non disponibile */ }
    void search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (r: SearchPlace) => {
    if (!userId) return;
    setSaving(r.id);
    setSaveError(null);
    try {
      setSaved(await saveSearchPlace(r, userId));
    } catch (e) {
      setSaveError(errorText(e));
    } finally {
      setSaving(null);
    }
  };

  const top = results?.[0] ?? null;
  const rest = results?.slice(1) ?? [];
  const where = (r: SearchPlace) => cityFromAddress(r.address) ?? citta;

  const manualLink = (label: string) => (
    <Link
      href="/importa"
      data-testid="screenshot-manuale"
      className="inline-flex min-h-11 items-center rounded-pill border border-border bg-white px-4 text-sm font-display font-semibold text-brand"
    >
      {label}
    </Link>
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 font-title text-3xl font-semibold text-brand">Salva da uno screenshot</h1>

      {piu && (
        <p className="mb-4 rounded-btn bg-surface px-4 py-3 text-sm text-text-muted" data-testid="screenshot-piu">
          Hai condiviso più immagini: ho letto solo la prima.
        </p>
      )}

      {errore && (
        <div className="space-y-3" data-testid="screenshot-errore">
          <p className="rounded-btn bg-error/10 px-4 py-3 text-sm text-error">
            {ERRORI[errore] ?? "Qualcosa è andato storto con l'immagine. Riprova."}
          </p>
          <p className="text-sm text-text-muted">
            Funziona meglio con uno screenshot dove si vedono il nome del locale, il tag del profilo o la posizione del post.
          </p>
          {manualLink("Carica lo screenshot a mano")}
        </div>
      )}

      {!errore && !nome && (
        <div className="space-y-3">
          <p className="rounded-btn bg-error/10 px-4 py-3 text-sm text-error">
            Non è arrivata nessuna immagine. Da Instagram o TikTok fai uno screenshot, tocca Condividi e scegli Mapetite.
          </p>
          {manualLink("Vai a Importa")}
        </div>
      )}

      {!errore && nome && !userId && (
        <div className="space-y-3 rounded-card border border-border bg-surface p-5" data-testid="screenshot-accedi">
          <p className="text-sm text-text">
            Ho letto <span className="font-semibold">{[nome, citta].filter(Boolean).join(", ")}</span>. Per salvarlo accedi a Mapetite: poi torni qui e lo cerco su Google Maps.
          </p>
          {/* Dopo l'accesso si torna a questa pagina con lo stesso nome letto (nessuna nuova lettura AI). */}
          <Link href={withNext("/login", `/importa/condividi/immagine?${new URLSearchParams({ nome, ...(citta ? { citta } : {}) })}`)} className="inline-flex min-h-11 items-center rounded-pill bg-brand px-4 text-sm font-display font-semibold text-white">
            Accedi
          </Link>
        </div>
      )}

      {searching && (
        <p className="text-sm text-text-muted" data-testid="screenshot-attesa">
          Ho letto «{[nome, citta].filter(Boolean).join(", ")}»: lo cerco su Google Maps…
        </p>
      )}

      {searchError && (
        <div className="space-y-3">
          <p className="rounded-btn bg-error/10 px-4 py-3 text-sm text-error">{searchError}</p>
          <button
            type="button"
            onClick={() => { setSearching(true); setSearchError(null); void search(); }}
            disabled={searching}
            className="min-h-11 rounded-pill border border-border bg-white px-4 text-sm font-display font-semibold text-brand disabled:opacity-60"
          >
            Riprova
          </button>
        </div>
      )}

      {results && !top && (
        <div className="space-y-3" data-testid="screenshot-nessuno">
          <p className="text-sm text-text">
            Nello screenshot ho letto «{[nome, citta].filter(Boolean).join(", ")}», ma non lo trovo su Google Maps.
          </p>
          {manualLink("Cercalo a mano in Importa")}
        </div>
      )}

      {saved && userId && (
        <div className="space-y-2">
          <LinkResults results={[saved]} userId={userId} />
          {!saved.alreadySaved && <p className="text-xs text-text-muted">Lo trovi tra i salvati in 📌 Voglio andarci.</p>}
        </div>
      )}

      {top && !saved && (
        <div className="space-y-4">
          <div className="rounded-card border border-border bg-surface p-5" data-testid="screenshot-trovato">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Ho trovato</p>
            <p className="mt-1 font-display text-xl font-semibold text-brand">
              {top.name}{where(top) ? `, ${where(top)}` : ""}
            </p>
            <p className="mt-0.5 text-xs text-text-muted">{displayAddress(top.address)}</p>
            <p className="mt-3 text-sm text-text">Lo salvo in <span className="font-medium">📌 Voglio andarci</span>.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => save(top)}
                disabled={saving !== null}
                data-testid="screenshot-salva"
                className="min-h-11 rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white disabled:opacity-60"
              >
                {saving === top.id ? "Salvo..." : "Salva"}
              </button>
              {!others && (
                <button
                  type="button"
                  onClick={() => setOthers(true)}
                  disabled={saving !== null}
                  data-testid="screenshot-non-e-questo"
                  className="min-h-11 rounded-pill border border-border bg-white px-4 text-sm font-display font-semibold text-brand disabled:opacity-60"
                >
                  Non è questo
                </button>
              )}
            </div>
          </div>

          {saveError && <p className="rounded-btn bg-error/10 px-4 py-3 text-sm text-error">{saveError}</p>}

          {others && (
            <div className="space-y-3" data-testid="screenshot-altri">
              {rest.length > 0 && (
                <>
                  <p className="text-sm font-semibold text-text">Forse è uno di questi?</p>
                  <ul className="space-y-2">
                    {rest.map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => save(r)}
                          disabled={saving !== null}
                          className="w-full rounded-btn border border-border bg-white px-4 py-3 text-left disabled:opacity-60"
                        >
                          <p className="text-sm font-semibold text-text">{saving === r.id ? "Salvo..." : r.name}</p>
                          <p className="mt-0.5 text-xs text-text-muted">{displayAddress(r.address)}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className="text-sm text-text-muted">Non c&apos;è? Carica lo screenshot in Importa e cercalo a mano.</p>
              {manualLink("Carica lo screenshot a mano")}
            </div>
          )}
        </div>
      )}

      {saved && (
        <p className="mt-6 text-sm text-text-muted">
          <Link href="/importa" className="inline-flex min-h-11 items-center font-display font-semibold text-brand underline underline-offset-2">Salva altri locali</Link>
        </p>
      )}
    </div>
  );
}
