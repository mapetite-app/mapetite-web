"use client";

import { tagLabel } from "@/lib/tags";
import { X, Quote, Navigation, Globe, Phone, Check, Share2, Footprints } from "lucide-react";
import { useState } from "react";
import { useBeta, useOptIn, useVariant } from "@/lib/beta";
import { track } from "@/lib/track";
import { mapetiteShareUrl } from "@/lib/share-place";
import { isGem } from "@/lib/gem";
import PlacePhoto from "@/components/place-photo";
import { getCategoryEmoji } from "@/lib/emoji";
import { categoryLabel } from "@/lib/category-label";
import { cityFromAddress } from "@/lib/city";
import { distanceLabel, walkMinutes } from "@/lib/distance";

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
  photoAuthor?: string | null;
};

type VenueSheetProps = {
  venue: Venue;
  isSaved: boolean;
  canEdit: boolean; // true solo in vista "saved"
  onEdit: () => void;
  onClose: () => void;
  saveSlot: React.ReactNode; // <SaveButton .../> renderizzato da map-view
  communitySlot: React.ReactNode; // recensioni Mapetite + ReviewForm, da map-view
  origin?: { lat: number; lng: number } | null; // per "Roma · 600 m"
  userPos?: { lat: number; lng: number } | null; // posizione reale dell'utente, per i minuti a piedi
  onVisitStatus?: (status: "Da provare" | "Già visitato") => void; // solo per i locali salvati
  googlePlaceId?: string | null; // Place ID Google (i salvati hanno l'UUID come id)
  // Locale non ancora salvato: "📌 Voglio andarci / ✓ Ci sono stato" aprono Salva con lo stato già scelto.
  onQuickSave?: (status: "Da provare" | "Già visitato") => void;
};

