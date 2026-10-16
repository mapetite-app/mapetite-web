"use client";

import type { ReactNode } from "react";
import { Bookmark, BookmarkCheck, CalendarCheck } from "lucide-react";
import type { Venue } from "@/components/venue-sheet";
import PlacePhoto from "@/components/place-photo";
import { getCategoryEmoji } from "@/lib/emoji";
import { categoryLabel } from "@/lib/category-label";

// La card di un locale nell'assistente: foto, verdetto, Salva e Prenota. La usano sia i
// risultati (carosello) sia le tappe della serata completa.
export type Card = Venue & { editorialSummary?: string | null };
export type SaveState = "saving" | "error";

export const priceOf = (n: number | null) => (n != null && n > 0 ? "€".repeat(n) : null);
export const ratingOf = (r: number | null) => (r != null ? `★ ${r.toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}` : null);

export default function AssistantPlaceCard({ p, photo, showOpen, waitingVerdict, bookingMode, saved, saving, onOpen, onSave, onBook, badge, minH = "min-h-[220px]" }: {
  p: Card; photo: boolean; showOpen: boolean; waitingVerdict: boolean; bookingMode: boolean;
  saved: boolean; saving: SaveState | undefined;
  onOpen: () => void; onSave: () => void; onBook: () => void;
  badge?: ReactNode; minH?: string;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Apri ${p.name}`}
        className={`relative flex h-full ${minH} w-full flex-col overflow-hidden rounded-card bg-brand p-4 pb-16 text-left text-white shadow-float active:scale-[0.99]`}
      >
        {photo && p.photoRef && (
          <>
            <PlacePhoto photoRef={p.photoRef} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-brand via-brand/75 to-brand/20" />
          </>
        )}
        <span className="relative flex flex-1 flex-col">
          <span className="flex items-start justify-between gap-2">
            {badge ?? <span className="text-2xl leading-none" aria-hidden>{getCategoryEmoji(p.category, p.name)}</span>}
            {showOpen && p.openNow != null && (
              <span className={`rounded-pill px-2 py-0.5 text-[10px] font-display font-medium ${p.openNow ? "bg-white/15" : "bg-black/30 text-white/80"}`}>
                {p.openNow ? "Aperto ora" : "Chiuso ora"}
              </span>
            )}
          </span>
          <span className="mt-auto pt-6 line-clamp-2 font-title text-lg font-semibold leading-snug">{p.name}</span>
          <span className="mt-0.5 truncate text-[13px] font-sans font-medium text-white/85">
            {[categoryLabel(p.category), priceOf(p.priceLevel), ratingOf(p.rating)].filter(Boolean).join(" · ")}
          </span>
          {p.verdict ? (
            <span className="mt-2 block">
              <span data-testid="assistente-verdetto" className="block text-[10px] font-display font-semibold uppercase tracking-wide text-accent">Il verdetto Mapetite</span>
              <span className="mt-0.5 line-clamp-2 text-sm font-sans font-medium leading-snug text-white">{p.verdict}</span>
            </span>
          ) : waitingVerdict ? (
            <span data-testid="assistente-verdetto-attesa" className="mt-2 block space-y-1.5" aria-label="Preparo il verdetto">
              <span className="block h-2.5 w-24 animate-pulse rounded bg-white/25" />
              <span className="block h-3 w-full animate-pulse rounded bg-white/20" />
            </span>
          ) : p.editorialSummary ? (
            <span className="mt-2 line-clamp-2 text-sm font-sans leading-snug text-white/80">{p.editorialSummary}</span>
          ) : null}
        </span>
      </button>
      {/* Salva in un tocco ("📌 Voglio andarci", come il segnalibro della mappa) e Prenota. */}
      <div className="absolute bottom-3 left-3 right-3 flex gap-2">
        {saved ? (
          <span
            role="status"
            data-testid="assistente-salvato"
            aria-label={`${p.name} è nei tuoi salvati`}
            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-pill bg-white text-sm font-display font-semibold text-brand"
          >
            <BookmarkCheck size={16} aria-hidden /> Salvato
          </span>
        ) : (
          <button
            type="button"
            data-testid="assistente-salva"
            onClick={onSave}
            disabled={saving === "saving"}
            aria-label={`Salva ${p.name} tra i Voglio andarci`}
            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-pill bg-white/15 text-sm font-display font-semibold text-white backdrop-blur active:scale-[0.98] disabled:opacity-80"
          >
            <Bookmark size={16} aria-hidden />
            {saving === "saving" ? "Salvo…" : saving === "error" ? "Riprova" : "Salva"}
          </button>
        )}
        {(p.phone || p.websiteUri) && (
          <button
            type="button"
            data-testid="assistente-prenota"
            onClick={onBook}
            aria-label={`Prenota da ${p.name}`}
            className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-pill text-sm font-display font-semibold active:scale-[0.98] ${bookingMode ? "bg-accent text-white" : "bg-white/15 text-white backdrop-blur"}`}
          >
            <CalendarCheck size={16} aria-hidden /> Prenota
          </button>
        )}
      </div>
    </>
  );
}
