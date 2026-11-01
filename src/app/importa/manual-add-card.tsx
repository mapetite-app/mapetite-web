"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import LinkResults from "@/components/link-results";
import { browserClient } from "@/lib/supabase/client-lazy";
import { getCategoryEmoji } from "@/lib/emoji";
import { displayAddress } from "@/lib/city";
import { saveSearchPlace, type LinkOutcome, type SearchPlace } from "@/lib/save-from-link";
import { rememberFirme } from "@/lib/catalog-firme";
import { trackFeature } from "@/lib/track";
import { addReel } from "@/lib/community-write";
import { reelSourceOf } from "@/lib/reel";

function errorText(e: unknown): string {
  if (e instanceof TypeError) return "Errore di rete. Controlla la connessione e riprova.";
  return e instanceof Error && e.message ? e.message : "Qualcosa è andato storto, riprova.";
}

// Google Place ID -> UUID del salvato, per i risultati che l'utente ha già salvato.
// Solo una lettura su Supabase (gratis): nessuna chiamata Google in più.
async function alreadySavedMap(userId: string, googleIds: string[]): Promise<Record<string, string>> {
  if (googleIds.length === 0) return {};
  const { data, error } = await (await browserClient())
    .from("saved_places")
    .select("place_id, places!inner(google_place_id)")
    .eq("user_id", userId)
    .in("places.google_place_id", googleIds);
  if (error || !data) return {};
  const out: Record<string, string> = {};
  for (const row of data as unknown as { place_id: string; places: { google_place_id: string | null } | null }[]) {
    if (row.places?.google_place_id) out[row.places.google_place_id] = row.place_id;
  }
  return out;
}

