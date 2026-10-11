"use client";

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Share2 } from "lucide-react";
import { getCategoryEmoji } from "@/lib/emoji";
import type { Place } from "@/app/mappa/map-view";
import { useBeta } from "@/lib/beta";
import PlacePhoto from "@/components/place-photo";
import { distanceLabel } from "@/lib/distance";
import { categoryLabel } from "@/lib/category-label";

// Solo le prime card mostrano la foto: contiene il costo di Place Photos.
const PHOTO_CARDS = 6;
const NO_MATCH = "Nessun locale con questi filtri: togline qualcuno.";

export interface BottomSheetProps {
  places: Place[];
  onSelect: (place: Place) => void;
  onClose: () => void;
  // Dettaglio editoriale per locale (id → dati). Presente solo nelle ricerche AI:
  // mentre i verdetti arrivano (`loadingVerdicts`) le card mostrano un caricamento.
  details?: Record<string, ListDetails | undefined>;
  loadingVerdicts?: boolean;
  // Variante grafica della lista (voce 5, scelta con ?lista=a|b nell'URL).
  variant?: "a" | "b";
  // Punto da cui calcolare la distanza mostrata sulle card (posizione dell'utente o centro mappa).
  origin?: { lat: number; lng: number } | null;
  onShare?: (() => void) | null; // condividi la ricerca (solo con titolo della risposta)
  shareNote?: string | null;
  // Filtri rapidi controllati dal genitore (così la mappa nasconde gli stessi pin).
  quick?: ReadonlySet<QuickFilter>;
  onToggleQuick?: (f: QuickFilter) => void;
  // Titolo editoriale della risposta (la richiesta dell'utente), solo nelle ricerche AI.
  title?: string | null;
}

export type ListDetails = {
  userRatingCount: number | null;
  openNow: boolean | null;
  verdict: string | null;
  matchReason: string | null;
  goFor: string[] | null;
  photoRef?: string | null;
};

function prettyCategory(c: string | null): string | null {
  return categoryLabel(c);
}

function priceLabel(level: number | null): string | null {
  return level != null && level > 0 ? "€".repeat(Math.min(level, 4)) : null;
}

