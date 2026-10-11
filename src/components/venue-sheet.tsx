"use client";

import { X, Quote, Navigation, Globe, Phone, Check, Share2, Footprints } from "lucide-react";
import { useState } from "react";
import { useBeta, useSchedaVariant } from "@/lib/beta";
import PlacePhoto from "@/components/place-photo";
import { getCategoryEmoji } from "@/lib/emoji";
import { distanceLabel, walkMinutes } from "@/lib/distance";
import { categoryLabel } from "@/lib/category-label";
import { cityFromAddress } from "@/lib/city";

const TILE =
  "flex min-h-[52px] min-w-16 flex-col items-center justify-center gap-0.5 rounded-xl bg-white/10 px-3 py-1.5 text-[11px] font-display font-semibold text-white active:scale-95";

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
  goFor: string[] | null;
  dontExpect: string[] | null;
  matchReason: string | null;
  personalTags: string[] | null;
  personalNote: string | null;
  photoRef?: string | null;
};

type VenueSheetProps = {
  venue: Venue;
  isSaved: boolean;
  canEdit: boolean; // true solo in vista "saved"
  onEdit: () => void;
  onClose: () => void;
  saveSlot: React.ReactNode; // <SaveButton .../> renderizzato da map-view
  communitySlot: React.ReactNode; // recensioni Mapetite + ReviewForm, da map-view
  userPos?: { lat: number; lng: number } | null; // posizione reale dell'utente, per i minuti a piedi
};

