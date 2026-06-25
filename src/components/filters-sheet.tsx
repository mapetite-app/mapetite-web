"use client";

import { useEffect, useState } from "react";
import { Star, X } from "lucide-react";

export type Filters = {
  radiusKm: number | null;
  minRating: number | null;
  minPriceLevel: number | null;
  maxPriceLevel: number | null;
  minReviews: number | null;
  openNowOnly: boolean;
  categories: string[];
};

export const EMPTY_FILTERS: Filters = {
  radiusKm: null,
  minRating: null,
  minPriceLevel: null,
  maxPriceLevel: null,
  minReviews: null,
  openNowOnly: false,
  categories: [],
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

export function countActive(f: Filters): number {
  let n = 0;
  if (f.radiusKm != null) n++;
  if (f.minRating != null) n++;
  if (f.minPriceLevel != null || f.maxPriceLevel != null) n++;
  if (f.minReviews != null) n++;
  if (f.openNowOnly) n++;
  if (f.categories.length > 0) n++;
  return n;
}

const REVIEW_OPTIONS: { label: string; value: number | null }[] = [
  { label: "Tutte", value: null },
  { label: "50+", value: 50 },
  { label: "200+", value: 200 },
  { label: "500+", value: 500 },
];

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
}: {
  isOpen: boolean;
  filters: Filters;
  onApply: (f: Filters) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState<Filters>(filters);

  useEffect(() => {
    if (isOpen) setLocal(filters);
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
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-lg flex-col rounded-t-[24px] bg-surface shadow-float max-h-[85vh]">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 pt-1">
          <span className="font-display text-lg font-semibold text-text">Filtri</span>
          <button
            type="button"
            onClick={() => setLocal(EMPTY_FILTERS)}
            className="font-display text-sm text-text-muted hover:text-text"
          >
            Reset
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-6">

          {/* Distanza */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <span className="font-display text-sm font-semibold text-text">Distanza massima</span>
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-text-muted">
                  {local.radiusKm == null ? "Qualsiasi" : `${local.radiusKm} km`}
                </span>
                {local.radiusKm != null && (
                  <button
                    type="button"
                    onClick={() => setLocal((p) => ({ ...p, radiusKm: null }))}
                    className="text-text-muted hover:text-text"
                    aria-label="Rimuovi filtro distanza"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
            <input
              type="range"
              min={1}
              max={20}
              step={1}
              value={local.radiusKm ?? 5}
              onChange={(e) =>
                setLocal((p) => ({ ...p, radiusKm: Number(e.target.value) }))
              }
              className="w-full accent-[var(--color-accent)]"
            />
          </section>

          {/* Valutazione */}
          <section>
            <span className="font-display text-sm font-semibold text-text block mb-2">
              Valutazione minima
            </span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => {
                const filled = local.minRating != null && n <= local.minRating;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() =>
                      setLocal((p) => ({
                        ...p,
                        minRating: p.minRating === n ? null : n,
                      }))
                    }
                    aria-label={`${n} stelle`}
                  >
                    <Star
                      size={28}
                      className={filled ? "text-amber-400 fill-amber-400" : "text-text-muted"}
                    />
                  </button>
                );
              })}
            </div>
          </section>

          {/* Prezzo */}
          <section>
            <span className="font-display text-sm font-semibold text-text block mb-2">Prezzo</span>
            <div className="flex gap-2">
              {PRICE_LEVELS.map(({ label, value }) => {
                const selected = local.minPriceLevel === value && local.maxPriceLevel === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPriceLevel(value)}
                    className={[
                      "rounded-pill border px-4 py-1.5 text-sm font-display font-medium transition-colors",
                      selected
                        ? "bg-accent-light text-accent border-accent"
                        : "bg-surface text-text border-border hover:border-text-muted",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Recensioni */}
          <section>
            <span className="font-display text-sm font-semibold text-text block mb-2">
              Recensioni minime
            </span>
            <div className="flex gap-2 flex-wrap">
              {REVIEW_OPTIONS.map(({ label, value }) => {
                const selected = local.minReviews === value;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setLocal((p) => ({ ...p, minReviews: value }))}
                    className={[
                      "rounded-pill border px-4 py-1.5 text-sm font-display font-medium transition-colors",
                      selected
                        ? "bg-accent-light text-accent border-accent"
                        : "bg-surface text-text border-border hover:border-text-muted",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Solo aperti */}
          <section>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="font-display text-sm font-semibold text-text">
                Solo aperti adesso
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={local.openNowOnly}
                onClick={() => setLocal((p) => ({ ...p, openNowOnly: !p.openNowOnly }))}
                className={[
                  "relative inline-flex h-6 w-11 items-center rounded-full border-2 transition-colors",
                  local.openNowOnly
                    ? "bg-accent border-accent"
                    : "bg-surface border-border",
                ].join(" ")}
              >
                <span
                  className={[
                    "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
                    local.openNowOnly ? "translate-x-5" : "translate-x-0.5",
                  ].join(" ")}
                />
              </button>
            </label>
          </section>

          {/* Categorie */}
          <section>
            <span className="font-display text-sm font-semibold text-text block mb-2">
              Categorie
            </span>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(({ id, label, emoji }) => {
                const selected = local.categories.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleCategory(id)}
                    className={[
                      "rounded-pill border px-3 py-1.5 text-sm font-display transition-colors flex items-center gap-1",
                      selected
                        ? "bg-accent-light text-accent border-accent"
                        : "bg-surface text-text border-border hover:border-text-muted",
                    ].join(" ")}
                  >
                    <span>{emoji}</span>
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-border bg-surface px-5 py-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          <button
            type="button"
            onClick={() => { onApply(local); onClose(); }}
            className="w-full rounded-pill bg-brand py-3 font-display text-base font-semibold text-white hover:opacity-90 active:scale-95 transition-transform"
          >
            {active > 0 ? `Applica filtri (${active})` : "Applica filtri"}
          </button>
        </div>
      </div>
    </>
  );
}
