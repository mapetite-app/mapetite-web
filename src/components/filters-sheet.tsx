"use client";

import { useEffect, useState } from "react";
import { CUISINES, OCCASIONS, FEATURES, OPEN_AT } from "@/lib/filter-options";
import { trackFeature } from "@/lib/track";

export type Filters = {
  // "Dove?": zona, quartiere, via o città scritti a mano ("" = intorno alla mappa).
  zona: string;
  radiusKm: number | null;
  minRating: number | null;
  minPriceLevel: number | null;
  maxPriceLevel: number | null;
  minReviews: number | null;
  openNowOnly: boolean;
  categories: string[];
  cuisines: string[];
  occasion: string | null;
  features: string[];
  // "Aperto a un'ora scelta": id di OPEN_AT ("stasera", "domani-pranzo"…); il giorno si calcola alla ricerca.
  openAt: string | null;
};

export const EMPTY_FILTERS: Filters = {
  zona: "",
  radiusKm: null,
  minRating: null,
  minPriceLevel: null,
  maxPriceLevel: null,
  minReviews: null,
  openNowOnly: false,
  categories: [],
  cuisines: [],
  occasion: null,
  features: [],
  openAt: null,
};

export const CATEGORIES = [
  { id: "restaurant", label: "Ristoranti", emoji: "🍽️" },
  { id: "cafe", label: "Caffè e Bar", emoji: "☕" },
  { id: "pizza", label: "Pizzerie", emoji: "🍕" },
  { id: "sushi", label: "Sushi", emoji: "🍣" },
  { id: "pub", label: "Pub e Birrerie", emoji: "🍺" },
  { id: "gelato", label: "Gelaterie", emoji: "🍦" },
  { id: "bakery", label: "Panetterie", emoji: "🥐" },
  { id: "fastfood", label: "Fast Food", emoji: "🍔" },
  { id: "vegetarian", label: "Vegetariano", emoji: "🥗" },
  { id: "seafood", label: "Pesce", emoji: "🐟" },
  { id: "steakhouse", label: "Steakhouse", emoji: "🥩" },
  { id: "wine_bar", label: "Wine Bar", emoji: "🍷" },
];

// Filtri salvati prima delle nuove sezioni (stato vecchio, link): i campi mancanti diventano vuoti.
export function withDefaults(f: Partial<Filters>): Filters {
  return { ...EMPTY_FILTERS, ...f };
}

export function countActive(f: Filters): number {
  f = withDefaults(f);
  let n = 0;
  if (f.zona.trim()) n++;
  if (f.radiusKm != null && !f.zona.trim()) n++;
  if (f.minRating != null) n++;
  if (f.minPriceLevel != null || f.maxPriceLevel != null) n++;
  if (f.minReviews != null) n++;
  if (f.openNowOnly || f.openAt) n++;
  if (f.categories.length > 0) n++;
  if (f.cuisines.length > 0) n++;
  if (f.occasion) n++;
  n += f.features.length;
  return n;
}

// Scelte rapide al posto di cursore e stelline: più chiare e comode col dito.
const DISTANCE_OPTIONS: { label: string; value: number | null }[] = [
  { label: "Qualsiasi", value: null },
  { label: "1 km", value: 1 },
  { label: "3 km", value: 3 },
  { label: "5 km", value: 5 },
  { label: "10 km", value: 10 },
];

// Zone suggerite per città (Roma e Milano prima di tutto, VISIONE): un tocco invece di scrivere.
const ZONE: Record<string, string[]> = {
  Roma: ["Trastevere", "Monti", "Pigneto", "Testaccio", "Prati", "San Lorenzo", "Ostiense", "Centocelle"],
  Milano: ["Brera", "Navigli", "Isola", "Porta Venezia", "NoLo", "Città Studi", "Porta Romana", "Sarpi"],
};

const RATING_OPTIONS: { label: string; value: number | null }[] = [
  { label: "Tutti", value: null },
  { label: "★ 4+", value: 4 },
  { label: "★ 4,5+", value: 4.5 },
];

