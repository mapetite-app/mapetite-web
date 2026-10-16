"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { getCategoryEmoji } from "@/lib/emoji";
import type { Place } from "@/app/mappa/map-view";
import { useBeta, useOptIn } from "@/lib/beta";
import { isGem } from "@/lib/gem";
import { categoryLabel } from "@/lib/category-label";
import { distanceLabel, distanceMeters } from "@/lib/distance";
import PlacePhoto from "@/components/place-photo";
import { isStateTag, sortTags, tagLabel } from "@/lib/tags";
import { searchFeedbackMailto } from "@/lib/feedback";
import { trackFeature } from "@/lib/track";
import UtileFeedback from "@/components/utile-feedback";
import { cityFromAddress } from "@/lib/city";

// Solo le prime card mostrano la foto: contiene il costo di Place Photos.
export const PHOTO_CARDS = 6;
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
  // Filtri rapidi controllati dal genitore (così la mappa nasconde gli stessi pin).
  quick?: ReadonlySet<QuickFilter>;
  onToggleQuick?: (f: QuickFilter) => void;
  // Titolo editoriale della risposta (la richiesta dell'utente), solo nelle ricerche AI.
  title?: string | null;
  // Variante B: card al centro del carosello ↔ pin evidenziato sulla mappa.
  focusedId?: string | null;
  onFocus?: (place: Place) => void;
  // Da computer (lista a fianco della mappa): passando col mouse su una card si evidenzia il suo pin.
  onHover?: (place: Place) => void;
  // Riporta al genitore l'ordine delle card mostrate (dopo filtri rapidi e "Più vicini").
  onOrder?: (ids: string[]) => void;
  // Cosa ha capito l'AI della richiesta (tipo, requisiti): "Ho capito: rooftop · romantico".
  understood?: string[];
  // Locali messi in fondo o lasciati fuori dalla ricerca (turistici, fuori tema): lo si dice.
  setAside?: { turistici: string[]; fuori_tema: string[] } | null;
  // Punto della ricerca: il link condiviso la rifà lì (/mappa?q=…&at=lat,lng).
  shareAt?: { lat: number; lng: number } | null;
  // Intestazione semplice senza azioni (es. "I tuoi salvati · Roma"), quando non c'è un titolo di ricerca.
  heading?: string | null;
  // Riapre il pannello di ricerca con la frase attuale, per correggerla.
  onRefine?: () => void;
  // Segnalibro sulle card B (solo risultati di ricerca): stato e azione dal genitore.
  isSaved?: (id: string) => boolean;
  // Stato del locale già salvato ("📌 Voglio andarci" / "✓ Ci sono stato" / "📌 Salvato"), mostrato sulla card.
  savedLabel?: (id: string) => string | null;
  // "Per te" dai salvati: nome di un tuo salvato simile (stesso tipo e prezzo), mostrato sulla card.
  similarTo?: (id: string) => string | null;
  onSave?: (place: Place) => void;
  // Card finale "Questi risultati non vanno?": solo per la ricerca intera, non per un gruppo di pin.
  showSearchFeedback?: boolean;
  // Condivide la lista mostrata (salvati): testo con nomi e link Google Maps.
  onShareList?: (places: Place[]) => Promise<"shared" | "copied" | null>;
  // Apre la risposta "come un articolo" (?beta=articolo): chip "Leggi" prima dei filtri rapidi.
  onOpenArticle?: () => void;
  // Lista dei propri salvati: niente filtri rapidi (mancano orari e conteggi).
  savedMode?: boolean;
  // "Più vicini" deciso da fuori (foglio Filtri dei salvati): niente chip nella lista.
  nearest?: boolean;
  // Città sulla riga dei metadati (salvati di più città: "Ristorante · ★ 4,6 · Roma · 600 m").
  showCity?: boolean;
}

export type ListDetails = {
  userRatingCount: number | null;
  openNow: boolean | null;
  verdict: string | null;
  matchReason: string | null;
  goFor: string[] | null;
  photoRef?: string | null;
  // Senza verdetto (oltre i primi 12 o se l'AI non risponde): descrizione o recensione di Google.
  editorialSummary?: string | null;
  selectedReviews?: { text: string; rating?: number | null }[] | null;
};