export default function VenueSheet({
  venue,
  isSaved,
  canEdit,
  onEdit,
  onClose,
  saveSlot,
  communitySlot,
  origin = null,
  userPos = null,
  onVisitStatus,
  googlePlaceId = null,
  onQuickSave,
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
  // Segnali di comportamento (percorso, chiama, sito, condividi): vedi src/lib/track.ts.
  const signal = (type: "percorso" | "chiama" | "sito" | "condividi") => track(type, { id: venue.id, lat, lng });

  // Scheda completa su Google Maps (orari, foto, tutte le recensioni): con il Place ID se c'è.
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}${googlePlaceId ? `&query_place_id=${encodeURIComponent(googlePlaceId)}` : ""}`;
  const shareOn = useBeta("condividi");
  const gem = useOptIn("gemme") && isGem(rating, userRatingCount);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [addressCopied, setAddressCopied] = useState(false);
  const share = async () => {
    signal("condividi");
    // Link Mapetite (pagina pubblica con il verdetto); se non si può creare, Google Maps.
    const mapetiteUrl = await mapetiteShareUrl({ ...venue, lat, lng });
    const url = mapetiteUrl ?? mapsUrl;
    const base = verdict?.trim() ? `${name} — ${verdict.trim()}` : name;
    const text = mapetiteUrl ? `${base} · su Mapetite` : base;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: name, text, url });
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setShareNote("Link copiato");
        setTimeout(() => setShareNote(null), 2500);
      }
    } catch (err) {
      // Chiuso il foglio di condivisione: nessun errore. Se invece il telefono non accetta più il
      // tocco (attesa per creare il link), il link ora è pronto: basta toccare di nuovo.
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setShareNote("Link pronto: tocca di nuovo Condividi");
        setTimeout(() => setShareNote(null), 4000);
      }
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
    isSaved && (hasPersonalTags || personalNote != null || canEdit || onVisitStatus != null);
  const priceLabel =
    priceLevel != null && priceLevel > 0 ? "€".repeat(priceLevel) : null;
  // Come Places: se il locale è raggiungibile a piedi, il pulsante percorso mostra i minuti.
  const walk = userPos ? walkMinutes(userPos, { lat, lng }) : null;
  // Variante della scheda da far scegliere (?scheda=b, stile Places); "a" = attuale.
  const variant = useVariant("scheda");
  const emoji = getCategoryEmoji(category, name);
  // Righe di contesto della variante B: "Roma · 600 m" e "Cocktail bar · €€ · ★ 4,5 (812)".
  const placeLine = [cityFromAddress(address), origin ? distanceLabel(origin, { lat, lng }) : null]
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

  // Il riquadro scuro "Il verdetto Mapetite" (piace a Lorenzo, 12/10): uguale nelle due schede.
  const verdictCard = hasVerdictBlock ? (
      <div className="mx-5 mt-4 rounded-card bg-brand p-5 shadow-card">
        {(verdictText != null || synthesis != null) && (
          <>
            <p data-testid="verdetto-scheda" className="text-xs font-display font-semibold uppercase tracking-wide text-accent">
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
  ) : null;

  return (
    <div className="relative flex flex-col rounded-card bg-surface shadow-float">
      {variant === "a" && (
        <>
      {/* 1. HEADER */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
        {shareNote && <span role="status" className="rounded-pill bg-surface px-2.5 py-1 text-xs font-sans text-text shadow-card">{shareNote}</span>}
        {shareOn && (
          <button
            type="button"
            onClick={share}
            aria-label={`Condividi ${name}`}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-brand shadow-card active:scale-95"
          >
            <Share2 size={18} />
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-text-muted shadow-card hover:text-text"
        >
          <X size={18} />
        </button>
      </div>

      {venue.photoRef && (
        <div className="relative">
          <PlacePhoto
            photoRef={venue.photoRef}
            alt={name}
            width={700}
            priority
            className="h-44 w-full rounded-t-card object-cover"
          />
          {venue.photoAuthor && (
            <span className="absolute bottom-2 left-3 rounded-pill bg-black/45 px-2 py-0.5 text-[10px] font-sans text-white">
              Foto: {venue.photoAuthor}
            </span>
          )}
        </div>
      )}
      <div className="px-5 pt-5">
        {!venue.photoRef && (
          <span
            role="img"
            aria-label={category ?? "locale"}
            className="text-4xl leading-none"
          >
            {getCategoryEmoji(category, name)}
          </span>
        )}
        <h2 className={`${venue.photoRef ? "" : "mt-2 pr-24 "}font-title text-2xl font-semibold leading-tight text-brand in-data-[titoli=serif]:text-[2.1rem]`}>
          {name}
        </h2>

        {/* Come Places: "Città · distanza", poi tipo · voto · prezzo · aperto. */}
        {(cityFromAddress(address) || origin) && (
          <p data-testid="citta-distanza" className="mt-1 text-sm font-sans text-text-muted">
            {[cityFromAddress(address), origin ? distanceLabel(origin, { lat, lng }) : null].filter(Boolean).join(" · ")}
          </p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-sans text-text-muted">
          {categoryLabel(category) && (
            <>
              <span className="text-text">{categoryLabel(category)}</span>
              {rating != null && <span aria-hidden>·</span>}
            </>
          )}
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
          {gem && (
            <span data-testid="gemma" className="rounded-pill bg-accent-light px-2 py-0.5 text-xs font-display font-semibold text-accent">
              💎 Poco conosciuto
            </span>
          )}
        </div>

        {address && (
          // Tocco sull'indirizzo: lo copia (per mandarlo a chi viene con te o incollarlo in un'altra app).
          <button
            type="button"
            data-testid="copia-indirizzo"
            onClick={async () => {
              try { await navigator.clipboard.writeText(address); setAddressCopied(true); setTimeout(() => setAddressCopied(false), 2000); } catch { /* appunti non disponibili */ }
            }}
            className="mt-1 flex min-h-8 items-center gap-1.5 text-left text-xs font-sans text-text-muted"
          >
            <span>{address}</span>
            <span className="shrink-0 font-display font-semibold text-brand">{addressCopied ? "✓ Copiato" : "Copia"}</span>
          </button>
        )}
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-xs font-display font-semibold text-accent">
          Orari, foto e recensioni su Google Maps →
        </a>
      </div>

      {/* 2. CARD VERDETTO (teal): verdetto + matchReason + chip, tutto dentro. */}
      {verdictCard}

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
                width={700}
                priority
                className="h-56 w-full rounded-t-card object-cover"
                fallback={<div className="flex h-40 items-center justify-center rounded-t-card bg-brand/10 text-6xl">{emoji}</div>}
              />
            ) : (
              <div className="flex h-40 items-center justify-center rounded-t-card bg-brand/10 text-6xl">{emoji}</div>
            )}
            {venue.photoRef && venue.photoAuthor && (
              <span className="absolute bottom-2 right-3 rounded-pill bg-black/45 px-2 py-0.5 text-[10px] font-sans text-white">Foto: {venue.photoAuthor}</span>
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
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm font-display font-semibold text-accent">
              Orari e foto su Google Maps →
            </a>
            {shareNote && <p role="status" className="mt-1 text-xs font-sans text-text-muted">{shareNote}</p>}
            {gem && (
              <span data-testid="gemma" className="mt-3 mr-2 inline-flex rounded-pill bg-accent-light px-3 py-1 text-sm font-display font-semibold text-accent">💎 Poco conosciuto</span>
            )}
            {openNow != null && (
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-pill border border-border bg-white px-3 py-1 text-sm font-sans text-text">
                <span aria-hidden className={`h-2 w-2 rounded-full ${openNow ? "bg-success" : "bg-error"}`} />
                {openNow ? "Aperto ora" : "Chiuso ora"}
              </span>
            )}
          </div>
          {verdictCard}
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

      {/* Non salvato: le due scelte di Places come primo passo del salvataggio. */}
      {!isSaved && onQuickSave && (
        <div className="mx-5 mt-4 flex gap-2" data-testid="stato-rapido">
          {([["Da provare", "📌 Voglio andarci"], ["Già visitato", "✓ Ci sono stato"]] as const).map(([tag, label]) => (
            <button
              key={tag}
              type="button"
              onClick={() => onQuickSave(tag)}
              className="min-h-11 flex-1 rounded-pill border border-border bg-white px-3 text-sm font-display font-semibold text-brand active:scale-95"
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* 4. LE TUE NOTE */}
      {showPersonalBlock && (
        <div className="mx-5 mt-4 rounded-card border-2 border-accent/30 bg-surface p-4">
          <p className="text-xs font-display font-semibold uppercase tracking-wide text-accent">
            Le tue note
          </p>
          {onVisitStatus && (
            <div className="mt-2 flex gap-2" data-testid="stato-salvato">
              {([["Da provare", "📌 Voglio andarci"], ["Già visitato", "✓ Ci sono stato"]] as const).map(([tag, label]) => {
                const on = personalTags?.includes(tag) ?? false;
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onVisitStatus(tag)}
                    className={`min-h-10 flex-1 rounded-pill border px-3 text-sm font-display font-semibold active:scale-95 ${on ? "border-brand bg-brand text-white" : "border-border bg-white text-brand"}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
          {hasPersonalTags && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {personalTags!.filter((t) => !onVisitStatus || (t !== "Da provare" && t !== "Già visitato")).map((tag) => (
                <span
                  key={tag}
                  className="rounded-pill border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-display font-medium text-accent"
                >
                  {tagLabel(tag)}
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

      {/* 5. COSA DICONO — recensioni Google (prima: è quasi sempre piena) */}
      {hasReviews && (
        <div className="mt-5 border-t border-border px-5 pt-4">
          <h3 className="flex items-baseline justify-between font-display text-base font-semibold text-brand">
            Cosa dicono
            <span className="text-xs font-sans font-normal text-text-muted">Recensioni da Google</span>
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

      {/* 6. COMMUNITY — recensioni Mapetite + ReviewForm */}
      {communitySlot && (
        <div className="mt-5 border-t border-border px-5 pt-4">
          <h3 className="font-display text-base font-semibold text-brand">
            Recensioni Mapetite
          </h3>
          <div className="mt-2">{communitySlot}</div>
        </div>
      )}

      {/* 7. BARRA AZIONI FLOTTANTE: sempre visibile in fondo alla scheda mentre si scorre. */}
      {variant === "a" && (
      <div
        className="sticky bottom-[var(--nav-height-mobile)] z-10 mt-5 flex items-center gap-2 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur"
      >
        {saveSlot}

        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`} onClick={() => signal("percorso")}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={walk != null ? `Indicazioni: ${walk} min a piedi` : "Indicazioni"}
          className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-pill bg-brand px-4 py-2 text-sm font-display font-semibold text-white active:scale-95"
        >
          {walk != null ? <Footprints size={16} className="shrink-0" /> : <Navigation size={16} className="shrink-0" />}
          <span className="truncate">{walk != null ? `${walk} min a piedi` : "Indicazioni"}</span>
        </a>

        {phone != null && (
          <a
            href={`tel:${phone.replace(/[^\d+]/g, "")}`} onClick={() => signal("chiama")}
            aria-label={`Chiama ${name}`}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-brand active:scale-95"
          >
            <Phone size={18} />
          </a>
        )}

        {websiteUri != null && (
          <a
            href={websiteUri} onClick={() => signal("sito")}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Sito di ${name}`}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-brand active:scale-95"
          >
            <Globe size={18} />
          </a>
        )}
      </div>
      )}
      {variant === "b" && (
        /* B: barra scura a riquadri, staccata dal fondo (come Places). */
        <div className="sticky bottom-[calc(var(--nav-height-mobile)+0.75rem)] z-10 mt-6 flex justify-center px-3">
          <div className="flex max-w-full items-center gap-1.5 rounded-[1.25rem] bg-brand p-1.5 shadow-float">
            {saveSlot}
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`} onClick={() => signal("percorso")}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={walk != null ? `Indicazioni: ${walk} min a piedi` : "Indicazioni"}
              className={TILE}
            >
              {walk != null ? <Footprints size={18} /> : <Navigation size={18} />}
              {walk != null ? `${walk} min` : "Percorso"}
            </a>
            {phone != null && (
              <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} onClick={() => signal("chiama")} aria-label={`Chiama ${name}`} className={TILE}>
                <Phone size={18} />
                Chiama
              </a>
            )}
            {websiteUri != null && (
              <a href={websiteUri} onClick={() => signal("sito")} target="_blank" rel="noopener noreferrer" aria-label={`Sito di ${name}`} className={TILE}>
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