const chip = (selected: boolean) =>
  [
    "min-h-10 rounded-pill border px-4 text-sm font-display font-medium transition-colors",
    selected ? "border-brand bg-brand text-white" : "border-border bg-white text-text hover:border-text-muted",
  ].join(" ");

const REVIEW_OPTIONS: { label: string; value: number | null }[] = [
  { label: "Tutte", value: null },
  { label: "50+", value: 50 },
  { label: "200+", value: 200 },
  { label: "500+", value: 500 },
];

// Sezioni lunghe (cucina, caratteristiche): le prime 6, poi "Mostra tutte".
const SHORT_LIST = 6;

const PRICE_LEVELS = [
  { label: "€", value: 1 },
  { label: "€€", value: 2 },
  { label: "€€€", value: 3 },
  { label: "€€€€", value: 4 },
];

export default function FiltersSheet({
  isOpen,
  filters,
  onApply,
  onClose,
  city = null,
}: {
  isOpen: boolean;
  filters: Filters;
  onApply: (f: Filters) => void;
  onClose: () => void;
  // Città in cui è la mappa (per le zone suggerite e "Tutta Roma").
  city?: string | null;
}) {
  const [local, setLocal] = useState<Filters>(() => withDefaults(filters));
  const [allCuisines, setAllCuisines] = useState(false);
  const [allFeatures, setAllFeatures] = useState(false);

  useEffect(() => {
    if (isOpen) setLocal(withDefaults(filters));
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const active = countActive(local);

  const toggleCategory = (id: string) =>
    setLocal((prev) => ({
      ...prev,
      categories: prev.categories.includes(id)
        ? prev.categories.filter((c) => c !== id)
        : [...prev.categories, id],
    }));

  const toggleIn = (key: "cuisines" | "features", id: string) =>
    setLocal((prev) => ({
      ...prev,
      [key]: prev[key].includes(id) ? prev[key].filter((c) => c !== id) : [...prev[key], id],
    }));

  // Una scelta nascosta dietro "Mostra tutte" resta visibile: si vede sempre cosa è attivo.
  const visible = <T extends { id: string }>(list: T[], all: boolean, chosen: string[]) =>
    all ? list : list.filter((x, i) => i < SHORT_LIST || chosen.includes(x.id));

  const optionChips = (list: { id: string; label: string; emoji: string }[], isOn: (id: string) => boolean, onTap: (id: string) => void) =>
    list.map(({ id, label, emoji }) => (
      <button key={id} type="button" aria-pressed={isOn(id)} onClick={() => onTap(id)} className={`${chip(isOn(id))} flex items-center gap-1.5 px-3.5`}>
        <span aria-hidden>{emoji}</span>
        <span>{label}</span>
      </button>
    ));

  const moreButton = (list: unknown[], all: boolean, toggle: () => void, testId: string) =>
    list.length > SHORT_LIST && (
      <button type="button" data-testid={testId} onClick={toggle} className="min-h-10 px-2 font-display text-sm font-semibold text-brand underline-offset-2 hover:underline">
        {all ? "Mostra meno" : `Mostra tutte (${list.length})`}
      </button>
    );

  const setPriceLevel = (value: number) =>
    setLocal((prev) => {
      const already = prev.minPriceLevel === value && prev.maxPriceLevel === value;
      return {
        ...prev,
        minPriceLevel: already ? null : value,
        maxPriceLevel: already ? null : value,
      };
    });

  return (
    <>
      {/* Overlay — z-[55]: sopra la nav (z-50), sotto il pannello (z-[60]) */}
      <div
        className="fixed inset-0 z-[55] bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet — z-[60] per stare sopra la nav; si ferma sopra la nav via offset */}
      <div
        className="fixed inset-x-0 z-[60] mx-auto flex max-w-lg flex-col rounded-t-[24px] bg-surface shadow-float"
        style={{ bottom: "var(--nav-height-mobile)", maxHeight: "var(--sheet-max-h)" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 pb-3 pt-1">
          <div>
            <span className="font-display text-lg font-semibold text-text">Filtri</span>
            <p className="text-xs font-sans text-text-muted">Tipo, cucina, occasione, zona e orario: senza scrivere niente.</p>
          </div>
          <button
            type="button"
            onClick={() => setLocal(EMPTY_FILTERS)}
            className="min-h-10 font-display text-sm font-semibold text-accent disabled:opacity-40"
            disabled={active === 0}
          >
            Azzera
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-6">

          {/* Categorie: la scelta più comune, per prima */}
          <section>
            <span className="font-display text-sm font-semibold text-text block mb-2">Che tipo di locale?</span>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(({ id, label, emoji }) => {
                const selected = local.categories.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleCategory(id)}
                    className={`${chip(selected)} flex items-center gap-1.5 px-3.5`}
                  >
                    <span aria-hidden>{emoji}</span>
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Cucina: entra nel testo della ricerca ("ristorante cucina romana") */}
          <section data-testid="filtri-cucina">
            <span className="font-display text-sm font-semibold text-text block mb-2">Che cucina?</span>
            <div className="flex flex-wrap gap-2">
              {optionChips(visible(CUISINES, allCuisines, local.cuisines), (id) => local.cuisines.includes(id), (id) => toggleIn("cuisines", id))}
              {moreButton(CUISINES, allCuisines, () => setAllCuisines((v) => !v), "cucina-tutte")}
            </div>
          </section>

          {/* Occasione: una sola scelta */}
          <section data-testid="filtri-occasione">
            <span className="font-display text-sm font-semibold text-text block mb-2">Per quale occasione?</span>
            <div className="flex flex-wrap gap-2">
              {optionChips(OCCASIONS, (id) => local.occasion === id, (id) => setLocal((p) => ({ ...p, occasion: p.occasion === id ? null : id })))}
            </div>
          </section>

          {/* Dove: zona, quartiere, via o città intera */}
          <section>
            <label htmlFor="filtro-zona" className="font-display text-sm font-semibold text-text block mb-2">Dove?</label>
            <div className="relative">
              <input
                id="filtro-zona"
                data-testid="filtro-zona"
                type="text"
                inputMode="search"
                enterKeyHint="search"
                maxLength={80}
                value={local.zona}
                onChange={(e) => setLocal((p) => ({ ...p, zona: e.target.value }))}
                placeholder={city ? `Zona, quartiere o via (es. Pigneto, via del Corso)` : "Zona, quartiere, via o città"}
                className="min-h-11 w-full rounded-btn border border-border bg-white px-3.5 pr-10 text-base font-sans text-text placeholder:text-text-muted focus:border-brand focus:outline-none"
              />
              {local.zona && (
                <button type="button" aria-label="Cancella la zona" onClick={() => setLocal((p) => ({ ...p, zona: "" }))} className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-text-muted">✕</button>
              )}
            </div>
            {city && (
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" data-testid="zone-suggerite">
                <button type="button" aria-pressed={local.zona === city} onClick={() => setLocal((p) => ({ ...p, zona: p.zona === city ? "" : city }))} className={`${chip(local.zona === city)} shrink-0`}>
                  Tutta {city}
                </button>
                {(ZONE[city] ?? []).map((z) => (
                  <button key={z} type="button" aria-pressed={local.zona === z} onClick={() => setLocal((p) => ({ ...p, zona: p.zona === z ? "" : z }))} className={`${chip(local.zona === z)} shrink-0`}>
                    {z}
                  </button>
                ))}
              </div>
            )}
            <p className="mt-1.5 text-xs font-sans text-text-muted">
              {local.zona.trim() ? "Cerco lì, anche se la mappa è altrove." : "Vuoto: cerco intorno alla mappa."}
            </p>
          </section>

          {/* Distanza: misurata dalla mappa, quindi solo senza una zona scritta */}
          {!local.zona.trim() && (
          <section>
            <span className="font-display text-sm font-semibold text-text block mb-2">Quanto lontano?</span>
            <div className="flex flex-wrap gap-2">
              {DISTANCE_OPTIONS.map(({ label, value }) => (
                <button key={label} type="button" aria-pressed={local.radiusKm === value} onClick={() => setLocal((p) => ({ ...p, radiusKm: value }))} className={chip(local.radiusKm === value)}>
                  {label}
                </button>
              ))}
            </div>
          </section>
          )}

          {/* Caratteristiche: più scelte insieme */}
          <section data-testid="filtri-caratteristiche">
            <span className="font-display text-sm font-semibold text-text block mb-2">Cosa deve avere?</span>
            <div className="flex flex-wrap gap-2">
              {optionChips(visible(FEATURES, allFeatures, local.features), (id) => local.features.includes(id), (id) => toggleIn("features", id))}
              {moreButton(FEATURES, allFeatures, () => setAllFeatures((v) => !v), "caratteristiche-tutte")}
            </div>
          </section>

          {/* Prezzo */}
          <section>
            <span className="font-display text-sm font-semibold text-text block mb-2">Prezzo</span>
            <div className="flex flex-wrap gap-2">
              {PRICE_LEVELS.map(({ label, value }) => {
                const selected = local.minPriceLevel === value && local.maxPriceLevel === value;
                return (
                  <button key={value} type="button" aria-pressed={selected} onClick={() => setPriceLevel(value)} className={chip(selected)}>
                    {label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Valutazione */}
          <section>
            <span className="font-display text-sm font-semibold text-text block mb-2">Voto su Google</span>
            <div className="flex flex-wrap gap-2">
              {/* Valori vecchi (1–3 stelle) restano validi: "Tutti" è scelto solo se non c'è un minimo. */}
              {RATING_OPTIONS.map(({ label, value }) => (
                <button key={label} type="button" aria-pressed={local.minRating === value} onClick={() => setLocal((p) => ({ ...p, minRating: value }))} className={chip(local.minRating === value)}>
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* Recensioni */}
          <section>
            <span className="font-display text-sm font-semibold text-text block mb-2">
              Recensioni minime
            </span>
            <div className="flex gap-2 flex-wrap">
              {REVIEW_OPTIONS.map(({ label, value }) => (
                <button key={label} type="button" aria-pressed={local.minReviews === value} onClick={() => setLocal((p) => ({ ...p, minReviews: value }))} className={chip(local.minReviews === value)}>
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* Quando: aperti adesso o a un'ora scelta (orari di Google) */}
          <section data-testid="filtri-quando">
            <span className="font-display text-sm font-semibold text-text block mb-2">Aperto quando?</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={!local.openNowOnly && !local.openAt} onClick={() => setLocal((p) => ({ ...p, openNowOnly: false, openAt: null }))} className={chip(!local.openNowOnly && !local.openAt)}>
                Qualsiasi
              </button>
              <button type="button" aria-pressed={local.openNowOnly && !local.openAt} onClick={() => setLocal((p) => ({ ...p, openNowOnly: !(p.openNowOnly && !p.openAt), openAt: null }))} className={chip(local.openNowOnly && !local.openAt)}>
                Adesso
              </button>
              {OPEN_AT.map(({ id, label }) => (
                <button key={id} type="button" aria-pressed={local.openAt === id} onClick={() => setLocal((p) => ({ ...p, openNowOnly: false, openAt: p.openAt === id ? null : id }))} className={chip(local.openAt === id)}>
                  {label}
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-border bg-surface px-5 py-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          <button
            type="button"
            // Prima si chiude il pannello, poi si cerca: nei salvati la lista si apre subito
            // e un CLOSE dopo la richiuderebbe.
            onClick={() => { trackFeature("filtri"); onClose(); onApply(local); }}
            className="w-full rounded-pill bg-brand py-3 font-display text-base font-semibold text-white hover:opacity-90 active:scale-95 transition-transform"
          >
            {active > 0 ? `Applica filtri (${active})` : "Applica filtri"}
          </button>
        </div>
      </div>
    </>
  );
}
