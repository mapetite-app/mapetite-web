"use client";

import { Footprints, Navigation } from "lucide-react";
import AssistantPlaceCard, { priceOf, ratingOf, type Card, type SaveState } from "./assistente-card";
import SerataMappaLazy from "@/components/serata-mappa-lazy";
import { categoryLabel } from "@/lib/category-label";
import { getCategoryEmoji } from "@/lib/emoji";
import { googleMapsRoute, walkLabel, walkOf } from "@/lib/serata";

// Serata completa a tappe (piano 1.2): per ogni tappa il locale scelto e 1–2 alternative,
// distanze a piedi stimate tra le tappe, mini mappa e il percorso in Google Maps.

export type SerataTappa = {
  kind: string;
  label: string;
  emoji: string;
  query: string;
  status: "loading" | "verdicts" | "done" | "error";
  pool: Card[];            // candidati in ordine (vicini alla tappa prima, poi gli altri)
  chosenId: string | null; // il locale scelto per la tappa
  error?: string | null;
};
export type Serata = { zona: string | null; tappe: SerataTappa[]; tagliate?: string[] };

export function chosenOf(t: SerataTappa): Card | null {
  return t.pool.find((p) => p.id === t.chosenId) ?? t.pool[0] ?? null;
}

export default function SerataView({ serata, savedIds, saving, bookingMode, onOpen, onSave, onBook, onChoose, onRoute }: {
  serata: Serata;
  savedIds: Set<string>;
  saving: Record<string, SaveState>;
  bookingMode: boolean;
  onOpen: (p: Card) => void;
  onSave: (p: Card) => void;
  onBook: (p: Card) => void;
  onChoose: (tappa: number, id: string) => void;
  onRoute: () => void;
}) {
  const chosen = serata.tappe.map(chosenOf);
  const stops = chosen.filter((c): c is Card => !!c).map((c) => ({ id: c.id, name: c.name, lat: c.lat, lng: c.lng }));
  const route = googleMapsRoute(stops);
  return (
    <section data-testid="serata" className="mt-3">
      {stops.length > 0 && <SerataMappaLazy stops={stops} className="h-44" />}
      <ol className="mt-3 flex flex-col">
        {serata.tappe.map((t, i) => {
          const c = chosen[i];
          const prev = i > 0 ? chosen[i - 1] : null;
          const next = i < serata.tappe.length - 1 ? chosen[i + 1] : null;
          const alts = t.pool.filter((p) => p.id !== c?.id).slice(0, 2);
          return (
            <li key={t.kind} data-testid="serata-tappa" className="relative">
              <p className="flex items-center gap-2 font-display text-[15px] font-semibold text-brand">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">{i + 1}</span>
                <span aria-hidden>{t.emoji}</span> {t.label}
                {t.status === "loading" && <span data-testid="serata-attesa" className="ml-1 text-xs font-sans font-normal text-text-muted">cerco…</span>}
              </p>
              {t.status === "loading" ? (
                <div aria-hidden className="mt-2 h-[190px] animate-pulse rounded-card bg-surface" />
              ) : !c ? (
                <p className="mt-2 text-sm font-sans text-text-muted">
                  {t.error ?? `Non ho trovato posti per questa tappa${serata.zona ? ` a ${serata.zona}` : ""}.`}
                </p>
              ) : (
                <>
                  <div data-testid="serata-scelto" className="relative mt-2">
                    <AssistantPlaceCard
                      p={c}
                      photo
                      showOpen={false}
                      waitingVerdict={t.status === "verdicts"}
                      bookingMode={bookingMode}
                      saved={savedIds.has(c.id)}
                      saving={saving[c.id]}
                      onOpen={() => onOpen(c)}
                      onSave={() => onSave(c)}
                      onBook={() => onBook(c)}
                      minH="min-h-[190px]"
                    />
                  </div>
                  {alts.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-display font-semibold uppercase tracking-wide text-text-muted">Oppure</p>
                      <ul className="mt-1 flex flex-col gap-1.5">
                        {alts.map((a) => (
                          <li key={a.id} data-testid="serata-alternativa" className="flex items-center gap-2 rounded-card border border-border bg-surface py-1.5 pl-3 pr-1.5">
                            <button type="button" onClick={() => onOpen(a)} aria-label={`Apri ${a.name}`} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left">
                              <span aria-hidden className="text-lg">{getCategoryEmoji(a.category, a.name)}</span>
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-display font-semibold text-text">{a.name}</span>
                                <span className="block truncate text-xs font-sans text-text-muted">
                                  {[categoryLabel(a.category), ratingOf(a.rating), prev ? `${walkOf(prev, a).minutes} min a piedi` : priceOf(a.priceLevel)].filter(Boolean).join(" · ")}
                                </span>
                              </span>
                            </button>
                            <button
                              type="button"
                              data-testid="serata-scegli"
                              onClick={() => onChoose(i, a.id)}
                              aria-label={`Scegli ${a.name} per ${t.label.toLowerCase()}`}
                              className="min-h-10 shrink-0 rounded-pill border border-brand/40 bg-white px-3 text-sm font-display font-semibold text-brand active:scale-95"
                            >
                              Scegli
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
              {next && c && (
                <p data-testid="serata-distanza" className="my-3 ml-3 flex items-center gap-2 border-l-2 border-dashed border-brand/30 py-2 pl-4 text-sm font-sans font-medium text-brand">
                  <Footprints size={16} aria-hidden className="shrink-0" />
                  {walkLabel(walkOf(c, next))}
                </p>
              )}
              {!(next && c) && i < serata.tappe.length - 1 && <div className="h-4" />}
            </li>
          );
        })}
      </ol>
      {route && stops.length > 1 && (
        <a
          href={route}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="serata-google-maps"
          onClick={onRoute}
          className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-pill bg-brand px-4 text-[15px] font-display font-semibold text-white active:scale-[0.99]"
        >
          <Navigation size={17} aria-hidden /> Apri il percorso in Google Maps
        </a>
      )}
      <p data-testid="serata-stima" className="mt-2 text-xs font-sans leading-relaxed text-text-muted">
        Distanze e minuti a piedi sono stime in linea d&apos;aria: il percorso vero lo calcola Google Maps.
        {serata.tagliate && serata.tagliate.length > 0 ? ` Al massimo 3 tappe: ho lasciato fuori ${serata.tagliate.join(", ").toLowerCase()}.` : ""}
      </p>
    </section>
  );
}