export default function VenueSheet({
  venue,
  isSaved,
  canEdit,
  onEdit,
  onClose,
  saveSlot,
  communitySlot,
  userPos = null,
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
    matchReason,
    personalTags,
    personalNote,
  } = venue;

  const shareOn = useBeta("condividi");
  const [shareNote, setShareNote] = useState<string | null>(null);
  const share = async () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${encodeURIComponent(venue.id)}`;
    const text = verdict ? `${name} — ${verdict}` : name;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: name, text, url });
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setShareNote("Link copiato");
        setTimeout(() => setShareNote(null), 2500);
      }
    } catch {
      // l'utente ha chiuso il foglio di condivisione: nessun errore da mostrare
    }
  };

  const hasReviews = selectedReviews != null && selectedReviews.length > 0;
  // Verdetto bipolare come CHIP: filtra gli elementi non vuoti dell'array.
  // dont_expect è spesso [] per il vincolo feroce lato prompt → resta nascosto.
  const matchReasonText =
    matchReason != null && matchReason.trim() !== "" ? matchReason.trim() : null;
  const verdictText =
    verdict != null && verdict.trim() !== "" ? verdict.trim() : null;
  const goForChips = Array.isArray(goFor)
    ? goFor.filter((c) => c != null && c.trim() !== "").map((c) => c.trim())
    : [];
  const dontExpectChips = Array.isArray(dontExpect)
    ? dontExpect.filter((c) => c != null && c.trim() !== "").map((c) => c.trim())
    : [];
  // La card appare se c'è ALMENO UNO tra verdict, synthesis, matchReason e i due
  // poli: tutto vive ora in un'unica card teal (matchReason incluso, niente più
  // banner esterno).
  const hasVerdictBlock =
    verdictText != null ||
    synthesis != null ||
    matchReasonText != null ||
    goForChips.length > 0 ||
    dontExpectChips.length > 0;
  const hasTags = tags != null && tags.length > 0;
  const hasPersonalTags = personalTags != null && personalTags.length > 0;
  const showPersonalBlock =
    isSaved && (hasPersonalTags || personalNote != null || canEdit);
  const priceLabel =
    priceLevel != null && priceLevel > 0 ? "€".repeat(priceLevel) : null;
  // Come Places: se il locale è raggiungibile a piedi, il pulsante percorso mostra i minuti.
  const walk = userPos ? walkMinutes(userPos, { lat, lng }) : null;
  const variant = useSchedaVariant();
  const emoji = getCategoryEmoji(category, name);
  // Righe di contesto della variante B: "Roma · 600 m" e "Cocktail bar · €€ · ★ 4,5 (812)".
  const placeLine = [cityFromAddress(address), userPos ? distanceLabel(userPos, { lat, lng }) : null]
    .filter(Boolean)
    .join(" · ");
  const kindLine = [
    categoryLabel(category),
    priceLabel,
    rating != null
      ? `★ ${rating.toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${userRatingCount != null ? ` (${userRatingCount})` : ""}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="relative flex flex-col rounded-card bg-surface shadow-float">
      {variant === "a" && (
        <>
        {/* 1. HEADER */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-surface text-text-muted shadow-card hover:text-text"
        >
          <X size={18} />
        </button>

        {venue.photoRef && (
          <PlacePhoto
            photoRef={venue.photoRef}
            alt={name}
            width={700}
            priority
            className="h-44 w-full rounded-t-card object-cover"
          />
        )}
        <div className="px-5 pt-5">
          <span
            role="img"
            aria-label={category ?? "locale"}
            className="text-4xl leading-none"
          >
            {getCategoryEmoji(category, name)}
          </span>
          <h2 className="mt-2 pr-8 font-title text-2xl font-semibold in-data-[titoli=serif]:text-[2.1rem] in-data-[titoli=serif]:leading-tight text-brand">
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

        {/* 2. CARD VERDETTO (teal): verdetto + matchReason + chip, tutto dentro. */}
        {hasVerdictBlock && (
          <div className="mx-5 mt-4 rounded-card bg-brand p-5 shadow-card">
            {(verdictText != null || synthesis != null) && (
              <>
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
              </>
            )}

            {/* matchReason al centro: solo nei risultati (null nei salvati → niente
                riga né separatore orfano). Separatore solo se c'è contenuto sopra. */}
            {matchReasonText && (
              <div
                className={
                  verdictText != null || synthesis != null
                    ? "mt-4 border-t border-white/15 pt-3"
                    : ""
                }
              >
                <p className="text-xs font-display font-semibold uppercase tracking-wide text-accent">
                  ✦ Per la tua ricerca
                </p>
                <p className="mt-1 font-sans text-sm leading-relaxed text-white/90">
                  {matchReasonText}
                </p>
              </div>
            )}

            {/* Chip bipolari in fondo, colori su-teal: orientamento, mai stroncatura. */}
            {goForChips.length > 0 && (
              <div
                className={
                  verdictText != null || synthesis != null || matchReasonText != null
                    ? "mt-4 border-t border-white/15 pt-3"
                    : ""
                }
              >
                <p className="text-xs font-display font-semibold uppercase tracking-wide text-white/80">
                  Ci dovresti andare se
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {goForChips.map((chip) => (
                    <span
                      key={chip}
                      className="inline-flex items-center gap-1 rounded-pill bg-white/15 px-2.5 py-1 text-xs font-display font-medium text-white"
                    >
                      <Check size={12} className="shrink-0" />
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {dontExpectChips.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-display font-semibold uppercase tracking-wide text-white/60">
                  Meno adatto se
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {dontExpectChips.map((chip) => (
                    <span
                      key={chip}
                      className="inline-flex items-center gap-1 rounded-pill bg-white/10 px-2.5 py-1 text-xs font-display font-medium text-white/60"
                    >
                      <X size={12} className="shrink-0" />
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        </>
      )}
      {variant === "b" && (
        <>
          {/* B (stile Places): foto grande con chiudi e condividi sopra, poi nome grande e righe di contesto. */}
          <div className="relative">
            {venue.photoRef ? (
              <PlacePhoto
                photoRef={venue.photoRef}
                alt={name}
                width={800}
                priority
                className="h-72 w-full rounded-t-card object-cover"
                fallback={<div className="flex h-40 items-center justify-center rounded-t-card bg-brand/10 text-6xl">{emoji}</div>}
              />
            ) : (
              <div className="flex h-40 items-center justify-center rounded-t-card bg-brand/10 text-6xl">{emoji}</div>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Chiudi"
              className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur"
            >
              <X size={20} />
            </button>
            {shareOn && (
              <button
                type="button"
                onClick={share}
                aria-label={`Condividi ${name}`}
                className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur"
              >
                <Share2 size={18} />
              </button>
            )}
          </div>
          <div className="px-5 pt-5">
            <h2 className="font-title text-3xl font-semibold leading-tight text-text in-data-[titoli=serif]:text-[2.4rem]">
              {name}
            </h2>
            {placeLine && <p className="mt-2 text-[15px] font-sans text-text-muted">{placeLine}</p>}
            {kindLine && <p className="mt-0.5 text-[15px] font-sans text-text-muted">{kindLine}</p>}
            {shareNote && <p role="status" className="mt-1 text-xs font-sans text-text-muted">{shareNote}</p>}
            {openNow != null && (
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-pill border border-border bg-white px-3 py-1 text-sm font-sans text-text">
                <span aria-hidden className={`h-2 w-2 rounded-full ${openNow ? "bg-success" : "bg-error"}`} />
                {openNow ? "Aperto ora" : "Chiuso ora"}
              </span>
            )}
            {goForChips.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Ci dovresti andare se">
                {goForChips.map((chip) => (
                  <span key={chip} className="rounded-pill border border-border bg-white px-3 py-1 text-sm font-sans text-text">
                    {chip}
                  </span>
                ))}
              </div>
            )}
            {(verdictText != null || synthesis != null) && (
              <div className="mt-5 border-t border-border pt-4">
                {verdictText && (
                  <p className="font-title text-xl font-semibold leading-snug text-brand in-data-[titoli=serif]:text-2xl">{verdictText}</p>
                )}
                {synthesis != null && (
                  <p className="mt-2 text-[15px] font-sans leading-relaxed text-text">{synthesis}</p>
                )}
              </div>
            )}
            {matchReasonText && (
              <div className="mt-4 rounded-card bg-accent-light px-4 py-3">
                <p className="text-xs font-display font-semibold uppercase tracking-wide text-accent">✦ Per la tua ricerca</p>
                <p className="mt-1 text-sm font-sans leading-relaxed text-text">{matchReasonText}</p>
              </div>
            )}
            {dontExpectChips.length > 0 && (
              <p className="mt-3 text-sm font-sans text-text-muted">Meno adatto se: {dontExpectChips.join(" · ")}</p>
            )}
          </div>
        </>
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

      {variant === "a" && (
        <>
        {/* 7. BARRA AZIONI FLOTTANTE: sempre visibile in fondo alla scheda mentre si scorre. */}
        <div
          className="sticky bottom-[var(--nav-height-mobile)] z-10 mt-5 flex items-center gap-2 border-t border-border bg-surface/95 px-3 py-3 backdrop-blur"
        >
          {saveSlot}

          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={walk != null ? `Indicazioni: ${walk} min a piedi` : "Indicazioni"}
            className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-pill bg-brand px-3 py-2 text-sm font-display font-semibold text-white active:scale-95"
          >
            {walk != null ? <Footprints size={16} className="shrink-0" /> : <Navigation size={16} className="shrink-0" />}
            <span className="truncate">{walk != null ? `${walk} min` : "Percorso"}</span>
          </a>

          {shareOn && (
            <button
              type="button"
              onClick={share}
              aria-label={`Condividi ${name}`}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-brand active:scale-95"
            >
              <Share2 size={18} />
            </button>
          )}
          {shareNote && <span role="status" className="text-xs font-sans text-text-muted">{shareNote}</span>}

          {phone != null && (
            <a
              href={`tel:${phone.replace(/[^\d+]/g, "")}`}
              aria-label={`Chiama ${name}`}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-brand active:scale-95"
            >
              <Phone size={18} />
            </a>
          )}

          {websiteUri != null && (
            <a
              href={websiteUri}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Sito di ${name}`}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-brand active:scale-95"
            >
              <Globe size={18} />
            </a>
          )}
        </div>
        </>
      )}
      {variant === "b" && (
        /* B: barra scura a riquadri, staccata dal fondo (come Places). */
        <div className="sticky bottom-[calc(var(--nav-height-mobile)+0.75rem)] z-10 mt-6 flex justify-center px-3">
          <div className="flex max-w-full items-center gap-1.5 rounded-[1.25rem] bg-brand p-1.5 shadow-float">
            {saveSlot}
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={walk != null ? `Indicazioni: ${walk} min a piedi` : "Indicazioni"}
              className={TILE}
            >
              {walk != null ? <Footprints size={18} /> : <Navigation size={18} />}
              {walk != null ? `${walk} min` : "Percorso"}
            </a>
            {phone != null && (
              <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} aria-label={`Chiama ${name}`} className={TILE}>
                <Phone size={18} />
                Chiama
              </a>
            )}
            {websiteUri != null && (
              <a href={websiteUri} target="_blank" rel="noopener noreferrer" aria-label={`Sito di ${name}`} className={TILE}>
                <Globe size={18} />
                Sito
              </a>
            )}
          </div>
        </div>
      )}
      {/* Spazio sotto la barra: la nav mobile copre il fondo della scheda. */}
      <div aria-hidden style={{ height: "var(--nav-height-mobile)" }} />
    </div>
  );
}