// "Aggiungi a mano": nome del locale e città → UNA ricerca Google (la stessa dell'import
// da screenshot, /api/places/search) → fino a 5 risultati → Salva in "📌 Voglio andarci".
// La ricerca parte solo quando l'utente tocca Cerca (o Invio); la stessa frase non viene
// cercata due volte di seguito.
export default function ManualAddCard({
  userId,
  initialQuery = "",
  autoSearch = false,
  reelUrl = null,
}: {
  userId: string | null;
  initialQuery?: string;
  autoSearch?: boolean;
  // Link del reel condiviso (Instagram/TikTok/YouTube, piano 5.6d): si collega al locale salvato.
  reelUrl?: string | null;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchPlace[] | null>(null);
  const [searchedFor, setSearchedFor] = useState<string | null>(null);
  const [searching, setSearching] = useState(Boolean(autoSearch && userId && initialQuery.trim()));
  const [error, setError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<LinkOutcome | null>(null);
  const started = useRef(false);
  const rootRef = useRef<HTMLElement>(null);

  const search = async (raw: string) => {
    const q = raw.trim();
    if (!userId || !q) return;
    if (q === searchedFor && results) { setSaved(null); return; } // stessa frase: niente seconda chiamata a Google
    trackFeature("import_manuale");
    setSearching(true);
    setError(null);
    setSaved(null);
    try {
      const res = await fetch("/api/places/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error("Non riesco a cercare su Google Maps in questo momento. Riprova.");
      const found = ((data.results ?? []) as SearchPlace[]).slice(0, 5);
      rememberFirme(found);
      setSavedIds(await alreadySavedMap(userId, found.map((r) => r.id)).catch(() => ({})));
      setResults(found);
      setSearchedFor(q);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSearching(false);
    }
  };

  // Ricerca chiesta da un altro punto della pagina (es. "Cerca …" sotto un link di Instagram).
  useEffect(() => {
    if (started.current || !autoSearch || !userId || !initialQuery.trim()) return;
    started.current = true;
    rootRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    void search(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (r: SearchPlace) => {
    if (!userId) return;
    setSaving(r.id);
    setError(null);
    try {
      const out = await saveSearchPlace(r, userId);
      if (reelUrl && out.place) {
        const reel = await addReel(userId, out.place.id, reelUrl);
        if (reel.esito === "ok") trackFeature("reel", { stato: "salvato_import", fonte: reelSourceOf(reelUrl) ?? "", contesto: "condividi" });
      }
      setSaved(out);
      setSavedIds((m) => ({ ...m, [r.id]: out.place!.id }));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(null);
    }
  };

  return (
    <section
      ref={rootRef}
      id="a-mano"
      className="scroll-mt-4 rounded-card border border-border bg-white p-5"
      data-testid="importa-mano"
    >
      <h2 className="font-display text-lg font-semibold text-brand">
        <span aria-hidden>✍️ </span>Aggiungi a mano
      </h2>
      <p className="mt-1 text-sm text-text-muted">Te l&apos;ha consigliato qualcuno? Scrivi il nome e la città, lo trovo io.</p>

      {!userId ? (
        <div className="mt-4 flex flex-wrap items-center gap-2" data-testid="mano-accedi">
          <p className="w-full text-sm text-text">Accedi per cercare e salvare i locali nella tua mappa.</p>
          <Link href="/login?next=%2Fimporta" className="inline-flex min-h-11 items-center rounded-pill bg-brand px-4 text-sm font-display font-semibold text-white">
            Accedi
          </Link>
          <Link href="/signup?next=%2Fimporta" className="inline-flex min-h-11 items-center rounded-pill border border-border bg-white px-4 text-sm font-medium text-text">
            Crea un account
          </Link>
        </div>
      ) : (
        <>
          <label htmlFor="mano-campo" className="mt-4 mb-1.5 block text-sm font-medium text-text">
            Nome del locale e città
          </label>
          <form
            className="flex gap-2"
            onSubmit={(e) => { e.preventDefault(); void search(query); }}
          >
            <input
              id="mano-campo"
              type="search"
              enterKeyHint="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="es. Da Michele Roma"
              maxLength={120}
              className="min-h-12 min-w-0 flex-1 rounded-btn border border-border bg-white px-3 text-base focus:border-brand focus:outline-none"
            />
            <button
              type="submit"
              disabled={searching || !query.trim()}
              className="min-h-12 shrink-0 rounded-pill bg-brand px-4 text-sm font-display font-semibold text-white disabled:opacity-60"
            >
              {searching ? "Cerco…" : "Cerca"}
            </button>
          </form>

          {saved && (
            <div className="mt-4 space-y-2">
              <LinkResults results={[saved]} userId={userId} />
              {!saved.alreadySaved && <p className="text-xs text-text-muted">Lo trovi tra i salvati in 📌 Voglio andarci.</p>}
            </div>
          )}

          {results && results.length === 0 && !searching && (
            <p className="mt-4 text-sm text-text" data-testid="mano-nessuno">
              Non trovo «{searchedFor}» su Google Maps. Prova ad aggiungere la città o il quartiere.
            </p>
          )}

          {results && results.length > 0 && !saved && (
            <ul className="mt-4 space-y-2" data-testid="mano-risultati">
              {results.map((r) => {
                const savedUuid = savedIds[r.id];
                return (
                  <li key={r.id} className="flex items-center gap-3 rounded-btn border border-border bg-white px-3 py-3" data-testid="mano-risultato">
                    <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-xl">
                      {getCategoryEmoji(r.category, r.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-text">{r.name}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-text-muted">{displayAddress(r.address)}</p>
                    </div>
                    {savedUuid ? (
                      <Link
                        href={`/mappa?salvato=${encodeURIComponent(savedUuid)}`}
                        className="shrink-0 text-right text-xs font-medium text-success underline-offset-2 hover:underline"
                        data-testid="mano-gia-salvato"
                      >
                        Già nei tuoi salvati
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => save(r)}
                        disabled={saving !== null || r.lat == null || r.lng == null}
                        className="min-h-11 shrink-0 rounded-pill bg-brand px-4 text-sm font-display font-semibold text-white disabled:opacity-60"
                      >
                        {saving === r.id ? "Salvo…" : "Salva"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {results && results.length > 0 && !saved && (
            <p className="mt-2 text-xs text-text-muted">Salva lo mette in 📌 Voglio andarci. Dopo puoi aggiungere una nota.</p>
          )}

          {error && <p className="mt-3 rounded-btn bg-error/10 px-4 py-3 text-sm text-error">{error}</p>}
        </>
      )}
    </section>
  );
}