function formatCount(n: number | null): string | null {
  if (n == null) return null;
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(".", ",")}k` : String(n);
}

// Riga di metadati: categoria · ★ voto (n) · prezzo · distanza.
function metaLine(place: Place, d: ListDetails | undefined, origin: { lat: number; lng: number } | null = null): string {
  const parts: string[] = [];
  const cat = prettyCategory(place.category);
  if (cat) parts.push(cat);
  if (place.rating != null) {
    const n = formatCount(d?.userRatingCount ?? null);
    parts.push(`★ ${place.rating.toFixed(1).replace(".", ",")}${n ? ` (${n})` : ""}`);
  }
  const price = priceLabel(place.priceLevel);
  if (price) parts.push(price);
  if (origin) parts.push(distanceLabel(origin, place));
  return parts.join(" · ");
}

function SkeletonLines({ dark = false }: { dark?: boolean }) {
  const bar = dark ? "bg-white/20" : "bg-border";
  return (
    <span aria-label="Sto preparando il verdetto" className="mt-2 block space-y-1.5">
      <span className={`block h-3 w-4/5 animate-pulse rounded-pill ${bar}`} />
      <span className={`block h-3 w-3/5 animate-pulse rounded-pill ${bar}`} />
    </span>
  );
}

// Snap points in dvh numerici (percentuali dell'altezza viewport).
const SNAPS = { compact: 25, medium: 45, tall: 75 } as const;
const ORDER = ["compact", "medium", "tall"] as const;
type SnapKey = keyof typeof SNAPS;

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

type DragState = {
  startY: number;
  startHeight: number;
  lastY: number;
  lastT: number;
  velocity: number; // px/ms, positiva = dito verso l'alto
  moved: boolean;
  fromContent: boolean; // il gesto è partito dalla lista scrollabile
};

export type QuickFilter = "open" | "cheap" | "top";

// Filtri rapidi condivisi da lista e mappa (i pin seguono la lista).
export function applyQuickFilters(
  list: Place[],
  quick: ReadonlySet<QuickFilter>,
  details: Record<string, ListDetails | undefined> | undefined,
): Place[] {
  if (quick.size === 0) return list;
  return list.filter(
    (p) =>
      (!quick.has("open") || details?.[p.id]?.openNow === true) &&
      (!quick.has("cheap") || (p.priceLevel != null && p.priceLevel <= 2)) &&
      (!quick.has("top") || (p.rating ?? 0) >= 4.5),
  );
}

export default function BottomSheet({ places: allPlaces, onSelect, onClose, details, loadingVerdicts = false, variant = "a", origin = null, quick: quickProp, onToggleQuick, title = null, onShare = null, shareNote = null }: BottomSheetProps) {
  const quickFiltersOn = useBeta("filtri-lista");
  const [quickLocal, setQuickLocal] = useState<Set<QuickFilter>>(new Set());
  const quick = quickProp ?? quickLocal;
  const places = useMemo(
    () => (quickFiltersOn ? applyQuickFilters(allPlaces, quick, details) : allPlaces),
    [allPlaces, quick, quickFiltersOn, details],
  );
  const toggleQuick = (f: QuickFilter) => {
    if (onToggleQuick) return onToggleQuick(f);
    setQuickLocal((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  };
  const [snap, setSnap] = useState<SnapKey>("medium");
  // Altezza in px imposta solo durante il drag; null = altezza controllata dallo snap.
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<DragState | null>(null);

  const cycleSnap = () =>
    setSnap((s) => ORDER[(ORDER.indexOf(s) + 1) % ORDER.length]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // Tap su un elemento interattivo (✕, voci lista): lascia passare il click,
    // non avviare il drag. L'handle è l'unica eccezione.
    const el = e.target as HTMLElement;
    const interactive = el.closest("button, a, input, [role='button']");
    if (interactive && !interactive.hasAttribute("data-drag-handle")) {
      return;
    }

    // Se il gesto parte dalla lista già scrollata, è uno scroll, non un drag.
    if (
      contentRef.current &&
      contentRef.current.contains(e.target as Node) &&
      contentRef.current.scrollTop > 0
    ) {
      return;
    }
    dragState.current = {
      startY: e.clientY,
      startHeight: sheetRef.current?.offsetHeight ?? 0,
      lastY: e.clientY,
      lastT: performance.now(),
      velocity: 0,
      moved: false,
      fromContent: contentRef.current?.contains(e.target as Node) ?? false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const ds = dragState.current;
    if (!ds) return;

    const dy = ds.startY - e.clientY; // dito in su = dy positivo = sheet cresce
    if (!ds.moved && Math.abs(dy) < 5) return; // soglia tap/drag
    if (!ds.moved) {
      if (ds.fromContent && dy < 0) {
        // trascinamento verso il basso partendo dalla lista: lascia scrollare
        dragState.current = null;
        return;
      }
      ds.moved = true;
    }

    const now = performance.now();
    const dt = now - ds.lastT;
    if (dt > 0) ds.velocity = (ds.lastY - e.clientY) / dt;
    ds.lastY = e.clientY;
    ds.lastT = now;

    const vh = window.innerHeight;
    const next = clamp(ds.startHeight + dy, vh * 0.15, vh * 0.92);
    setDragHeight(next);

    if (ds.moved) e.preventDefault();
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    setDragHeight(null);
    dragState.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const ds = dragState.current;
    if (!ds) return;

    // Nessun movimento: era un tap → lo snap lo gestisce onClick dell'handle.
    if (!ds.moved) {
      dragState.current = null;
      return;
    }

    const vh = window.innerHeight;
    const currentPct = ((dragHeight ?? ds.startHeight) / vh) * 100;

    let result: SnapKey;
    if (Math.abs(ds.velocity) > 0.5) {
      // Flick: vai allo snap successivo nella direzione del gesto,
      // partendo dallo snap di partenza.
      const startIdx = ORDER.indexOf(snap);
      const dir = ds.velocity > 0 ? 1 : -1;
      result = ORDER[clamp(startIdx + dir, 0, ORDER.length - 1)];
    } else {
      // Rilascio lento: snap più vicino alla percentuale corrente.
      result = ORDER.reduce((best, key) =>
        Math.abs(SNAPS[key] - currentPct) < Math.abs(SNAPS[best] - currentPct)
          ? key
          : best,
      ORDER[0]);
    }

    setSnap(result);
    endDrag(e);
  };

  const onPointerCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return;
    endDrag(e);
  };

  if (allPlaces.length === 0) return null;

  const quickChips = (
    <div className="flex flex-wrap gap-2" data-testid="filtri-lista">
      {([["open", "Aperto ora"], ["cheap", "Fino a €€"], ["top", "Voto 4,5+"]] as const).map(([k, label]) => (
        <button
          key={k}
          type="button"
          aria-pressed={quick.has(k)}
          onClick={() => toggleQuick(k)}
          className={`min-h-9 rounded-pill border px-3 text-xs font-display font-medium shadow-card ${quick.has(k) ? "border-brand bg-brand text-white" : "border-border bg-white text-text"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  // Variante B (stile Places): carosello orizzontale di card scure sopra la barra di navigazione.
  if (variant === "b") {
    return (
      <div
        className="pointer-events-none absolute left-0 right-0 z-10"
        style={{ bottom: "var(--nav-height-mobile)" }}
      >
        <div className={`pointer-events-auto mx-3 mb-2 flex items-center justify-between bg-surface shadow-float ${title ? "rounded-card px-4 py-2" : "w-fit rounded-pill px-4 py-1.5"}`}>
          <div className="min-w-0">
            {title && (
              <p data-testid="titolo-risposta" className="line-clamp-2 font-title text-base in-data-[titoli=serif]:text-xl font-semibold leading-snug text-brand first-letter:uppercase">
                {title}
              </p>
            )}
            <p className="text-xs font-sans text-text-muted">
              {title
                ? `${places.length} ${places.length === 1 ? "posto scelto" : "posti scelti"} per questa richiesta`
                : `${places.length} ${places.length === 1 ? "risultato" : "risultati"}`}
              {loadingVerdicts && " · preparo i verdetti…"}
              {shareNote && <span role="status"> · {shareNote}</span>}
            </p>
          </div>
          {title && onShare && (
            <button type="button" onClick={onShare} aria-label="Condividi questa ricerca" className="-my-2 ml-2 flex h-11 w-9 shrink-0 items-center justify-center text-brand">
              <Share2 size={18} />
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Chiudi" className="-my-2 ml-2 flex h-11 w-9 shrink-0 items-center justify-center text-base text-text-muted">
            ✕
          </button>
        </div>
        {quickFiltersOn && <div className="pointer-events-auto mx-3 mb-2">{quickChips}</div>}
        {places.length === 0 && (
          <p className="pointer-events-auto mx-3 mb-3 rounded-card bg-surface px-4 py-3 text-center text-sm text-text-muted shadow-float">{NO_MATCH}</p>
        )}
        <ul className="pointer-events-auto flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-3 [scrollbar-width:none]">
          {places.map((place) => {
            const d = details?.[place.id];
            return (
              <li key={place.id} className="w-[78vw] max-w-sm shrink-0 snap-center">
                <button
                  type="button"
                  onClick={() => onSelect(place)}
                  className="relative flex h-full min-h-[190px] w-full flex-col overflow-hidden rounded-card bg-brand p-4 text-left text-white shadow-float active:scale-[0.99]"
                >
                  {places.indexOf(place) < PHOTO_CARDS && d?.photoRef && (
                    <>
                      <PlacePhoto photoRef={d.photoRef} alt="" width={500} className="absolute inset-0 h-full w-full object-cover" />
                      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-brand via-brand/70 to-brand/20" />
                    </>
                  )}
                  {/* Testo sopra la foto: senza "relative" la foto assoluta lo copre. */}
                  <span className="relative flex flex-1 flex-col">
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-2xl leading-none">{getCategoryEmoji(place.category, place.name)}</span>
                      {d?.openNow === true && (
                        <span className="rounded-pill bg-white/15 px-2 py-0.5 text-[10px] font-display font-medium">Aperto ora</span>
                      )}
                    </span>
                    <span className="mt-3 line-clamp-2 text-lg font-title in-data-[titoli=serif]:text-2xl font-semibold leading-snug">{place.name}</span>
                    <span className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wider text-white/60">
                      {metaLine(place, d, origin)}
                    </span>
                    {d?.verdict ? (
                      <span className="mt-2 line-clamp-2 block text-sm font-sans leading-snug text-white/90">{d.verdict}</span>
                    ) : loadingVerdicts && details ? (
                      <SkeletonLines dark />
                    ) : null}
                    {d?.matchReason && (
                      <span className="mt-1 line-clamp-2 block text-xs font-sans leading-snug text-white/70">{d.matchReason}</span>
                    )}
                    {/* Dati personali dei salvati: i tuoi tag e la tua nota. */}
                    {place.tags && place.tags.length > 0 && (
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        {place.tags.slice(0, 3).map((t) => (
                          <span key={t} className="rounded-pill border border-white/40 px-2 py-0.5 text-[11px] font-display font-medium">{t}</span>
                        ))}
                      </span>
                    )}
                    {place.note && (
                      <span className="mt-1 line-clamp-1 block text-xs font-sans italic leading-snug text-white/80">“{place.note}”</span>
                    )}
                    {(d?.goFor ?? []).length > 0 && (
                      <span className="mt-auto flex flex-wrap gap-1.5 pt-2">
                        {d!.goFor!.slice(0, 2).map((c) => (
                          <span key={c} className="rounded-pill bg-white/15 px-2 py-0.5 text-[11px] font-display">{c}</span>
                        ))}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div
      ref={sheetRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      className="pointer-events-auto absolute left-0 right-0 mx-auto max-w-2xl z-10 flex flex-col overflow-hidden rounded-t-card bg-surface shadow-float"
      style={{
        bottom: "var(--nav-height-mobile)",
        height: dragHeight !== null ? `${dragHeight}px` : `${SNAPS[snap]}dvh`,
        transition:
          dragHeight !== null ? "none" : "height 220ms cubic-bezier(0.32, 0.72, 0, 1)",
      }}
    >
      <button
        type="button"
        onClick={cycleSnap}
        aria-label="Cambia altezza pannello"
        data-drag-handle="true"
        className="flex w-full cursor-pointer items-center justify-center bg-surface py-2"
        style={{ touchAction: "none" }}
      >
        <div className="h-1 w-10 rounded-pill bg-border" />
      </button>
      <div
        ref={contentRef}
        className="flex-1 overflow-y-auto px-3 pb-4"
        style={{ touchAction: "pan-y" }}
      >
        <div className="flex items-start justify-between px-1 pb-2">
          <div className="min-w-0">
            {title && (
              <p data-testid="titolo-risposta" className="line-clamp-2 font-title text-lg font-semibold leading-snug text-brand first-letter:uppercase">
                {title}
              </p>
            )}
            <p className="text-xs font-sans text-text-muted">
              {title
                ? `${places.length} ${places.length === 1 ? "posto scelto" : "posti scelti"} per questa richiesta`
                : `${places.length} ${places.length === 1 ? "risultato" : "risultati"}`}
              {loadingVerdicts && " · preparo i verdetti…"}
              {shareNote && <span role="status"> · {shareNote}</span>}
            </p>
          </div>
          {title && onShare && (
            <button type="button" onClick={onShare} aria-label="Condividi questa ricerca" className="-my-2 flex h-11 w-11 shrink-0 items-center justify-center text-brand">
              <Share2 size={18} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="-my-2 -mr-1 flex h-11 w-11 select-none touch-manipulation items-center justify-center text-lg leading-none text-text-muted hover:text-text"
          >
            ✕
          </button>
        </div>
        {quickFiltersOn && <div className="px-1 pb-2">{quickChips}</div>}
        {places.length === 0 && allPlaces.length > 0 && (
          <p className="px-2 py-6 text-center text-sm text-text-muted">{NO_MATCH}</p>
        )}
        <ul className="flex flex-col gap-1">
          {places.map((place) => (
            <li key={place.id}>
              <button
                type="button"
                onClick={() => onSelect(place)}
                className="flex w-full items-start gap-3 rounded-card border border-border bg-white px-3 py-3 text-left shadow-card active:scale-[0.99]"
              >
                <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-btn bg-accent-light text-2xl leading-none">
                  <PlacePhoto
                    photoRef={places.indexOf(place) < PHOTO_CARDS ? details?.[place.id]?.photoRef : null}
                    alt={place.name}
                    width={200}
                    className="h-full w-full object-cover"
                    fallback={getCategoryEmoji(place.category, place.name)}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-title font-semibold leading-snug text-text">
                    {place.name}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 truncate text-xs font-sans text-text-muted">
                    <span className="truncate">{metaLine(place, details?.[place.id], origin)}</span>
                    {details?.[place.id]?.openNow === true && (
                      <span className="shrink-0 rounded-pill bg-success/10 px-1.5 py-0.5 text-[10px] font-display font-medium text-success">
                        Aperto ora
                      </span>
                    )}
                  </span>
                  {details?.[place.id]?.verdict ? (
                    <span className="mt-1.5 block text-sm font-sans font-medium leading-snug text-brand">
                      {details[place.id]!.verdict}
                    </span>
                  ) : loadingVerdicts && details ? (
                    <SkeletonLines />
                  ) : null}
                  {details?.[place.id]?.matchReason && (
                    <span className="mt-1 line-clamp-2 block text-xs font-sans leading-snug text-text-muted">
                      {details[place.id]!.matchReason}
                    </span>
                  )}
                  {(details?.[place.id]?.goFor ?? []).length > 0 && (
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      {details![place.id]!.goFor!.slice(0, 3).map((c) => (
                        <span key={c} className="rounded-pill bg-accent-light px-2 py-0.5 text-[11px] font-display font-medium text-accent">
                          {c}
                        </span>
                      ))}
                    </span>
                  )}
                  {/* Dati personali dei salvati: i tuoi tag e la tua nota. */}
                  {place.tags && place.tags.length > 0 && (
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      {place.tags.map((t) => (
                        <span key={t} className="rounded-pill border border-accent/40 px-2 py-0.5 text-[11px] font-display font-medium text-accent">
                          {t}
                        </span>
                      ))}
                    </span>
                  )}
                  {place.note && (
                    <span className="mt-1.5 line-clamp-2 block text-xs font-sans italic text-text">
                      “{place.note}”
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