// Riga di ripiego quando manca il verdetto: solo fatti di Google, mai testo inventato.
// Come riga della card solo una recensione da 4-5 stelle: prima la prima card poteva dire
// "“Pessimo, con 13 euro due Hugo…”" (la recensione era scelta solo per lunghezza).
export function googleLine(d: ListDetails | undefined): string | null {
  if (!d) return null;
  if (d.editorialSummary) return d.editorialSummary;
  const review = d.selectedReviews?.find((r) => r.rating == null || r.rating >= 4)?.text;
  return review ? `“${review}”` : null;
}

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

// Riga di metadati: categoria · ★ voto (n) · prezzo · [città] · distanza.
export function metaLine(place: Place, d: ListDetails | undefined, origin: { lat: number; lng: number } | null = null, withCity = false): string {
  const parts: string[] = [];
  const cat = prettyCategory(place.category);
  if (cat) parts.push(cat);
  if (place.rating != null) {
    const n = formatCount(d?.userRatingCount ?? null);
    parts.push(`★ ${place.rating.toFixed(1).replace(".", ",")}${n ? ` (${n})` : ""}`);
  }
  const price = priceLabel(place.priceLevel);
  if (price) parts.push(price);
  const city = withCity ? cityFromAddress(place.address) : null;
  if (city) parts.push(city);
  if (origin) parts.push(distanceLabel(origin, place));
  return parts.join(" · ");
}

// Stessa forma di ciò che arriva (verdetto su 2 righe, "perché" su 1, 2 chip):
// quando il verdetto sostituisce il segnaposto la lista non salta di ~60 px.
// Copertina senza foto: un colore per famiglia di cucina (sempre scuro, il testo resta bianco).
const COVERS: [RegExp, string, string][] = [
  [/pizza/, "#7a2e1f", "#3d1610"],
  [/sushi|japanese|ramen|seafood|fish|pesce/, "#1d4e6b", "#0f2a3b"],
  [/cocktail|bar|pub|wine|brewery|night/, "#4a2346", "#241122"],
  [/cafe|coffee|bakery|pastry|dessert|ice_cream|gelat/, "#6b4423", "#35210f"],
  [/vegan|vegetarian/, "#2f5a2e", "#172d17"],
  [/chinese|indian|thai|asian|mexican|korean|vietnam/, "#7a4a12", "#3b2308"],
];
export function coverGradient(category: string | null, name = ""): string {
  const key = `${category ?? ""} ${name}`.toLowerCase();
  const hit = COVERS.find(([re]) => re.test(key));
  const [a, b] = hit ? [hit[1], hit[2]] : ["#24545a", "#1a3c40"];
  return `linear-gradient(160deg, ${a} 0%, ${b} 100%)`;
}

// Riga di fatti della card (Lorenzo 16/10, "il dono della sintesi"): tipo · ★ voto · prezzo · [città] · distanza.
// Senza il numero di recensioni: resta nella scheda; sulla card il "poco conosciuto" lo dice il 💎.
export function cardFacts(place: Place, origin: { lat: number; lng: number } | null = null, withCity = false): string {
  const parts: string[] = [];
  const cat = prettyCategory(place.category);
  if (cat) parts.push(cat);
  if (place.rating != null) parts.push(`★ ${place.rating.toFixed(1).replace(".", ",")}`);
  const price = priceLabel(place.priceLevel);
  if (price) parts.push(price);
  const city = withCity ? cityFromAddress(place.address) : null;
  if (city) parts.push(city);
  if (origin) parts.push(distanceLabel(origin, place));
  return parts.join(" · ");
}

