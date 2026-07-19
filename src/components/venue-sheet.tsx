"use client";

import { X, Quote, Navigation, Globe, Phone } from "lucide-react";
import { getCategoryEmoji } from "@/lib/emoji";

export type Venue = {
  id: string;
  name: string;
  address: string | null;
  category: string | null;
  rating: number | null;
  userRatingCount: number | null;
  priceLevel: number | null;
  openNow: boolean | null;
  websiteUri: string | null;
  phone: string | null;
  lat: number;
  lng: number;
  selectedReviews: { text: string }[] | null;
  synthesis: string | null;
  tags: string[] | null;
  verdict: string | null;
  goFor: string | null;
  dontExpect: string | null;
  personalTags: string[] | null;
  personalNote: string | null;
};

type VenueSheetProps = {
  venue: Venue;
  isSaved: boolean;
  canEdit: boolean; // true solo in vista "saved"
  onEdit: () => void;
  onClose: () => void;
  saveSlot: React.ReactNode; // <SaveButton .../> renderizzato da map-view
  communitySlot: React.ReactNode; // recensioni Mapetite + ReviewForm, da map-view
};

export default function VenueSheet({
  venue,
  isSaved,
  canEdit,
  onEdit,
  onClose,
  saveSlot,
  communitySlot,
}: VenueSheetProps) {
  const {
    name,
    address,
    category,
    rating,
    userRatingCount,
    priceLevel,
    openNow,
    websiteUri,
    phone,
    lat,
    lng,
    selectedReviews,
    synthesis,
    tags,
    verdict,
    goFor,
    dontExpect,
    personalTags,
    personalNote,
  } = venue;

  const hasReviews = selectedReviews != null && selectedReviews.length > 0;
  // Verdetto bipolare: mostrati solo se non vuoti. dont_expect è spesso "" per
  // il vincolo feroce lato prompt → resta nascosto. Se entrambi vuoti (cache
  // vecchia) il blocco degrada al verdict singolo, come prima.
  const verdictText =
    verdict != null && verdict.trim() !== "" ? verdict.trim() : null;
  const goForText = goFor != null && goFor.trim() !== "" ? goFor.trim() : null;
  const dontExpectText =
    dontExpect != null && dontExpect.trim() !== "" ? dontExpect.trim() : null;
  // Il blocco appare se ALMENO UNO tra verdict e i due poli è presente: il
  // prompt bipolare può produrre goFor/dontExpect anche con verdict vuoto.
  const hasVerdictBlock =
    verdictText != null || goForText != null || dontExpectText != null;
  const hasTags = tags != null && tags.length > 0;
  const hasPersonalTags = personalTags != null && personalTags.length > 0;
  const showPersonalBlock =
    isSaved && (hasPersonalTags || personalNote != null || canEdit);
  const priceLabel =
    priceLevel != null && priceLevel > 0 ? "€".repeat(priceLevel) : null;

  return (
    <div className="relative flex max-h-full flex-col overflow-y-auto rounded-card bg-surface shadow-float">
      {/* 1. HEADER */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Chiudi"
        className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-surface text-text-muted shadow-card hover:text-text"
      >
        <X size={18} />
      </button>

      <div className="px-5 pt-5">
        <span
          role="img"
          aria-label={category ?? "locale"}
          className="text-4xl leading-none"
        >
          {getCategoryEmoji(category, name)}
        </span>
        <h2 className="mt-2 pr-8 font-display text-2xl font-semibold text-brand">
          {name}
        </h2>

        {/* Riga meta compatta */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-sans text-text-muted">
          {rating != null && (
            <span className="inline-flex items-center gap-0.5">
              <span className="text-star">★</span>
              <span className="font-display font-semibold text-text">
                {rating.toLocaleString("it-IT", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}
              </span>
              {userRatingCount != null && <span>({userRatingCount})</span>}
            </span>
          )}
          {priceLabel && (
            <>
              <span aria-hidden>·</span>
              <span className="font-display text-text">{priceLabel}</span>
            </>
          )}
          {openNow != null && (
            <>
              <span aria-hidden>·</span>
              <span
                className={
                  openNow
                    ? "rounded-pill bg-success/15 px-2 py-0.5 text-xs font-display font-semibold text-success"
                    : "rounded-pill bg-error/10 px-2 py-0.5 text-xs font-display font-semibold text-error"
                }
              >
                {openNow ? "Aperto" : "Chiuso"}
              </span>
            </>
          )}
        </div>

        {address && (
          <p className="mt-1 text-xs font-sans text-text-muted">{address}</p>
        )}
      </div>

      {/* 2. BLOCCO VERDICT */}
      {hasVerdictBlock && (
        <div className="mx-5 mt-4 rounded-card bg-brand p-5 shadow-card">
          <p className="text-xs font-display font-semibold uppercase tracking-wide text-accent">
            Il verdetto Mapetite
          </p>
          {verdictText && (
            <p className="mt-2 font-display text-xl font-semibold leading-relaxed text-white">
              {verdictText}
            </p>
          )}
          {synthesis != null && (
            <p className="mt-2 font-sans text-sm leading-relaxed text-white/80">
              {synthesis}
            </p>
          )}

          {/* Verdetto bipolare: orientamento, mai stroncatura. */}
          {goForText && (
            <div className="mt-4 border-t border-white/15 pt-3">
              <p className="text-xs font-display font-semibold uppercase tracking-wide text-accent">
                Ci dovresti andare se…
              </p>
              <p className="mt-1 font-sans text-sm leading-relaxed text-white">
                {goForText}
              </p>
            </div>
          )}
          {dontExpectText && (
            <div className="mt-3">
              <p className="text-xs font-display font-semibold uppercase tracking-wide text-white/60">
                Non aspettarti…
              </p>
              <p className="mt-1 font-sans text-sm leading-relaxed text-white/80">
                {dontExpectText}
              </p>
            </div>
          )}
        </div>
      )}

      {/* 3. TAG AI */}
      {hasTags && (
        <div className="mt-4 flex flex-wrap gap-1.5 px-5">
          {tags!.map((tag) => (
            <span
              key={tag}
              className="rounded-pill bg-accent/10 px-2.5 py-1 text-xs font-display font-medium text-accent"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* 4. LE TUE NOTE */}
      {showPersonalBlock && (
        <div className="mx-5 mt-4 rounded-card border-2 border-accent/30 bg-surface p-4">
          <p className="text-xs font-display font-semibold uppercase tracking-wide text-accent">
            Le tue note
          </p>
          {hasPersonalTags && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {personalTags!.map((tag) => (
                <span
                  key={tag}
                  className="rounded-pill border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-display font-medium text-accent"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          {personalNote != null && (
            <p className="mt-2 font-sans italic text-text">{personalNote}</p>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="mt-3 rounded-btn border border-border px-3 py-1 text-xs font-display font-semibold text-text-muted hover:text-text"
            >
              Modifica
            </button>
          )}
        </div>
      )}

      {/* 5. COMMUNITY — recensioni Mapetite + ReviewForm */}
      {communitySlot && (
        <div className="mt-5 border-t border-border px-5 pt-4">
          <h3 className="font-display text-base font-semibold text-brand">
            Recensioni Mapetite
          </h3>
          <div className="mt-2">{communitySlot}</div>
        </div>
      )}

      {/* 6. COSA DICONO — recensioni Google */}
      {hasReviews && (
        <div className="mt-5 px-5">
          <h3 className="font-display text-base font-semibold text-brand">
            Cosa dicono
          </h3>
          <div className="mt-2 flex flex-col gap-2">
            {selectedReviews!.map((review, i) => (
              <div
                key={i}
                className="rounded-card border border-border bg-surface p-3 shadow-card"
              >
                <Quote size={14} className="text-text-muted" />
                <p className="mt-1 font-sans text-sm leading-relaxed text-text">
                  {review.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. ACTION PILLS */}
      {/* padding-bottom = pb-5 (1.25rem) + offset nav mobile, così le pill risalgono sopra la nav */}
      <div
        className="mt-5 flex flex-wrap items-center gap-2 px-5"
        style={{ paddingBottom: "calc(1.25rem + var(--nav-height-mobile))" }}
      >
        {saveSlot}

        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-4 py-2 text-sm font-display font-semibold text-brand hover:shadow-card"
        >
          <Navigation size={16} />
          Indicazioni
        </a>

        {websiteUri != null && (
          <a
            href={websiteUri}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-4 py-2 text-sm font-display font-semibold text-brand hover:shadow-card"
          >
            <Globe size={16} />
            Sito
          </a>
        )}

        {phone != null && (
          <a
            href={`tel:${phone}`}
            className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-4 py-2 text-sm font-display font-semibold text-brand hover:shadow-card"
          >
            <Phone size={16} />
            Chiama
          </a>
        )}
      </div>
    </div>
  );
}