function SkeletonLines({ dark = false }: { dark?: boolean }) {
  const bar = dark ? "bg-white/20" : "bg-border";
  const chip = dark ? "bg-white/15" : "bg-accent-light";
  // Card del carosello: solo il verdetto (2 righe), stessa forma di ciò che arriva.
  if (dark) {
    return (
      <span aria-label="Sto preparando il verdetto" data-testid="segnaposto-verdetto" className="mt-1.5 block">
        <span className="flex h-5 items-center"><span className={`block h-3 w-4/5 animate-pulse rounded-pill ${bar}`} /></span>
        <span className="flex h-5 items-center"><span className={`block h-3 w-3/5 animate-pulse rounded-pill ${bar}`} /></span>
      </span>
    );
  }
  return (
    <span aria-label="Sto preparando il verdetto" data-testid="segnaposto-verdetto" className="mt-2 block">
      <span className="flex h-5 items-center"><span className={`block h-3 w-4/5 animate-pulse rounded-pill ${bar}`} /></span>
      <span className="flex h-5 items-center"><span className={`block h-3 w-3/5 animate-pulse rounded-pill ${bar}`} /></span>
      <span className="mt-1 flex h-4 items-center"><span className={`block h-2.5 w-2/5 animate-pulse rounded-pill ${bar}`} /></span>
      <span className="mt-2 flex gap-1.5">
        <span className={`block h-[22px] w-16 animate-pulse rounded-pill ${chip}`} />
        <span className={`block h-[22px] w-20 animate-pulse rounded-pill ${chip}`} />
      </span>
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

export default function BottomSheet({ places: allPlaces, onSelect, onClose, details, loadingVerdicts = false, variant = "a", origin = null, quick: quickProp, onToggleQuick, title = null, focusedId = null, onFocus, onHover, onOrder, onRefine, isSaved, savedLabel, similarTo, onSave, onOpenArticle, onShareList, showSearchFeedback = true, heading = null, shareAt = null, understood = [], setAside = null, savedMode = false, showCity = false, nearest }: BottomSheetProps) {
  // Intestazione dei risultati compatta (QA 13/10: a 360px lasciava ~150px di mappa): una riga per
  // titolo, "Ho capito" e "🧭"; un tocco su una di queste righe le mostra intere.
  const [headerOpen, setHeaderOpen] = useState(false);
  // Filtri rapidi solo nei risultati di ricerca: per i salvati mancano orari, voto e prezzo
  // ("Aperto ora" nasconderebbe tutto).
  const quickFiltersOn = useBeta("filtri-lista") && details != null && !savedMode;
  // "Più vicini" anche nei salvati ("cosa ho salvato qui vicino?"), se c'è un punto da cui misurare.
  const nearestOn = nearest === undefined && origin != null && (quickFiltersOn || heading != null);
  const gemsOn = useOptIn("gemme");
  const [quickLocal, setQuickLocal] = useState<Set<QuickFilter>>(new Set());
  const quick = quickProp ?? quickLocal;
  // "Più vicini": riordina per distanza da te (o dal centro mappa). Solo ordine, nessun filtro.
  const [nearestLocal, setNearestFirst] = useState(false);
  const nearestFirst = nearest ?? nearestLocal;
  const [shared, setShared] = useState(false);
  const places = useMemo(() => {
    const list = quickFiltersOn ? applyQuickFilters(allPlaces, quick, details) : allPlaces;
    if (!nearestFirst || !origin) return list;
    return [...list].sort((a, b) => distanceMeters(origin, a) - distanceMeters(origin, b));
  }, [allPlaces, quick, quickFiltersOn, details, nearestFirst, origin]);
  const orderKey = places.map((p) => p.id).join(",");
  useEffect(() => {
    onOrder?.(orderKey ? orderKey.split(",") : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderKey]);
  const toggleQuick = (f: QuickFilter) => {
    if (onToggleQuick) return onToggleQuick(f);
    setQuickLocal((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  };
  // Carosello B collegato alla mappa: scorrendo, la card al centro diventa
  // quella "a fuoco"; se il fuoco arriva da fuori (tocco su un pin) il carosello
  // scorre fino alla card.
  const carouselRef = useRef<HTMLUListElement>(null);
  const hoveredId = useRef<string | null>(null);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const centeredId = () => {
    const ul = carouselRef.current;
    if (!ul) return null;
    const mid = ul.getBoundingClientRect().left + ul.clientWidth / 2;
    let best: { id: string; d: number } | null = null;
    for (const li of Array.from(ul.children) as HTMLElement[]) {
      const r = li.getBoundingClientRect();
      const d = Math.abs(r.left + r.width / 2 - mid);
      if (!best || d < best.d) best = { id: li.dataset.id ?? "", d };
    }
    return best?.id ?? null;
  };
  const onCarouselScroll = () => {
    if (carouselRef.current) atStart.current = carouselRef.current.scrollLeft < 8;
    if (!onFocus) return;
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      const id = centeredId();
      const place = places.find((p) => p.id === id);
      if (place && id !== focusedId) onFocus(place);
    }, 140);
  };
  useEffect(() => {
    const ul = carouselRef.current;
    if (!ul || !focusedId) return;
    const li = Array.from(ul.children).find((el) => (el as HTMLElement).dataset.id === focusedId) as HTMLElement | undefined;
    // Da computer la lista è verticale nel pannello: si porta la card in vista (se non lo è già),
    // ma non quando il fuoco arriva dal mouse sulla card stessa (la lista non deve scappare).
    if (li && window.matchMedia("(min-width: 1024px)").matches) { if (hoveredId.current !== focusedId) li.scrollIntoView({ block: "nearest", behavior: "smooth" }); return; }
    if (centeredId() === focusedId) return;
    if (li) ul.scrollTo({ left: li.offsetLeft - (ul.clientWidth - li.clientWidth) / 2, behavior: "smooth" });
  }, [focusedId]);
  useEffect(() => () => { if (scrollTimer.current) clearTimeout(scrollTimer.current); }, []);
  // Se l'ordine cambia (riordino per adattezza) mentre il carosello è sulla prima card, resta
  // sulla prima: il browser altrimenti lo riaggancia alla card di prima, finita in fondo.
  const atStart = useRef(true);
  useLayoutEffect(() => {
    const ul = carouselRef.current;
    if (ul && atStart.current && ul.scrollLeft !== 0) ul.scrollLeft = 0;
  }, [orderKey]);

  const [snap, setSnap] = useState<SnapKey>("medium");
  // Altezza in px imposta solo durante il drag; null = altezza controllata dallo snap.
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<DragState | null>(null);

  const cycleSnap = () =>
    setSnap((s) => ORDER[(ORDER.indexOf(s) + 1) % ORDER.length]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // Da computer la lista è un pannello fisso a fianco della mappa: niente trascinamento.
    if (window.matchMedia("(min-width: 1024px)").matches) return;
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
    <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 py-0.5 [scrollbar-width:none] [&>button]:shrink-0 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0" data-testid="filtri-lista">
      {onOpenArticle && (
        <button
          type="button"
          data-testid="apri-articolo"
          onClick={onOpenArticle}
          className="min-h-9 rounded-pill border border-brand bg-surface px-3 text-xs font-display font-semibold text-brand shadow-card"
        >
          ☰ Leggi la risposta
        </button>
      )}
      {quickFiltersOn && ([["open", "Aperto ora"], ["cheap", "Fino a €€"], ["top", "Voto 4,5+"]] as const).map(([k, label]) => (
        <button
          key={k}
          type="button"
          aria-pressed={quick.has(k)}
          onClick={() => toggleQuick(k)}
          className={`min-h-8 rounded-pill border px-2.5 text-xs font-sans font-medium ${quick.has(k) ? "border-brand bg-brand text-white" : "border-transparent bg-white/90 text-text-muted backdrop-blur lg:border-border lg:bg-surface"}`}
        >
          {label}
        </button>
      ))}
      {nearestOn && (
        <button
          type="button"
          aria-pressed={nearestFirst}
          onClick={() => setNearestFirst((v) => !v)}
          className={`min-h-8 rounded-pill border px-2.5 text-xs font-sans font-medium ${nearestFirst ? "border-brand bg-brand text-white" : "border-transparent bg-white/90 text-text-muted backdrop-blur lg:border-border lg:bg-surface"}`}
        >
          Più vicini
        </button>
      )}
    </div>
  );

  // Variante B (stile Places): carosello orizzontale di card scure sopra la barra di navigazione.
  if (variant === "b") {
    return (
      <div
        data-testid="lista-risultati"
        className="pointer-events-none absolute left-0 right-0 z-10 lg:pointer-events-auto lg:static lg:col-start-2 lg:row-start-2 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:border-l lg:border-border lg:pb-5"
        style={{ bottom: "var(--nav-height-mobile)" }}
      >
        {/* Intestazione in UNA riga (Lorenzo 16/10, "il dono della sintesi"): frase cercata + numero,
            un solo "⋯" che apre "Ho capito", i locali messi da parte, Affina e Condividi. */}
        <div className={`pointer-events-auto mx-3 mb-1.5 bg-surface shadow-float md:max-w-xl lg:mx-5 lg:max-w-none lg:shadow-none ${title || heading ? "rounded-card py-1 pl-4 pr-1" : "w-fit rounded-pill px-4 py-1.5"}`}>
          <div className="flex min-h-9 items-center gap-1">
            {title && (
              <p data-testid="titolo-risposta" onClick={() => setHeaderOpen((v) => !v)} className={`min-w-0 flex-1 ${headerOpen ? "" : "truncate"} font-title text-[15px] in-data-[titoli=serif]:text-lg font-semibold leading-snug text-brand first-letter:uppercase`}>
                {title}
              </p>
            )}
            {!title && heading && (
              <p data-testid="intestazione-lista" className="min-w-0 flex-1 truncate font-title text-[15px] font-semibold leading-snug text-brand">{heading}</p>
            )}
            <span data-testid="conteggio-risultati" className="shrink-0 text-xs font-sans text-text-muted">
              {loadingVerdicts
                ? "preparo i verdetti…"
                : title || heading ? `${places.length} ${places.length === 1 ? "posto" : "posti"}` : `${places.length} ${places.length === 1 ? "risultato" : "risultati"}`}
            </span>
            {title && (
              <button
                type="button"
                data-testid="opzioni-ricerca"
                aria-label="Opzioni della ricerca"
                aria-expanded={headerOpen}
                onClick={() => setHeaderOpen((v) => !v)}
                className={`ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-brand active:scale-95 ${headerOpen ? "bg-brand text-white" : "bg-bg"}`}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                  <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
                </svg>
              </button>
            )}
            {!title && heading && onShareList && places.length > 0 && (
              <button
                type="button"
                data-testid="condividi-lista"
                aria-label="Condividi questa lista"
                onClick={async () => {
                  trackFeature("condividi_lista");
                  const r = await onShareList(places);
                  if (r === "copied") { setShared(true); setTimeout(() => setShared(false), 2000); }
                }}
                className="ml-1 flex min-h-9 shrink-0 items-center gap-1.5 rounded-pill border border-border px-3 text-xs font-display font-semibold text-brand active:scale-95"
              >
                {shared ? "✓ Copiata" : (
                  <>
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0-12 4 4m-4-4-4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
                    </svg>
                    Condividi
                  </>
                )}
              </button>
            )}
            <button type="button" onClick={onClose} aria-label="Chiudi" className="flex h-9 w-9 shrink-0 items-center justify-center text-base text-text-muted">
              ✕
            </button>
          </div>
          {title && headerOpen && (
            <div data-testid="opzioni-pannello" className="mb-2 mr-3 mt-1 border-t border-border pt-2">
              {understood.length > 0 && (
                <p data-testid="ho-capito" className="text-xs font-sans text-accent">Ho capito: {understood.join(" · ")}</p>
              )}
              {setAside && (setAside.turistici.length > 0 || setAside.fuori_tema.length > 0) && (
                <p data-testid="messi-da-parte" className="mt-1 text-xs font-sans text-text-muted">
                  {/* "Molto famosi", non "turistici": la regola guarda solo il numero di recensioni (src/lib/mainstream.ts).
                      Il 14/10 dal vivo Bar Basso a Milano risultava "turistico": un'affermazione che non sappiamo (VISIONE: mai inventare). */}
                  🧭 {[
                    setAside.turistici.length > 0 ? `Ho messo da parte ${setAside.turistici.length === 1 ? "un locale molto famoso" : `${setAside.turistici.length} locali molto famosi`} (${setAside.turistici.slice(0, 2).join(", ")}${setAside.turistici.length > 2 ? "…" : ""})` : null,
                    setAside.fuori_tema.length > 0 ? `${setAside.turistici.length > 0 ? "e" : "Ho messo da parte"} ${setAside.fuori_tema.length === 1 ? "uno fuori tema" : `${setAside.fuori_tema.length} fuori tema`} (${setAside.fuori_tema.slice(0, 2).join(", ")}${setAside.fuori_tema.length > 2 ? "…" : ""})` : null,
                  ].filter(Boolean).join(" ")}
                </p>
              )}
              <div className="mt-2 flex gap-2">
                {onRefine && (
                  <button type="button" onClick={onRefine} className="flex min-h-9 items-center gap-1.5 rounded-pill bg-brand px-3 text-xs font-display font-semibold text-white active:scale-95">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 20h4L19 9l-4-4L4 16v4Z" />
                    </svg>
                    Affina
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Condividi questa ricerca"
                  onClick={async () => {
                    const at = shareAt ? `&at=${shareAt.lat.toFixed(4)},${shareAt.lng.toFixed(4)}` : "";
                    const url = `${window.location.origin}/mappa?q=${encodeURIComponent(title)}${at}`;
                    trackFeature("condividi_ricerca");
                    try {
                      if (typeof navigator.share === "function") await navigator.share({ title: "Mapetite", text: title, url });
                      else { await navigator.clipboard.writeText(url); setShared(true); setTimeout(() => setShared(false), 2000); }
                    } catch {
                      // foglio di condivisione chiuso: niente da segnalare
                    }
                  }}
                  className="flex min-h-9 items-center gap-1.5 rounded-pill border border-border px-3 text-xs font-display font-semibold text-brand active:scale-95"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0-12 4 4m-4-4-4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
                  </svg>
                  {shared ? "✓ Copiato" : "Condividi"}
                </button>
              </div>
            </div>
          )}
        </div>
        {(quickFiltersOn || onOpenArticle || nearestOn) && <div className="pointer-events-auto mx-3 mb-2 lg:mx-5">{quickChips}</div>}
        {places.length === 0 && (
          <p className="pointer-events-auto mx-3 mb-3 rounded-card bg-surface px-4 py-3 text-center text-sm text-text-muted shadow-float lg:mx-5 lg:shadow-none">{NO_MATCH}</p>
        )}
        <ul ref={carouselRef} onScroll={onCarouselScroll} className="pointer-events-auto flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-3 [scrollbar-width:none] lg:flex-col lg:snap-none lg:overflow-visible lg:px-5">
          {places.map((place) => {
            const d = details?.[place.id];
            // Un solo segnale sulla card: il tuo stato di salvataggio, altrimenti il 💎 (il nostro differenziatore).
            // Aperto/chiuso è un fatto: sta in fondo alla riga dei fatti, come nella scheda.
            const saved = onSave ? savedLabel?.(place.id) ?? null : null;
            const stato = savedMode ? (place.tags ?? []).find(isStateTag) : undefined;
            const gem = !stato && !saved && gemsOn && isGem(place.rating, d?.userRatingCount);
            return (
              <li key={place.id} data-id={place.id} onMouseEnter={onHover ? () => { if (window.matchMedia("(hover: hover) and (min-width: 1024px)").matches) { hoveredId.current = place.id; onHover(place); } } : undefined} className={`relative w-[78vw] max-w-sm shrink-0 snap-center lg:w-auto lg:max-w-none lg:rounded-card lg:transition-shadow ${focusedId === place.id ? "lg:ring-2 lg:ring-accent lg:ring-offset-2" : ""}`}>
                {onSave && (
                  <button
                    type="button"
                    onClick={() => onSave(place)}
                    aria-label={isSaved?.(place.id) ? `${place.name} è tra i salvati` : `Salva ${place.name}`}
                    aria-pressed={isSaved?.(place.id) ?? false}
                    className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-btn bg-white/20 text-white backdrop-blur active:scale-95"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill={isSaved?.(place.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} aria-hidden>
                      <path strokeLinejoin="round" d="M6 3.75h12a.75.75 0 0 1 .75.75v16.19l-6.75-4.5-6.75 4.5V4.5A.75.75 0 0 1 6 3.75Z" />
                    </svg>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onSelect(place)}
                  data-testid="card-risultato"
                  className="relative flex h-full min-h-[150px] w-full flex-col overflow-hidden rounded-card p-4 text-left text-white shadow-float active:scale-[0.99]"
                  style={{ background: coverGradient(place.category, place.name) }}
                >
                  {/* Copertina: colore della cucina e emoji grande in trasparenza. Resta sotto la foto,
                      così si vede anche quando la foto non arriva (quota finita). */}
                  <span aria-hidden data-testid="copertina" className="pointer-events-none absolute right-1 top-1 select-none text-[80px] leading-none opacity-25">{getCategoryEmoji(place.category, place.name)}</span>
                  {places.indexOf(place) < PHOTO_CARDS && d?.photoRef && (
                    <>
                      <PlacePhoto photoRef={d.photoRef} alt="" width={500} className="absolute inset-0 h-full w-full object-cover" />
                      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/60 to-black/10" />
                    </>
                  )}
                  {/* Testo sopra la foto: senza "relative" la foto assoluta lo copre. */}
                  <span className="relative flex flex-1 flex-col">
                    {(stato || saved || gem) && (
                      <span className={`flex ${onSave ? "pr-11" : ""}`}>
                        {/* Salvati (Lorenzo 16/10): card compatte e uguali, lo stato in alto come in Places. */}
                        {stato ? (
                          <span data-testid="stato-card" className="rounded-pill bg-accent px-2 py-0.5 text-[10px] font-display font-semibold">{tagLabel(stato)}</span>
                        ) : saved ? (
                          <span data-testid="etichetta-salvato" className="rounded-pill bg-accent px-2 py-0.5 text-[10px] font-display font-semibold">{saved}</span>
                        ) : (
                          <span data-testid="gemma" className="rounded-pill bg-accent px-2 py-0.5 text-[10px] font-display font-semibold">💎 Poco conosciuto</span>
                        )}
                      </span>
                    )}
                    <span className={`mt-auto pt-3 line-clamp-2 text-xl font-title in-data-[titoli=serif]:text-2xl font-semibold leading-tight ${onSave && !(stato || saved || gem) ? "pr-11" : ""}`}>{place.name}</span>
                    <span data-testid="riga-fatti" className="mt-0.5 flex min-w-0 items-center gap-1 text-xs font-sans text-white/80">
                      <span className="truncate">{cardFacts(place, origin, showCity)}</span>
                      {d?.openNow === true && (
                        <span className="flex shrink-0 items-center gap-1"><span aria-hidden>·</span><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-success" />Aperto ora</span>
                      )}
                      {/* Chiuso: lo si dice, senza nasconderlo (può servire per un'altra sera). */}
                      {d?.openNow === false && (
                        <span data-testid="chiuso-ora" className="shrink-0 text-white/60">· Chiuso ora</span>
                      )}
                    </span>
                    {similarTo?.(place.id) && (
                      <span data-testid="simile-a" className="mt-1 truncate text-xs font-sans font-semibold text-accent">✨ Come {similarTo(place.id)}, che hai salvato</span>
                    )}
                    {d?.verdict ? (
                      <span className="mt-1.5 block">
                        {/* Il verdetto si riconosce dal ✦ corallo; l'etichetta intera è nella scheda (e per i lettori di schermo). */}
                        <span data-testid="etichetta-verdetto" className="sr-only">Il verdetto Mapetite</span>
                        <span className={`${savedMode ? "line-clamp-1" : "line-clamp-2"} text-sm font-sans font-medium leading-snug text-white`}><span aria-hidden className="mr-1 text-accent">✦</span>{d.verdict}</span>
                      </span>
                    ) : loadingVerdicts && details ? (
                      <SkeletonLines dark />
                    ) : googleLine(d) ? (
                      <span data-testid="riga-google" className="mt-1.5 line-clamp-2 text-sm font-sans leading-snug text-white/80">{googleLine(d)}</span>
                    ) : null}
                    {/* Dati personali dei salvati: la tua nota (i tag restano nella scheda e nei filtri). */}
                    {place.note && (
                      <span className="mt-1 line-clamp-1 text-xs font-sans italic leading-snug text-white/80">“{place.note}”</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
          {/* In fondo al carosello, in una sola card: 👍/👎 in un tocco, poi l'email per chi vuole spiegare. */}
          {title && showSearchFeedback && !loadingVerdicts && places.length > 0 && (
            <li data-id="" className="w-[60vw] max-w-xs shrink-0 snap-center lg:w-auto lg:max-w-none">
              <div className="flex h-full min-h-[150px] flex-col justify-center gap-2 rounded-card bg-surface/95 p-4 shadow-float lg:min-h-0 lg:shadow-none">
                <UtileFeedback contesto="ricerca" risultati={places.length} />
                <a
                  data-testid="ricerca-feedback"
                  href={searchFeedbackMailto(title, places.map((p) => p.name))}
                  className="text-xs font-sans text-text-muted underline underline-offset-2"
                >
                  🤔 Questi risultati non vanno? Scrivimi
                </a>
              </div>
            </li>
          )}
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
      data-testid="lista-risultati"
      className="pointer-events-auto absolute left-0 right-0 mx-auto max-w-2xl z-10 flex flex-col overflow-hidden rounded-t-card bg-surface shadow-float lg:static lg:col-start-2 lg:row-start-2 lg:mx-0 lg:h-auto! lg:min-h-0 lg:max-w-none lg:rounded-none lg:border-l lg:border-border lg:bg-bg lg:pt-1 lg:shadow-none"
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
        className="flex w-full cursor-pointer items-center justify-center bg-surface py-2 lg:hidden"
        style={{ touchAction: "none" }}
      >
        <div className="h-1 w-10 rounded-pill bg-border" />
      </button>
      <div
        ref={contentRef}
        className="flex-1 overflow-y-auto px-3 pb-4 lg:px-5"
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
                ? `${places.length} ${places.length === 1 ? "posto scelto" : "posti scelti"} per te`
                : heading ? `${places.length} ${places.length === 1 ? "posto" : "posti"}` : `${places.length} ${places.length === 1 ? "risultato" : "risultati"}`}
              {loadingVerdicts && " · preparo i verdetti…"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="-my-2 -mr-1 flex h-11 w-11 select-none touch-manipulation items-center justify-center text-lg leading-none text-text-muted hover:text-text"
          >
            ✕
          </button>
        </div>
        {(quickFiltersOn || nearestOn) && <div className="px-1 pb-2">{quickChips}</div>}
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
                    <span className="truncate">{metaLine(place, details?.[place.id], origin, showCity)}</span>
                    {details?.[place.id]?.openNow === true && (
                      <span className="shrink-0 rounded-pill bg-success/10 px-1.5 py-0.5 text-[10px] font-display font-medium text-success">
                        Aperto ora
                      </span>
                    )}
                    {details?.[place.id]?.openNow === false && (
                      <span data-testid="chiuso-ora" className="shrink-0 rounded-pill bg-border/60 px-1.5 py-0.5 text-[10px] font-display font-medium text-text-muted">
                        Chiuso ora
                      </span>
                    )}
                    {gemsOn && isGem(place.rating, details?.[place.id]?.userRatingCount) && (
                      <span data-testid="gemma" className="shrink-0 rounded-pill bg-accent-light px-1.5 py-0.5 text-[10px] font-display font-semibold text-accent">
                        💎 Poco conosciuto
                      </span>
                    )}
                  </span>
                  {details?.[place.id]?.verdict ? (
                    <span className="mt-1.5 block text-sm font-sans font-medium leading-snug text-brand">
                      {details[place.id]!.verdict}
                    </span>
                  ) : loadingVerdicts && details ? (
                    <SkeletonLines />
                  ) : googleLine(details?.[place.id]) ? (
                    <span data-testid="riga-google" className="mt-1.5 line-clamp-2 text-sm font-sans leading-snug text-text-muted">
                      {googleLine(details?.[place.id])}
                    </span>
                  ) : null}
                  {details?.[place.id]?.matchReason && (
                    <span className="mt-1 line-clamp-2 text-xs font-sans leading-snug text-text-muted">
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
                      {sortTags(place.tags).map((t) => (
                        <span key={t} className="rounded-pill border border-accent/40 px-2 py-0.5 text-[11px] font-display font-medium text-accent">
                          {tagLabel(t)}
                        </span>
                      ))}
                    </span>
                  )}
                  {place.note && (
                    <span className="mt-1.5 line-clamp-2 text-xs font-sans italic text-text">
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
