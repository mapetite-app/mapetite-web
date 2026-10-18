"use client";

import { useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore, useTransition, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Map, { Layer, Marker, Source } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import Supercluster from "supercluster";
import { browserClient } from "@/lib/supabase/client-lazy";
import { getCategoryEmoji } from "@/lib/emoji";
import FiltersSheet, { type Filters, EMPTY_FILTERS, CATEGORIES, countActive, withDefaults } from "@/components/filters-sheet";
import { CUISINES, OCCASIONS, FEATURES, OPEN_AT, filterQueryWords, openAtSlot } from "@/lib/filter-options";
import VenueSheet, { ACTION_TILE } from "@/components/venue-sheet";
import AnswerArticle from "@/components/answer-article";
import BottomSheet, { applyQuickFilters, PHOTO_CARDS, type QuickFilter } from "@/components/bottom-sheet";
import PlacePhoto from "@/components/place-photo";
import InstallHint from "@/components/install-hint";
import VoiceButton from "@/components/voice-button";
import DragToClose from "@/components/drag-to-close";
import { Bookmark, ArrowUp, ChevronRight, Lightbulb, LocateFixed, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { clearRecentSearches, loadRecentSearches, saveRecentSearch, subscribeRecent, useBeta, useOptIn, useVariant } from "@/lib/beta";
import { cityFromAddress } from "@/lib/city";
import { sortTags, tagLabel, OPINION_LIKE, OPINION_DISLIKE } from "@/lib/tags";
import { distanceLabel, distanceMeters } from "@/lib/distance";
import { CATEGORY_TYPE_MAP } from "@/lib/category-types";
import { categoryLabel } from "@/lib/category-label";
import { momentSuggestion, fetchWeather, type Weather } from "@/lib/moment";
import { tasteQuery } from "@/lib/preferences";
import { overlayReducer, type Overlay, type OverlayAction } from "@/lib/panel-state";
import { track, trackFeature } from "@/lib/track";
import { labelsToHide, pinName } from "@/lib/pin-labels";
import { cityNear } from "@/lib/named-city";
import { prefetchIntent, intentFor } from "@/lib/intent-prefetch";
import { loginToSaveUrl, rememberPendingSave, takePendingSave } from "@/lib/pending-save";
import ClassificaScheda from "@/components/classifica-scheda";
import CommunityLocale from "@/components/community-locale";
import { votoOf } from "@/lib/diario";
import { surpriseFromMemory } from "@/lib/sorpresa";
import { filtraSalvatiNaturale } from "@/lib/cerca-salvati";
import { circlePolygon, nearNowQuery, radiusLabel } from "@/lib/vicino";
import { grantedPosition, readLastView, saveLastView } from "@/lib/last-view";
import { firmaPer, rememberFirme } from "@/lib/catalog-firme";

// Versione da computer (piano 6.5): da 1024px la mappa sta a sinistra e ricerca, lista e scheda
// in un pannello a destra (stesso breakpoint `lg:` delle classi). Sul telefono non cambia nulla.
const isDesktop = () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;

// Risultati di una ricerca sempre visibili come pin singoli (mai raggruppati).
const TOP_PINS = 5;

// Riepilogo dei filtri per l'intestazione dei risultati: "Pizzerie · entro 3 km · ★ 4,5+".
function filtersSummary(f: Filters): string {
  f = withDefaults(f);
  const parts: string[] = [];
  if (f.categories.length > 0) parts.push(f.categories.map((c) => CATEGORIES.find((x) => x.id === c)?.label ?? c).join(", "));
  if (f.cuisines.length > 0) parts.push(`cucina ${f.cuisines.map((c) => (CUISINES.find((x) => x.id === c)?.label ?? c).toLowerCase()).join(", ")}`);
  if (f.occasion) parts.push((OCCASIONS.find((x) => x.id === f.occasion)?.label ?? f.occasion).toLowerCase());
  if (f.features.length > 0) parts.push(f.features.map((c) => (FEATURES.find((x) => x.id === c)?.label ?? c).toLowerCase()).join(", "));
  if (f.zona.trim()) parts.push(`a ${f.zona.trim()}`);
  else if (f.radiusKm != null) parts.push(`entro ${radiusLabel(f.radiusKm)}${f.radiusFrom === "me" ? " da te" : ""}`);
  if (f.minPriceLevel != null) parts.push("€".repeat(f.minPriceLevel));
  if (f.minRating != null) parts.push(`★ ${String(f.minRating).replace(".", ",")}+`);
  if (f.minReviews != null) parts.push(`${f.minReviews}+ recensioni`);
  if (f.openAt) parts.push(OPEN_AT.find((x) => x.id === f.openAt)?.summary ?? "aperti all'ora scelta");
  else if (f.openNowOnly) parts.push("aperti ora");
  return parts.join(" · ");
}

const PRESET_TAGS = ["Da provare", "Già visitato", "Romantico", "Economico", "Speciale", "Con amici"];
const VISIT_WANT = "Da provare";
const VISIT_DONE = "Già visitato";
type VisitStatus = typeof VISIT_WANT | typeof VISIT_DONE;

function SaveModal({
  place,
  userId,
  mode = "save",
  initialTags = [],
  initialNote = "",
  onSaved,
  onCancel,
  photoRef = null,
  reviewCount = null,
  knownTags = [],
}: {
  place: Place;
  userId: string;
  mode?: "save" | "edit";
  initialTags?: string[];
  initialNote?: string;
  onSaved: (tags: string[] | null, note: string | null, uuid?: string) => void;
  onCancel: () => void;
  photoRef?: string | null;
  // Numero di recensioni Google già arrivato: solo per "poco conosciuto" (Scopritori), non si salva.
  reviewCount?: number | null;
  // Tag che l'utente ha già usato sugli altri salvati (oltre a quelli proposti).
  knownTags?: string[];
}) {
  // Variante stile Places (?beta=salva): foglio dal basso con "Voglio andarci / Ci sono stato".
  const sheetOn = useOptIn("salva");
  // Nel foglio nuovo salvare vuol dire "voglio andarci" finché non si sceglie altro (come Places).
  const [selectedTags, setSelectedTags] = useState<string[]>(() =>
    sheetOn && mode === "save" && initialTags.length === 0 ? [VISIT_WANT] : initialTags,
  );
  const [note, setNote] = useState(initialNote);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  const toggleTag = (tag: string) => {
    // "Voglio andarci" e "Ci sono stato" si escludono a vicenda, come nella scheda.
    const other = tag === VISIT_WANT ? VISIT_DONE : tag === VISIT_DONE ? VISIT_WANT : null;
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev.filter((t) => t !== other), tag]
    );
  };

  // Tag scritti dall'utente (come le raccolte di Places): stessa colonna tags, nessuna migrazione.
  const tagOptions = Array.from(new Set([...PRESET_TAGS, ...knownTags, ...selectedTags]));
  const [newTag, setNewTag] = useState<string | null>(null);
  // Testo scritto → tag (spazi ripuliti, maiuscola iniziale, stesso tag se esiste già).
  const normalizeNewTag = (text: string | null): string | null => {
    const raw = (text ?? "").trim().replace(/\s+/g, " ").slice(0, 24);
    if (raw === "") return null;
    // Anche l'etichetta mostrata ("voglio andarci") porta allo stato salvato ("Da provare").
    const same = (t: string) => t.toLowerCase() === raw.toLowerCase() || tagLabel(t).replace(/^[^\p{L}]+/u, "").toLowerCase() === raw.toLowerCase();
    return tagOptions.find(same) ?? raw.charAt(0).toUpperCase() + raw.slice(1);
  };
  // Aggiunge un tag; se è uno stato ("Da provare" / "Già visitato") toglie l'altro.
  const withTag = (prev: string[], tag: string): string[] => {
    if (prev.includes(tag)) return prev;
    const other = tag === VISIT_WANT ? VISIT_DONE : tag === VISIT_DONE ? VISIT_WANT : null;
    return [...prev.filter((t) => t !== other), tag];
  };
  const addNewTag = () => {
    const tag = normalizeNewTag(newTag);
    setNewTag(null);
    if (tag) setSelectedTags((prev) => withTag(prev, tag));
  };
  const newTagControl = (chipClass: string) =>
    newTag === null ? (
      <button type="button" data-testid="nuovo-tag" onClick={() => setNewTag("")} className={chipClass}>
        + Nuovo tag
      </button>
    ) : (
      <input
        autoFocus
        value={newTag}
        onChange={(e) => setNewTag(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNewTag(); } if (e.key === "Escape") setNewTag(null); }}
        onBlur={addNewTag}
        maxLength={24}
        enterKeyHint="done"
        placeholder="es. Brunch, Da Milano…"
        aria-label="Nuovo tag"
        className="min-h-9 w-40 rounded-pill border border-brand bg-white px-3 text-base font-sans text-text focus:outline-none"
      />
    );

  // Mentre salva, Esc non chiude la finestra (l'eventuale errore resterebbe invisibile).
  useEffect(() => {
    if (!isPending) return;
    const block = (e: KeyboardEvent) => { if (e.key === "Escape") e.stopImmediatePropagation(); };
    window.addEventListener("keydown", block, true);
    return () => window.removeEventListener("keydown", block, true);
  }, [isPending]);

  const handleSave = () => {
    setError(false);
    startTransition(async () => {
      const supabase = await browserClient();
      // Tag scritto ma non ancora confermato (su iPhone il campo può restare attivo toccando Salva).
      const pending = normalizeNewTag(newTag);
      const allTags = pending ? withTag(selectedTags, pending) : selectedTags;
      const tags = allTags.length > 0 ? allTags : null;
      const noteValue = note.trim() || null;

      let savedUuid: string | undefined;

      if (mode === "edit") {
        const { error } = await supabase
          .from("saved_places")
          .update({ tags, note: noteValue })
          .eq("user_id", userId)
          // place.id qui e' gia' l'UUID (vista saved)
          .eq("place_id", place.id);
        if (error) { setError(true); return; }
      } else {
        // 1. crea/trova il locale in places via endpoint (ottiene UUID + salva rating/prezzo)
        const addRes = await fetch("/api/places/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            googlePlaceId: place.id,
            name: place.name,
            address: place.address ?? "",
            lat: place.lat,
            lng: place.lng,
            category: place.category,
            rating: place.rating,
            priceLevel: place.priceLevel,
            userRatingCount: reviewCount,
            firma: firmaPer(place.id),
          }),
        });
        if (!addRes.ok) { setError(true); return; }
        const addData = await addRes.json();
        const placeUuid: string = addData.place.id;
        savedUuid = placeUuid;

        // 2. collega in saved_places con l'UUID
        const { error } = await supabase
          .from("saved_places")
          .insert({ user_id: userId, place_id: placeUuid, tags, note: noteValue });
        if (error?.code === "23505") {
          // Era già salvato (la mappa non lo sapeva ancora): si aggiornano tag e nota scelti
          // qui, invece di mostrarli e perderli al prossimo caricamento.
          const { error: upErr } = await supabase
            .from("saved_places")
            .update({ tags, note: noteValue })
            .eq("user_id", userId)
            .eq("place_id", placeUuid);
          if (upErr) { setError(true); return; }
        } else if (error) { setError(true); return; }
      }

      onSaved(tags, noteValue, savedUuid);
    });
  };

  if (sheetOn) {
    const visit = selectedTags.includes(VISIT_DONE) ? VISIT_DONE : selectedTags.includes(VISIT_WANT) ? VISIT_WANT : null;
    const setVisit = (v: VisitStatus) =>
      setSelectedTags((prev) => {
        const rest = prev.filter((t) => t !== VISIT_WANT && t !== VISIT_DONE);
        return visit === v ? rest : [v, ...rest];
      });
    return (
      // Sopra la barra in basso: la mappa è un contesto a parte e la barra resterebbe sopra il foglio.
      <div data-testid="salva-foglio" className="fixed inset-x-0 top-0 z-50 flex items-end justify-center bg-black/40" style={{ bottom: "var(--nav-height-mobile)" }} onClick={() => { if (!isPending) onCancel(); }}>
        <div
          role="dialog"
          aria-label={mode === "edit" ? `Modifica ${place.name}` : `Salva ${place.name}`}
          onClick={(e) => e.stopPropagation()}
          className="max-h-full w-full max-w-lg overflow-y-auto rounded-t-card bg-surface px-5 pb-3 pt-2 shadow-float"
        >
          <div className="mx-auto mb-3 h-1 w-10 rounded-pill bg-border" />
          <div className="flex items-center gap-3 border-b border-border pb-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-btn bg-accent-light text-2xl">
              <PlacePhoto photoRef={photoRef} alt="" width={500} className="h-full w-full object-cover" fallback={getCategoryEmoji(place.category, place.name)} />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-sans text-text-muted">{mode === "edit" ? "Tra i tuoi salvati" : "Salva"}</span>
              <span className="block truncate font-title text-lg font-semibold text-brand">{place.name}</span>
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-1 rounded-pill bg-brand/5 p-1" role="group" aria-label="Stato">
            {([[VISIT_WANT, "📌 Voglio andarci"], [VISIT_DONE, "✓ Ci sono stato"]] as const).map(([v, label]) => (
              <button
                key={v}
                type="button"
                aria-pressed={visit === v}
                onClick={() => setVisit(v)}
                className={`min-h-11 rounded-pill text-sm font-display font-semibold transition-colors ${visit === v ? "bg-white text-brand shadow-card" : "text-text-muted"}`}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="mt-3 block">
            <span className="sr-only">Nota personale</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="✎ Scrivi una nota (solo per te)"
              rows={2}
              className="w-full resize-none rounded-card border border-border bg-white px-4 py-3 text-base font-sans text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </label>

          <p className="mb-2 mt-3 text-xs font-display font-semibold uppercase tracking-wider text-text-muted">I tuoi tag</p>
          <div className="flex flex-wrap gap-2">
            {tagOptions.filter((t) => t !== VISIT_WANT && t !== VISIT_DONE).map((tag) => (
              <button
                key={tag}
                type="button"
                aria-pressed={selectedTags.includes(tag)}
                onClick={() => toggleTag(tag)}
                className={`min-h-9 rounded-pill border px-3.5 text-sm font-display font-medium ${selectedTags.includes(tag) ? "border-brand bg-brand text-white" : "border-border bg-white text-text"}`}
              >
                {tag}
              </button>
            ))}
            {newTagControl("min-h-9 rounded-pill border border-dashed border-brand/50 px-3.5 text-sm font-display font-medium text-brand")}
          </div>

          {error && <p className="mt-3 text-sm text-error">Non sono riuscito a salvare. Controlla la connessione e riprova.</p>}

          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="mt-5 min-h-12 w-full rounded-pill bg-brand text-base font-display font-semibold text-white active:scale-[0.99] disabled:opacity-60"
          >
            {isPending ? "Salvo…" : "Fatto"}
          </button>
          <button type="button" onClick={onCancel} disabled={isPending} className="mt-1 min-h-11 w-full text-sm font-display font-semibold text-text-muted disabled:opacity-60">
            Annulla
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-80 max-w-[90vw] rounded-card bg-surface p-5 shadow-float">
        <h2 className="mb-3 text-base font-display font-semibold text-text">
          {mode === "edit" ? "Modifica locale" : "Salva locale"}
        </h2>

        <p className="mb-2 text-xs font-sans text-text-muted">Tag</p>
        <div className="mb-4 flex flex-wrap gap-2">
          {tagOptions.map((tag) => (
            <button
              key={tag}
              type="button"
              aria-pressed={selectedTags.includes(tag)}
              onClick={() => toggleTag(tag)}
              className={
                selectedTags.includes(tag)
                  ? "min-h-10 rounded-pill bg-brand px-3 py-1 text-xs font-display font-semibold text-white"
                  : "min-h-10 rounded-pill bg-accent-light px-3 py-1 text-xs font-display font-semibold text-accent hover:opacity-80"
              }
            >
              {tagLabel(tag)}
            </button>
          ))}
          {newTagControl("min-h-10 rounded-pill border border-dashed border-accent/60 px-3 py-1 text-xs font-display font-semibold text-accent")}
        </div>

        <p className="mb-1 text-xs font-sans text-text-muted">Nota personale</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Aggiungi una nota..."
          rows={3}
          className="w-full resize-none rounded-btn border border-border px-3 py-2 text-base font-sans focus:outline-none focus:ring-2 focus:ring-brand"
        />

        {error && (
          <p className="mt-1 text-sm text-error">
            Errore durante il salvataggio. Riprova.
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="min-h-11 flex-1 rounded-btn bg-brand px-3 py-2 text-sm font-display font-semibold text-white hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "..." : "Salva"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="min-h-11 flex-1 rounded-btn border border-border bg-surface px-3 py-2 text-sm font-display font-semibold text-text-muted hover:text-text disabled:opacity-60"
          >
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
}

const OTHER_CITY = "Altre zone";
const CHIP_ON = "min-h-10 rounded-pill bg-brand px-3 py-1.5 text-xs font-display font-semibold text-white";
const CHIP_ACTIVE = "flex min-h-8 items-center gap-1 rounded-pill bg-brand px-2.5 text-xs font-display font-semibold text-white active:scale-95";
const CHIP_CITY = "min-h-10 rounded-pill border border-border bg-white px-3 py-1.5 text-xs font-display font-semibold text-brand hover:opacity-80";

// Salvati filtrati per tag, città e testo (nome, categoria, indirizzo, nota, tag). Il testo si
// capisce anche come frase (4.5): "quel giapponese che avevo salvato a Milano".
const savedText = (p: Place) => [p.name, categoryLabel(p.category), p.category, p.address, p.note, ...(p.tags ?? []).map(tagLabel), ...(p.tags ?? [])]
  .filter(Boolean).join(" ");
function filterSaved(list: Place[], tag: string | null, city: string | null, query: string): Place[] {
  const q = query.trim().toLocaleLowerCase("it");
  const base = list.filter((p) => {
    if (tag !== null && !p.tags?.includes(tag)) return false;
    if (city !== null && (cityFromAddress(p.address) ?? OTHER_CITY) !== city) return false;
    return true;
  });
  if (!q) return base;
  const plain = base.filter((p) => [p.name, p.category, p.address, p.note, ...(p.tags ?? [])]
    .some((v) => v != null && v.toLocaleLowerCase("it").includes(q)));
  if (plain.length > 0) return plain;
  return filtraSalvatiNaturale(base, q, savedText, (p) => p.tags);
}

// Salvati che c'entrano con la frase scritta nella barra (voce 11d): basta una parola
// significativa (4+ lettere) in nome, tipo, indirizzo, nota o tag. Solo dati già nel telefono.
const STOP_WORDS = new Set(["dove", "posto", "locale", "locali", "vicino", "buono", "buona", "qualcosa", "stasera", "oggi", "questa", "questo", "sera", "tipo", "fare", "andare", "voglio", "cerco"]);
function savedMatches(list: Place[], query: string, max = 3): Place[] {
  const words = query.toLocaleLowerCase("it").split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 4 && !STOP_WORDS.has(w));
  if (words.length === 0) return [];
  // Prima i salvati che rispondono a tutta la frase ("il giapponese di Milano"), poi quelli con più parole in comune.
  const whole = new Set(filtraSalvatiNaturale(list, query, savedText, (p) => p.tags).map((p) => p.id));
  const scored = list.map((p) => {
    const text = [p.name, categoryLabel(p.category), p.category, p.address, p.note, ...(p.tags ?? []).map(tagLabel)]
      .filter(Boolean).join(" ").toLocaleLowerCase("it");
    return { p, n: words.filter((w) => text.includes(w)).length + (whole.has(p.id) ? 100 : 0) };
  }).filter((x) => x.n > 0);
  return scored.sort((a, b) => b.n - a.n).slice(0, max).map((x) => x.p);
}

// "Per te" dai comportamenti (VISIONE.md): un risultato somiglia a un tuo salvato se è dello
// stesso tipo e della stessa fascia di prezzo (±1). Si sceglie il salvato più vicino. Solo
// un'indicazione sulla card: l'ordine resta quello della richiesta (mai sopra un posto più adatto).
// Solo salvati entro SIMILAR_MAX_METERS (14/10): prima un ristorante salvato a Milano finiva
// su quasi ogni "Ristorante" cercato a Roma, un'affermazione senza fondamento.
const SIMILAR_MAX_METERS = 15_000;
// "Sei vicino a un locale che volevi provare": entro ~10 minuti a piedi.
const NEARBY_SAVED_METERS = 800;
function similarSaved(place: Place, saved: Place[]): string | null {
  const kind = categoryLabel(place.category);
  if (!kind) return null;
  let best: { name: string; d: number } | null = null;
  for (const s of saved) {
    if (s.name === place.name || categoryLabel(s.category) !== kind || s.tags?.includes(OPINION_DISLIKE)) continue;
    if (place.priceLevel != null && s.priceLevel != null && Math.abs(place.priceLevel - s.priceLevel) > 1) continue;
    const d = distanceMeters(s, place);
    if (d > SIMILAR_MAX_METERS) continue;
    if (!best || d < best.d) best = { name: s.name, d };
  }
  return best?.name ?? null;
}

// Salvati non caricati: senza rete o con la pagina che cambia a metà richiesta ("Failed to fetch")
// è normale e non va segnalato come errore; il resto sì.
function logSavedError(error: { message?: string }) {
  if (/Failed to fetch|NetworkError|Load failed/i.test(error.message ?? "")) console.warn("Salvati non caricati (rete):", error.message);
  else console.error("Errore nel caricamento dei locali salvati:", error);
}

// Mappa più pulita (RIFERIMENTI-DESIGN: niente mappa affollata di punti non pertinenti):
// nasconde le etichette dei punti d'interesse Mapbox (hotel, chiese, negozi), restano strade e quartieri.
type MapStyleApi = {
  getStyle: () => { layers?: { id: string }[] } | undefined;
  getLayoutProperty: (id: string, k: string) => unknown;
  setLayoutProperty: (id: string, k: string, v: string) => void;
};
function hidePoiLabels(map: MapStyleApi) {
  try {
    for (const layer of map.getStyle()?.layers ?? []) {
      if (/poi-label|transit-label/.test(layer.id) && map.getLayoutProperty(layer.id, "visibility") !== "none") {
        map.setLayoutProperty(layer.id, "visibility", "none");
      }
    }
  } catch {
    // stile non pronto: resta com'è
  }
}

export type Place = {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  lat: number;
  lng: number;
  tags: string[] | null;
  note: string | null;
  rating: number | null;
  priceLevel: number | null;
};

function SaveButton({
  placeId,
  googlePlaceId,
  userId,
  isSaved,
  onToggle,
  onSaveRequest,
  onLoginRequest,
}: {
  placeId: string;        // UUID canonico Supabase: usato per delete e onToggle
  googlePlaceId: string;  // ID Google: usato per il salvataggio (/api/places/add)
  userId: string | null;
  isSaved: boolean;
  onToggle: (placeId: string, saved: boolean) => void;
  onSaveRequest: (googlePlaceId: string) => void;
  onLoginRequest?: () => void;
}) {
  const tile = useVariant("scheda") === "b";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  const handleClick = () => {
    if (!userId) {
      if (onLoginRequest) onLoginRequest();
      else router.push("/login");
      return;
    }

    if (!isSaved) {
      onSaveRequest(googlePlaceId);
      return;
    }

    const conferma = window.confirm(
      "Vuoi rimuovere questo locale dai salvati? Perderai i tag e le note che hai aggiunto."
    );
    if (!conferma) return;

    setError(false);
    startTransition(async () => {
      const supabase = await browserClient();
      const { error } = await supabase
        .from("saved_places")
        .delete()
        .eq("user_id", userId)
        .eq("place_id", placeId);

      if (error) {
        setError(true);
        return;
      }
      onToggle(placeId, false);
    });
  };

  // Scheda B (stile Places): Salva è il terzo riquadro della barra azioni flottante.
  if (tile) {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-label={error ? "Errore durante il salvataggio. Riprova." : undefined}
        className={`${ACTION_TILE} ${error ? "bg-error" : isSaved ? "bg-success" : "bg-white/10"} disabled:opacity-60`}
      >
        <Bookmark size={18} aria-hidden fill={isSaved ? "currentColor" : "none"} />
        {isPending ? "..." : error ? "Riprova" : isSaved ? "Salvato" : "Salva"}
      </button>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={
          isSaved
            ? "min-h-11 rounded-pill bg-success px-4 text-sm font-display font-semibold text-white hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
            : "min-h-11 rounded-pill bg-accent px-4 text-sm font-display font-semibold text-white hover:opacity-90 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
        }
      >
        {isPending ? "..." : isSaved ? "Salvato" : "Salva"}
      </button>
      {error && (
        <p className="mt-1 text-sm text-error">
          Errore durante il salvataggio. Riprova.
        </p>
      )}
    </div>
  );
}

type SearchResult = {
  id: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  category: string | null;
};


type AIFiltri = {
  categoria: string | null;
  parole_chiave: string[];
  vicino_a_me: boolean;
  zona?: string | null;
};

// Dati firmati dal server per chiedere i verdetti dopo la prima risposta.
type PendingSynthesis = { places: unknown[]; token: string; gruppi?: { places: unknown[]; token: string }[] };

// Cosa ha capito la ricerca: tipo, requisiti, "vicino a te" o la zona nominata.
function filtriParts(filtri: AIFiltri): string[] {
  const parts: string[] = [];
  if (filtri.categoria) parts.push(categoryLabel(filtri.categoria) as string);
  parts.push(...filtri.parole_chiave);
  if (filtri.vicino_a_me) parts.push("vicino a te");
  else if (filtri.zona) parts.push(`a ${filtri.zona}`);
  return parts;
}

function buildAISummary(filtri: AIFiltri): string {
  const parts = filtriParts(filtri);
  return "Ho cercato: " + (parts.length > 0 ? parts.join(" · ") : "qualsiasi locale");
}

// Dettaglio editoriale di un locale, tenuto a lato del marker leggero `Place`
// (Place resta minimale perché Supercluster ne renderizza a centinaia).
type VenueDetails = {
  userRatingCount: number | null;
  openNow: boolean | null;
  websiteUri: string | null;
  phone: string | null;
  selectedReviews: { text: string }[] | null;
  synthesis: string | null;
  tags: string[] | null;
  verdict: string | null;
  goFor: string[] | null;
  dontExpect: string[] | null;
  matchReason: string | null;
  photoRef?: string | null;
  photoAuthor?: string | null;
  editorialSummary?: string | null;
};

const REFINEMENTS = ["+ economico", "+ con tavoli all'aperto", "+ aperto adesso", "+ poco turistico", "+ per un gruppo"];
const PANEL_EXAMPLES = ["Aperitivo con vista", "Pizza napoletana vera", "Cena tranquilla per due", "Brunch nel weekend"];

function AISearchPanel({
  onSubmit,
  isSearching,
  error,
  onClear,
  activeFiltri,
  activeCount,
  query,
  setQuery,
  recent = [],
  withInput = true,
}: {
  onSubmit: (q: string) => void;
  isSearching: boolean;
  error: string | null;
  onClear: () => void;
  activeFiltri: AIFiltri | null;
  activeCount: number | null;
  query: string;
  setQuery: (q: string) => void;
  recent?: string[];
  // Con la barra in alto il campo c'è già: il pannello mostra solo aggiunte rapide e riepilogo.
  withInput?: boolean;
}) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    onSubmit(query.trim());
  };

  return (
    <div className="rounded-card bg-surface p-3 shadow-float">
      {withInput && <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cosa cerchi?"
          enterKeyHint="search"
          autoFocus={query === ""}
          className="min-h-11 flex-1 min-w-0 rounded-btn border border-border bg-white px-3 text-base font-sans text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <button
          type="submit"
          disabled={isSearching}
          className="min-h-11 shrink-0 rounded-btn bg-brand px-4 text-sm font-display font-semibold text-white hover:opacity-90 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSearching ? "..." : "Cerca"}
        </button>
        {activeFiltri !== null && (
          <button
            type="button"
            onClick={() => { setQuery(""); onClear(); }}
            aria-label="Azzera ricerca AI"
            className="shrink-0 rounded-btn px-2 text-lg font-bold text-text-muted hover:text-text"
          >
            ✕
          </button>
        )}
      </form>}

      {isSearching && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-text-muted">
          <span className="inline-block h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-border border-t-brand" />
          Sto cercando…
        </p>
      )}

      {error && <p className="mt-2 text-sm text-error">{error}</p>}

      {/* Aggiunte rapide: con una ricerca attiva affinano la frase, altrimenti sono esempi. */}
      {!isSearching && (
        <div className={`-mx-3 flex gap-1.5 overflow-x-auto px-3 [scrollbar-width:none] ${withInput ? "mt-2" : ""}`} data-testid="aggiunte-rapide">
          {(activeFiltri !== null ? REFINEMENTS : [...recent.map((r) => `↻ ${r}`), ...PANEL_EXAMPLES].slice(0, 6)).map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => {
                const next = activeFiltri !== null ? `${query.trim()} ${chip.replace(/^\+ /, "")}` : chip.replace(/^↻ /, "");
                setQuery(next);
                onSubmit(next);
              }}
              className="min-h-9 shrink-0 rounded-pill border border-border bg-white px-3 text-xs font-display font-medium text-text active:scale-95"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {activeFiltri !== null && !isSearching && (
        <p className="mt-2 text-sm font-sans text-text-muted">
          {buildAISummary(activeFiltri)}
          {activeCount !== null && (
            <span className="ml-1 text-text-muted">
              · {activeCount} {activeCount === 1 ? "locale trovato" : "locali trovati"}
            </span>
          )}
        </p>
      )}
    </div>
  );
}

type ViewMode = "all" | "saved";

// Ricerche di esempio del primo accesso (titolo + seconda riga per le schede della variante B).
const WELCOME_EXAMPLES = [
  { query: "Rooftop romantico per due a Roma", title: "Rooftop romantico", sub: "per due a Roma" },
  { query: "Trattoria autentica non turistica a Trastevere", title: "Trattoria autentica", sub: "non turistica a Trastevere" },
  { query: "Colazione buona qui vicino", title: "Colazione buona", sub: "qui vicino" },
  { query: "Cocktail bar elegante per un appuntamento", title: "Cocktail bar elegante", sub: "per un appuntamento" },
];

// Pannello "Ti suggeriamo": gruppi brevi (Adesso · Per te · Recenti · Prova a chiedere), una riga per idea.
function IdeaGroup({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-1 first-of-type:mt-0">
      <div className="flex min-h-8 items-center justify-between px-2">
        <p className="text-xs font-display font-semibold uppercase tracking-wide text-text-muted">{title}</p>
        {action}
      </div>
      <ul className="flex flex-col">{children}</ul>
    </section>
  );
}

function IdeaRow({ emoji, title, sub, label, onClick, href, testId }: { emoji: string; title: string; sub?: string; label?: string; onClick?: () => void; href?: string; testId?: string }) {
  const inner = (
    <>
      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg text-base">{emoji}</span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block text-[15px] font-sans font-medium leading-tight text-text">{title}</span>
        {sub && <span className="block truncate text-xs font-sans text-text-muted">{sub}</span>}
      </span>
      <ChevronRight size={16} aria-hidden className="shrink-0 text-text-muted" />
    </>
  );
  const cls = "flex min-h-12 w-full items-center gap-3 rounded-btn px-2 py-1.5 text-left active:bg-brand-light";
  return (
    <li>
      {href ? (
        <Link href={href} data-testid={testId} aria-label={label} className={cls}>{inner}</Link>
      ) : (
        <button type="button" data-testid={testId} aria-label={label} onClick={onClick} className={cls}>{inner}</button>
      )}
    </li>
  );
}

export default function MapView({
  places: initialPlaces,
  userId,
}: {
  places: Place[];
  userId: string | null;
}) {
  const [places, setPlaces] = useState<Place[]>(initialPlaces);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [view, setView] = useState<ViewMode>("all");
  const [savedPlaces, setSavedPlaces] = useState<Place[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  // Salvati letti almeno una volta (il salvataggio rimandato dopo il login aspetta questo).
  const [savedLoaded, setSavedLoaded] = useState(false);
  const [savedIdsLoaded, setSavedIdsLoaded] = useState(false);
  // Verdetti dei salvati (place_synthesis, per UUID): restano anche quando una ricerca
  // sostituisce venueDetails.
  const savedSynthRef = useRef<Record<string, VenueDetails>>({});
  const [viewState, setViewState] = useState({ longitude: 12.4964, latitude: 41.9028, zoom: 11 });
  const mapRef = useRef(null);
  const [pendingSavePlaceId, setPendingSavePlaceId] = useState<string | null>(null);
  // Stato scelto in scheda prima di aprire Salva ("Voglio andarci" / "Ci sono stato"); vuoto dal segnalibro.
  const [pendingSaveTags, setPendingSaveTags] = useState<string[]>([]);
  // Salvato da aprire appena arrivano i salvati (link dal profilo: /mappa?salvato=UUID).
  const openSavedRef = useRef<string | null>(null);
  const [pendingEditPlace, setPendingEditPlace] = useState<Place | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  // Salvati (voce 8): ricerca per testo e filtro per città ricavata dall'indirizzo.
  const [savedQuery, setSavedQuery] = useState("");
  const savedFitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeCity, setActiveCity] = useState<string | null>(null);
  // "I miei salvati" in una riga (Lorenzo 16/10, "il dono della sintesi"): stato, città, raccolte e
  // ordine stanno nel foglio "Filtri"; sullo schermo restano solo la ricerca e i filtri accesi.
  const [savedSheetOpen, setSavedSheetOpen] = useState(false);
  const [savedNearest, setSavedNearest] = useState(false);
  // Suggerimento "Per te" nella card iniziale, dai gusti indicati nell'onboarding.
  const [tasteSuggestion, setTasteSuggestion] = useState<string | null>(null);
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    browserClient()
      .then((supabase) => supabase
        .from("profiles")
        .select("cuisines, occasions, atmospheres, price_range")
        .eq("id", userId)
        .maybeSingle())
      .then(({ data }) => {
        if (!alive || !data) return;
        setTasteSuggestion(tasteQuery({
          cuisines: (data.cuisines as string[] | null) ?? [],
          occasions: (data.occasions as string[] | null) ?? [],
          atmospheres: (data.atmospheres as string[] | null) ?? [],
          priceRange: (data.price_range as string | null) ?? null,
        }));
      });
    return () => { alive = false; };
  }, [userId]);
  // Card al centro del carosello B: il suo pin è evidenziato sulla mappa.
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [aiSearch, setAiSearch] = useState<{ risultati: Place[]; filtri: AIFiltri | null; id?: number; query?: string; daParte?: { turistici: string[]; fuori_tema: string[]; fuori_zona?: string[] } | null } | null>(null);
  // true mentre arriva il secondo tempo della ricerca (verdetti, esclusioni).
  const [loadingVerdicts, setLoadingVerdicts] = useState(false);
  const searchSeq = useRef(0);
  // Filtri rapidi della lista: valgono anche per i pin sulla mappa.
  const [quickFilters, setQuickFilters] = useState<Set<QuickFilter>>(new Set());
  // true quando l'utente sposta la mappa a mano dopo una ricerca → "Cerca in quest'area".
  const [movedSinceSearch, setMovedSinceSearch] = useState(false);
  // Mappa chiara (grigia stile Places) per tutti dal 17/10; ?mappa=standard torna a quella colorata e resta sul telefono.
  const mapVariant = useSyncExternalStore(
    () => () => {},
    () => {
      const v = new URLSearchParams(window.location.search).get("mappa");
      try {
        if (v === "chiara" || v === "standard") window.localStorage.setItem("mapetite.mappa", v);
        return window.localStorage.getItem("mapetite.mappa") ?? "chiara";
      } catch {
        return v ?? "chiara";
      }
    },
    () => "chiara",
  );
  // Variante grafica della lista risultati (voce 5): scelta di Lorenzo 11/10 = B
  // (carosello). ?lista=a riporta la variante A finché non la si rimuove.
  const listVariant = useSyncExternalStore(
    () => () => {},
    () => (new URLSearchParams(window.location.search).get("lista") === "a" ? "a" : "b"),
    () => "b" as const,
  );
  // Suggerimento legato all'ora del telefono: solo sul client (sul server l'ora non è quella dell'utente).
  const momentHour = useSyncExternalStore(
    () => () => {},
    () => new Date().getHours(),
    () => null,
  );
  // Meteo per il suggerimento (piano 2.3): una volta, al centro iniziale della mappa.
  const [weather, setWeather] = useState<Weather | null>(null);
  const firstView = useRef(viewState);
  useEffect(() => {
    let alive = true;
    const at = readLastView() ?? { lat: firstView.current.latitude, lng: firstView.current.longitude };
    void fetchWeather(at.lat, at.lng).then((w) => { if (alive) setWeather(w); });
    return () => { alive = false; };
  }, []);
  const momentExample = momentHour == null ? null : momentSuggestion(new Date(), weather);
  // Testo della ricerca AI: vive qui perché il pannello si smonta alla chiusura.
  const [aiQuery, setAiQuery] = useState("");
  const [aiSearching, setAiSearching] = useState(false);
  // Schermata di benvenuto: sparisce alla prima interazione.
  const recentOn = useBeta("recenti");
  const shareOn = useBeta("condividi");
  // "🎲 Scegli tu" tra i salvati (?beta=sorprendimi, spento di default).
  const pickOn = useOptIn("sorprendimi");
  // 🎤 nella barra (?beta=voce, spento di default).
  const voiceOn = useOptIn("voce");
  const savedPinsOn = useOptIn("pin-salvati");
  // Risposta "come un articolo" (?beta=articolo, spenta di default).
  const articleOn = useOptIn("articolo");
  // Campo "Chiedi all'AI" + pulsante "Filtri" sempre visibili in cima alla mappa (scelta di Lorenzo 11/10).
  // ?beta=-barra riporta l'icona ✨ di prima.
  const barOn = useBeta("barra");
  const barInputRef = useRef<HTMLInputElement>(null);
  const [articleOpen, setArticleOpen] = useState(false);
  const recentSearches = useSyncExternalStore(
    subscribeRecent,
    () => (recentOn ? JSON.stringify(loadRecentSearches()) : "[]"),
    () => "[]",
  );
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  // Variante del primo accesso: sul server non è nota (sta nel telefono), quindi la card
  // compare solo dopo l'avvio sul telefono, senza mostrare per un attimo quella sbagliata.
  const homeVariant = useSyncExternalStore(
    () => () => {},
    () => (document.documentElement.dataset.home === "b" ? "b" : "a"),
    () => null,
  );
  // "Fatti suggerire" dai salvati (VISIONE.md): il tipo di posto che salvi di più, nella città dove
  // ne hai di più, cercato "poco conosciuto" (così i locali di massa vanno in fondo). Una ricerca
  // parte solo se la tocchi.
  const savedSuggestion = useMemo(() => {
    const liked = savedPlaces.filter((p) => !p.tags?.includes(OPINION_DISLIKE));
    if (liked.length < 3) return null;
    const top = (values: (string | null)[]) => {
      const counts = new globalThis.Map<string, number>();
      for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
      return [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
    };
    // Tipo e città insieme (prima erano scelti separatamente: "Sushi a Roma" anche con tutti i sushi a
    // Milano). Testo senza accordi sbagliati ("Pizzeria … poco conosciuti"): "fuori dai soliti giri"
    // fa scattare lo stesso la regola dei locali di massa (src/lib/mainstream.ts).
    const pair = top(liked.map((p) => {
      const k = categoryLabel(p.category);
      const c = cityFromAddress(p.address);
      return k && c ? `${k}\u0000${c}` : null;
    }));
    if (!pair || pair[1] < 2) return null;
    const [kind, city] = pair[0].split("\u0000");
    return { label: `${kind} a ${city}, fuori dai soliti giri`, query: `${kind} fuori dai soliti giri a ${city}` };
  }, [savedPlaces]);

  // Una sola barra (Lorenzo, 12/10: "abbiamo due barre per la ricerca, occupiamo solo spazio"):
  // i suggerimenti di testo stanno sotto la barra in alto e la card in basso sparisce.
  // ?beta=-suggerimenti riporta la card di prima.
  const chipsOn = useBeta("suggerimenti") && barOn && homeVariant === "a";
  const welcomeHidden = welcomeDismissed || chipsOn;
  // Pannello "Ti suggeriamo": si apre con "Idee" o toccando la barra vuota.
  const [ideasOpen, setIdeasOpen] = useState(false);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [searchOrigin, setSearchOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [geoState, setGeoState] = useState<"idle" | "loading" | "denied" | "unavailable">("idle");
  // Centro del raggio dei Filtri (piano 2.1): il cerchio sulla mappa parte da qui.
  const [radiusCenter, setRadiusCenter] = useState<{ lat: number; lng: number } | null>(null);
  // Frase scelta da "Vicino a me, aperto adesso": la riusa "Cerca in quest'area".
  const filterQueryRef = useRef<string | undefined>(undefined);
  const [aiError, setAiError] = useState<string | null>(null);
  const [venueDetails, setVenueDetails] = useState<Record<string, VenueDetails>>({});
  // Locali del cluster su cui si è tappato: se valorizzato, la lista mostra
  // solo questi invece di displayedPlaces.
  const [clusterPlaces, setClusterPlaces] = useState<Place[] | null>(null);
  // Feedback della ricerca filtrata sul ramo "world" (fetch a /api/search).
  const [filterLoading, setFilterLoading] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);
  // googlePlaceId -> uuid Supabase. Il client conosce i locali per id Google;
  // Supabase li conosce per UUID. Questa mappa e' il ponte.
  const [placeUuids, setPlaceUuids] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  // Lista attiva: risultati AI, oppure i salvati (eventualmente per tag).
  // È un dato, non una visibilità — ma è anche la risposta a "c'è qualcosa
  // da mostrare in lista?", quindi va calcolata PRIMA del dispatch.
  const displayedPlaces =
    aiSearch !== null
      ? aiSearch.risultati
      : view === "all"
        ? []
        : filterSaved(savedPlaces, activeTag, activeCity, savedQuery);

  // --- Overlay: autorità unica sulla visibilità dei pannelli ---
  // Un solo pannello visibile alla volta. Il dispatch è avvolto in una
  // funzione che inietta il contesto (c'è una lista da mostrare?) di cui il
  // reducer ha bisogno per decidere dove tornare su CLOSE.
  const [overlay, dispatchRaw] = useReducer(
    (state: Overlay, wrapped: { action: OverlayAction; ctx: { hasResults: boolean } }): Overlay =>
      overlayReducer(state, wrapped.action, wrapped.ctx),
    { kind: "none" } as Overlay,
  );
  const ideasShown = ideasOpen && chipsOn && view === "all" && aiSearch === null && !aiSearching && overlay.kind === "none" && aiQuery.trim() === "";
  const dispatch = (action: OverlayAction) =>
    dispatchRaw({ action, ctx: { hasResults: displayedPlaces.length > 0 } });

  // Carosello B aperto: il pin della card al centro (di default la prima) è evidenziato.
  const carouselOpen = overlay.kind === "list" && listVariant === "b";
  // Ordine delle card come le vede l'utente (dopo filtri rapidi e "Più vicini"), riportato dal carosello.
  const [carouselOrder, setCarouselOrder] = useState<string[]>([]);
  const focusId = !carouselOpen
    ? null
    : focusedId && carouselOrder.includes(focusedId)
      ? focusedId
      : carouselOrder[0] ?? null;

  // Il locale selezionato si deriva dall'overlay: cercato per id nella lista
  // attiva (con fallback su places/savedPlaces), mai duplicato in uno state.
  // Id del locale aperto, letto da loadVerdicts (che vive in una closure vecchia).
  // Card su cui l'utente si è fermato: se ha già scorso i risultati, l'ordine non cambia più sotto le dita.
  const focusedIdRef = useRef<string | null>(null);
  useEffect(() => { focusedIdRef.current = focusedId; }, [focusedId]);
  const aiFirstIdRef = useRef<string | null>(null);
  const refocusFirst = useRef(false);
  useEffect(() => {
    aiFirstIdRef.current = aiSearch?.risultati[0]?.id ?? null;
    if (refocusFirst.current) {
      refocusFirst.current = false;
      if (aiFirstIdRef.current) setFocusedId(aiFirstIdRef.current);
    }
  }, [aiSearch]);
  const openVenueIdRef = useRef<string | null>(null);
  useEffect(() => { openVenueIdRef.current = overlay.kind === "venue" ? overlay.placeId : null; }, [overlay]);

  // Tasto "indietro" del telefono (Android, app installata, swipe su iPhone): con la scheda di un
  // locale aperta la chiude e torna alla lista, invece di uscire dalla mappa e perdere la ricerca.
  // Stesso schema dell'articolo: una voce nella cronologia quando la scheda si apre, tolta quando
  // si chiude dall'interfaccia. Lo stato di Next resta (si copia history.state).
  const venueOpen = overlay.kind === "venue";
  const venueInHistory = useRef(false);
  const dispatchRef = useRef(dispatch);
  useEffect(() => { dispatchRef.current = dispatch; });
  useEffect(() => {
    if (venueOpen && !venueInHistory.current) {
      window.history.pushState({ ...(window.history.state ?? {}), scheda: true }, "");
      venueInHistory.current = true;
    } else if (!venueOpen && venueInHistory.current) {
      venueInHistory.current = false;
      if (window.history.state?.scheda) window.history.back();
    }
  }, [venueOpen]);
  useEffect(() => {
    // Pagina ricaricata con la scheda o l'articolo aperti: quelle voci non valgono più (i pannelli
    // ripartono chiusi); senza toglierle, il prossimo "indietro" uscirebbe dalla mappa.
    const st = window.history.state;
    if (st?.scheda || st?.articolo) {
      const rest = { ...st };
      delete rest.scheda;
      delete rest.articolo;
      window.history.replaceState(rest, "");
    }
    const onPop = () => {
      if (venueInHistory.current && !window.history.state?.scheda) {
        venueInHistory.current = false;
        dispatchRef.current({ type: "CLOSE" });
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Vista della mappa prima di aprire un locale dal carosello (lo zoom passa a 17): chiusa la
  // scheda si torna lì, invece di restare su un solo pin senza più vedere gli altri risultati.
  const viewBeforeVenue = useRef<{ latitude: number; longitude: number; zoom: number } | null>(null);
  const selected = useMemo<Place | null>(() => {
    if (overlay.kind !== "venue") return null;
    const id = overlay.placeId;
    const base =
      places.find((p) => p.id === id) ??
      displayedPlaces.find((p) => p.id === id) ??
      savedPlaces.find((p) => p.id === id) ??
      null;
    if (!base) return null;
    // I salvati sono indicizzati per UUID Supabase, i risultati di ricerca per
    // Place ID Google: cerco con entrambi, così note e tag compaiono sempre.
    const uuid = placeUuids[id];
    const savedVersion = savedPlaces.find((p) => p.id === id || (uuid != null && p.id === uuid));
    return savedVersion ? { ...base, tags: savedVersion.tags, note: savedVersion.note } : base;
  }, [overlay, places, displayedPlaces, savedPlaces, placeUuids]);
  const hadSelected = useRef(false);
  useEffect(() => {
    if (selected) { hadSelected.current = true; return; }
    if (!hadSelected.current) return;
    hadSelected.current = false;
    const v = viewBeforeVenue.current;
    viewBeforeVenue.current = null;
    // Solo se si torna ai risultati (la ricerca è ancora lì): con ✕ sul pannello la vista resta.
    if (!v || !carouselOpen) return;
    const map = (mapRef.current as { getMap?: () => { flyTo: (opts: { center: [number, number]; zoom: number; duration?: number }) => void } } | null)?.getMap?.();
    map?.flyTo({ center: [v.longitude, v.latitude], zoom: v.zoom, duration: 600 });
  }, [selected, carouselOpen]);

  const savedFiltered = activeTag !== null || activeCity !== null || savedQuery.trim() !== "";
  const savedControlsOn = view === "saved" && userId != null && savedPlaces.length > 0;
  // Filtri accesi nei salvati (il testo cercato si vede già nella casella): il numero sul pulsante.
  const savedNearestOn = savedNearest && userPos != null;
  const savedActiveCount = (activeTag !== null ? 1 : 0) + (activeCity !== null ? 1 : 0) + (savedNearestOn ? 1 : 0)
    + (aiSearch?.filtri != null ? countActive(filters) : 0);

  // Città dei salvati, la più frequente per prima; null = indirizzo senza città.
  const availableCities = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of savedPlaces) {
      const c = cityFromAddress(p.address) ?? OTHER_CITY;
      counts[c] = (counts[c] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => (a[0] === OTHER_CITY ? 1 : b[0] === OTHER_CITY ? -1 : b[1] - a[1]))
      .map(([city, count]) => ({ city, count }));
  }, [savedPlaces]);

  const availableTags = useMemo(() => {
    const seen = new Set<string>();
    for (const p of savedPlaces) {
      if (p.tags) for (const t of p.tags) seen.add(t);
    }
    return Array.from(seen);
  }, [savedPlaces]);
  // Foglio "Filtri" dei salvati: cosa mostra e come si accendono i filtri.
  const sheetShown = filterSaved(savedPlaces, activeTag, activeCity, savedQuery);
  const countTag = (t: string) => savedPlaces.filter((p) => p.tags?.includes(t)).length;
  const sheetCollections = sortTags(availableTags).filter((t) => t !== VISIT_WANT && t !== VISIT_DONE);
  const pickTag = (t: string | null) => { setActiveTag(t); clearAiSearch(); setClusterPlaces(null); setFilterError(null); };
  const sheetChip = (on: boolean) => `shrink-0 ${on ? CHIP_ON : CHIP_CITY}`;
  const sheetSection = "mt-4 mb-1.5 text-xs font-display font-semibold uppercase tracking-wide text-text-muted";

  // Risolve l'identita' canonica Supabase di un locale, qualunque id abbia il client.
  const resolveUuid = (id: string): string | null => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (isUuid) return id;
    return placeUuids[id] ?? null;
  };

  // Un locale e' salvato se il suo UUID canonico e' in savedIds.
  const isPlaceSaved = (id: string): boolean => {
    const uuid = resolveUuid(id);
    return uuid != null && savedIds.has(uuid);
  };

  // Segnale "apri_scheda" (una volta per locale aperto): vedi src/lib/track.ts.
  const trackedVenue = useRef<string | null>(null);
  useEffect(() => {
    if (!selected || trackedVenue.current === selected.id) return;
    trackedVenue.current = selected.id;
    track("apri_scheda", { id: resolveUuid(selected.id) ?? selected.id, lat: selected.lat, lng: selected.lng }, { fonte: view === "saved" ? "salvati" : aiSearch ? "ricerca" : "mappa" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo quando cambia il locale aperto
  }, [selected?.id]);

  // Salvataggio in un tocco (voce 11f): il segnalibro salva subito come "📌 Voglio andarci"
  // e mostra in basso "Salvato · Aggiungi nota". Se qualcosa va storto si apre la finestra di sempre.
  const [savedToast, setSavedToast] = useState<Place | null>(null);
  // "📌 A 300 m c'è X, che volevi provare" (come Mapstr, ma senza notifiche): quando l'utente tocca
  // "La mia posizione" e un suo "Voglio andarci" è a due passi. Ritrova il locale nel momento giusto.
  const [nearbySaved, setNearbySaved] = useState<{ place: Place; meters: number } | null>(null);
  const nearbyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Senza accesso: il locale si ricorda e si salva da solo dopo il login (src/lib/pending-save.ts).
  const askLoginToSave = (place: Place, tags: string[] = [VISIT_WANT]) => {
    rememberPendingSave(place, tags);
    window.location.href = loginToSaveUrl(place.name);
  };
  const quickSave = async (place: Place, tags: string[] = [VISIT_WANT]) => {
    if (!userId) { askLoginToSave(place, tags); return; }
    if (isPlaceSaved(place.id)) { dispatch({ type: "OPEN_VENUE", placeId: place.id }); return; }
    try {
      const addRes = await fetch("/api/places/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          googlePlaceId: place.id, name: place.name, address: place.address ?? "",
          lat: place.lat, lng: place.lng, category: place.category, rating: place.rating, priceLevel: place.priceLevel,
          userRatingCount: venueDetails[place.id]?.userRatingCount ?? null,
          firma: firmaPer(place.id),
        }),
      });
      if (!addRes.ok) throw new Error("add");
      const uuid: string = (await addRes.json()).place.id;
      const { error } = await (await browserClient()).from("saved_places").insert({ user_id: userId, place_id: uuid, tags, note: null });
      if (error && error.code !== "23505") throw new Error("insert");
      setPlaceUuids((prev) => ({ ...prev, [place.id]: uuid }));
      setSavedIds((prev) => new Set(prev).add(uuid));
      const saved = { ...place, id: uuid, tags, note: null };
      setSavedPlaces((prev) => [...prev.filter((p) => p.id !== uuid), saved]);
      setSavedToast(saved);
      track("salva", { id: uuid, lat: place.lat, lng: place.lng }, { fonte: "segnalibro", stato: tags.includes(VISIT_DONE) ? VISIT_DONE : VISIT_WANT });
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setSavedToast(null), 5000);
    } catch {
      setPendingSaveTags(tags);
      setPendingSavePlaceId(place.id);
    }
  };

  // Rientro dopo l'accesso: salva il locale toccato prima di entrare e lo mostra sulla mappa.
  // Aspetta i salvati: se il locale c'era già, si apre la sua scheda invece di rifarlo da zero.
  useEffect(() => {
    if (!userId || !savedLoaded || !savedIdsLoaded) return;
    const pending = takePendingSave();
    if (!pending) return;
    const { place, tags } = pending;
    setTimeout(() => {
      setViewState((v) => ({ ...v, latitude: place.lat, longitude: place.lng, zoom: Math.max(v.zoom, 15) }));
      void quickSave(place, tags);
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- una volta, quando utente e salvati sono pronti
  }, [userId, savedLoaded, savedIdsLoaded]);

  useEffect(() => {
    if (!userId) return;

    browserClient()
      .then((supabase) => supabase
        .from("saved_places")
        .select("place_id")
        .eq("user_id", userId))
      .then(({ data, error }) => {
        if (error) {
          logSavedError(error);
          return;
        }
        setSavedIds(new Set((data ?? []).map((row) => row.place_id as string)));
        setSavedIdsLoaded(true);
      });
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    setLoadingSaved(true);

    (async () => {
      const supabase = await browserClient();
      const { data, error } = await supabase
        .from("saved_places")
        .select("tags, note, places(id, name, category, address, lat, lng, google_place_id, rating, price_level)")
        .eq("user_id", userId);

      setLoadingSaved(false);
      setSavedLoaded(true);
      if (error) {
        logSavedError(error);
        return;
      }

      const uuidMap: Record<string, string> = {}; // Google Place ID -> UUID interno
      const fetched = (data ?? [])
        .map((row) => {
          // google_place_id serve solo a costruire il ponte id Google -> UUID, poi si scarta.
          const raw = row.places as unknown as (Place & { google_place_id?: string | null; price_level?: number | null }) | null;
          if (!raw || raw.lat == null || raw.lng == null) return null;
          const { google_place_id, price_level, ...place } = raw;
          if (google_place_id) uuidMap[google_place_id] = place.id;
          // voto e prezzo salvati al momento del salvataggio: le card dei salvati li mostrano
          return { ...place, rating: place.rating ?? null, priceLevel: price_level ?? null, tags: row.tags as string[] | null, note: row.note as string | null };
        })
        .filter((p): p is Place => p !== null);

      setSavedPlaces(fetched);
      setPlaceUuids((prev) => ({ ...prev, ...uuidMap }));
      // Arrivo dal profilo (/mappa?salvato=UUID): apre la scheda di quel salvato.
      const wanted = fetched.find((p) => p.id === openSavedRef.current);
      openSavedRef.current = null;
      if (wanted) {
        setTimeout(() => {
          setFocusedId(wanted.id);
          dispatch({ type: "OPEN_VENUE", placeId: wanted.id });
          const map = (mapRef.current as { getMap?: () => { jumpTo: (opts: { center: [number, number]; zoom: number }) => void } } | null)?.getMap?.();
          if (map) map.jumpTo({ center: [wanted.lng, wanted.lat], zoom: 15 });
        }, 0);
      }

      // Verdetto editoriale anche sui salvati: legge la cache place_synthesis
      // (RLS read-all pubblica) per i Google Place ID e popola venueDetails
      // keyed per UUID — lo stesso id con cui selected.id identifica un salvato.
      // SOLO blocco editoriale: i campi Google-live restano null e il gate del
      // verdetto li nasconde. Degrada in sicurezza: su errore, niente verdetto.
      const googleIds = Object.keys(uuidMap);
      if (googleIds.length === 0) return;

      const { data: synthRows, error: synthError } = await supabase
        .from("place_synthesis")
        .select("place_id, synthesis, tags, verdict, go_for, dont_expect")
        .in("place_id", googleIds);

      if (synthError) {
        console.error("[map-view] lettura place_synthesis (salvati) fallita:", synthError);
        return;
      }

      const savedDetails: Record<string, VenueDetails> = {};
      for (const row of synthRows ?? []) {
        const uuid = uuidMap[row.place_id as string];
        if (!uuid) continue;
        savedDetails[uuid] = {
          userRatingCount: null,
          openNow: null,
          websiteUri: null,
          phone: null,
          selectedReviews: null,
          synthesis: (row.synthesis as string | null) ?? null,
          tags: (row.tags as string[] | null) ?? null,
          verdict: (row.verdict as string | null) ?? null,
          goFor: (row.go_for as string[] | null) ?? null,
          dontExpect: (row.dont_expect as string[] | null) ?? null,
          // matchReason è query-dependent: non esiste in place_synthesis, sempre null sui salvati.
          matchReason: null,
        };
      }
      if (Object.keys(savedDetails).length > 0) {
        savedSynthRef.current = savedDetails;
        setVenueDetails((prev) => ({ ...prev, ...savedDetails }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispatch serve solo al link dal profilo, una volta
  }, [userId]);

  // Salvato senza verdetto (importato da Google Maps, salvato da un link…): lo si chiede aprendo la
  // sua scheda (VISIONE: il verdetto c'è SEMPRE). Arrivano anche foto, recensioni e orari di Google,
  // solo da mostrare. Una volta per locale; su errore o tetto del giorno la scheda resta com'era.
  const verdettoChiesto = useRef(new Set<string>());
  const [verdettoInCorso, setVerdettoInCorso] = useState<string | null>(null);
  const selectedSavedId = selected && /^[0-9a-f-]{36}$/i.test(selected.id) && !venueDetails[selected.id]?.verdict ? selected.id : null;
  useEffect(() => {
    if (!userId || !selectedSavedId || verdettoChiesto.current.has(selectedSavedId)) return;
    const googlePlaceId = Object.keys(placeUuids).find((g) => placeUuids[g] === selectedSavedId);
    if (!googlePlaceId) return;
    verdettoChiesto.current.add(selectedSavedId);
    void (async () => {
      setVerdettoInCorso(selectedSavedId);
      try {
        const res = await fetch("/api/places/verdetto", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ googlePlaceId }),
        });
        if (!res.ok) return;
        const d = (await res.json()) as Partial<VenueDetails>;
        if (!d.verdict) return;
        const det: VenueDetails = {
          userRatingCount: d.userRatingCount ?? null, openNow: d.openNow ?? null, websiteUri: d.websiteUri ?? null,
          phone: d.phone ?? null, selectedReviews: d.selectedReviews ?? null, synthesis: d.synthesis ?? null,
          tags: d.tags ?? null, verdict: d.verdict, goFor: d.goFor ?? null, dontExpect: d.dontExpect ?? null,
          matchReason: null, photoRef: d.photoRef ?? null, photoAuthor: d.photoAuthor ?? null,
        };
        savedSynthRef.current = { ...savedSynthRef.current, [selectedSavedId]: det };
        setVenueDetails((prev) => ({ ...prev, [selectedSavedId]: { ...det, ...Object.fromEntries(Object.entries(prev[selectedSavedId] ?? {}).filter(([, v]) => v != null)) } }));
      } catch {
        // Senza rete: la scheda resta com'era.
      } finally {
        setVerdettoInCorso((id) => (id === selectedSavedId ? null : id));
      }
    })();
  }, [userId, selectedSavedId, placeUuids]);

  const handleToggle = (placeId: string, saved: boolean) => {
    const uuid = resolveUuid(placeId);
    if (!uuid) return; // senza UUID non c'e' nulla da tracciare
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (saved) next.add(uuid); else next.delete(uuid);
      return next;
    });
    if (!saved) {
      track("rimuovi", { id: uuid });
      setSavedPlaces((prev) => prev.filter((p) => p.id !== uuid));
      if (view === "saved") dispatch({ type: "CLOSE" });
    }
  };

  // Stato del salvato come in Places ("Voglio andarci" / "Ci sono stato"): usa i tag già
  // esistenti "Da provare" / "Già visitato", uno esclude l'altro; ritoccarlo lo toglie.
  const visitBusy = useRef(false);
  // pair: i due tag che si escludono (stato della visita, oppure "Com'era?").
  const setVisitStatus = async (placeId: string, status: string, pair: readonly [string, string] = [VISIT_WANT, VISIT_DONE]) => {
    const uuid = resolveUuid(placeId);
    if (!userId || !uuid || visitBusy.current) return;
    visitBusy.current = true;
    try {
      const supabase = await browserClient();
      // Tag attuali: dalla lista dei salvati, o dal database se lì non c'è (mai scrivere alla cieca).
      let currentTags = savedPlaces.find((p) => p.id === uuid)?.tags ?? null;
      if (currentTags === null) {
        const { data, error } = await supabase
          .from("saved_places").select("tags").eq("user_id", userId).eq("place_id", uuid).maybeSingle();
        if (error || !data) { setFilterError("Non sono riuscito a salvare: riprova."); return; }
        currentTags = (data.tags as string[] | null) ?? [];
      }
      const base = currentTags.filter((t) => t !== pair[0] && t !== pair[1]);
      let tags = currentTags.includes(status) ? base : [...base, status];
      // "Com'era?" (👍/👎) vale solo con "Ci sono stato" e si cambia solo da lì: se la visita
      // non è più segnata, l'opinione resterebbe nascosta e un 👎 toglierebbe il locale da
      // "Stasera" per sempre. Quindi va via insieme alla visita.
      if (pair[0] === VISIT_WANT && !tags.includes(VISIT_DONE)) {
        tags = tags.filter((t) => t !== OPINION_LIKE && t !== OPINION_DISLIKE);
      }
      if (!currentTags.includes(status)) {
        if (status === VISIT_DONE) track("ci_sono_stato", { id: uuid });
        else if (status === VISIT_WANT) track("voglio_andarci", { id: uuid });
        else track("ci_sono_stato", { id: uuid }, { stato: status });
      }
      const previous = savedPlaces;
      setSavedPlaces((prev) => prev.map((p) => (p.id === uuid ? { ...p, tags } : p)));
      const { error } = await supabase.from("saved_places").update({ tags }).eq("user_id", userId).eq("place_id", uuid);
      if (error) { setSavedPlaces(previous); setFilterError("Non sono riuscito a salvare: riprova."); }
    } finally {
      visitBusy.current = false;
    }
  };

  const CATEGORY_QUERY: Record<string, string> = {
    restaurant: "ristoranti", cafe: "caffè bar", pizza: "pizzeria",
    sushi: "sushi", pub: "pub birreria", gelato: "gelateria",
    bakery: "panetteria", fastfood: "fast food", vegetarian: "ristorante vegetariano",
    seafood: "ristorante di pesce", steakhouse: "steakhouse", wine_bar: "wine bar",
  };

  // Azzerare una ricerca invalida anche le risposte ancora in viaggio (searchSeq): senza, dopo ✕,
  // un cambio di scheda o i filtri, i risultati vecchi ricomparivano qualche secondo dopo.
  const clearAiSearch = () => {
    searchSeq.current++;
    setLoadingVerdicts(false);
    setAiSearching(false);
    setAiSearch(null);
  };

  // `query` sostituisce la frase ricavata dai filtri ("Vicino a me, aperto adesso" la sceglie dall'ora).
  const runFilteredSearch = async (filtri: Filters, opts: { query?: string } = {}) => {
    const f = withDefaults(filtri);
    const ticket = ++searchSeq.current;
    setLoadingVerdicts(false);
    setAiSearching(false);
    setAiError(null);
    // Raggio "da me": serve la posizione del telefono (chiesta qui se manca). Se è negata si misura
    // dal centro della mappa e lo si dice, invece di non cercare.
    const withRadius = f.radiusKm != null && !f.zona.trim();
    let origin = { lat: viewState.latitude, lng: viewState.longitude };
    let geoMissing = false;
    if (withRadius && f.radiusFrom === "me") {
      const here = userPos ?? (await askPosition());
      if (searchSeq.current !== ticket) return;
      if (here) origin = here;
      else geoMissing = true;
    }
    setRadiusCenter(withRadius ? origin : null);
    filterQueryRef.current = opts.query;
    if (withRadius) trackFeature("raggio", { contesto: radiusLabel(f.radiusKm as number), origine: f.radiusFrom === "me" ? "me" : "mappa" });
    if (view === "saved") {
      // Salvati: si applicano i filtri che i dati salvati permettono (tipo, voto, prezzo, distanza).
      // Prima solo il tipo, e con un confronto di testo: "Gelaterie" non trovava ice_cream_shop.
      // Cucina: solo se tutte quelle scelte hanno un tipo Google (le regionali no: si ignorano).
      // Occasione: l'etichetta messa dall'utente ("Romantico", "Con amici"), se l'ha mai usata.
      // Caratteristiche e orari non sono nei salvati: si ignorano (mai un locale escluso per un dato che manca).
      const allowedTypes = f.categories.flatMap((c) => CATEGORY_TYPE_MAP[c] ?? []);
      const cuisineDefs = f.cuisines.map((c) => CUISINES.find((x) => x.id === c));
      const cuisineTypes = cuisineDefs.every((c) => c?.types) ? cuisineDefs.flatMap((c) => c?.types ?? []) : [];
      const occasionTag = OCCASIONS.find((o) => o.id === f.occasion)?.tag ?? null;
      const tagInUse = occasionTag != null && savedPlaces.some((p) => (p.tags ?? []).includes(occasionTag));
      const center = origin;
      const filtered = savedPlaces.filter((p) => {
        if (f.categories.length > 0) {
          const cat = (p.category ?? "").toLowerCase();
          if (!allowedTypes.includes(cat) && !f.categories.some((c) => cat.includes(c))) return false;
        }
        if (cuisineTypes.length > 0 && !cuisineTypes.includes((p.category ?? "").toLowerCase())) return false;
        if (tagInUse && !(p.tags ?? []).includes(occasionTag)) return false;
        if (f.minRating != null && p.rating != null && p.rating < f.minRating) return false;
        if (f.maxPriceLevel != null && p.priceLevel != null && p.priceLevel > f.maxPriceLevel) return false;
        if (f.minPriceLevel != null && p.priceLevel != null && p.priceLevel < f.minPriceLevel) return false;
        // "Dove?" nei salvati: la zona scritta deve comparire nell'indirizzo (nessuna chiamata).
        const zona = f.zona.trim().toLowerCase();
        if (zona && !(p.address ?? "").toLowerCase().includes(zona) && !p.name.toLowerCase().includes(zona)) return false;
        if (!zona && f.radiusKm != null && distanceMeters(center, p) > f.radiusKm * 1000) return false;
        return true;
      });
      setAiSearch({ risultati: filtered, filtri: null });
      setMovedSinceSearch(false);
      dispatch({ type: "OPEN_LIST" });
      return;
    }

    let query: string;
    if (opts.query) {
      query = opts.query;
    } else if (f.categories.length > 0) {
      query = f.categories.map((c) => CATEGORY_QUERY[c] ?? c).join(" ");
    } else if (f.cuisines.length > 0 || f.occasion) {
      // Una cucina o un'occasione parlano di un posto dove mangiare.
      query = "ristorante";
    } else {
      query = "ristoranti bar locali";
    }
    // Cucina, occasione e caratteristiche nel testo: Google trova i posti giusti già alla fonte
    // ("ristorante cucina romana romantico terrazza"). Una sola chiamata, come prima.
    const extra = opts.query ? "" : filterQueryWords(f.cuisines, f.occasion, f.features);
    if (extra) query = `${query} ${extra}`;
    const openAt = f.openAt ? openAtSlot(f.openAt) : null;

    // Il messaggio sulla posizione negata resta in vista sopra i risultati.
    if (!geoMissing) setFilterError(null);
    setFilterLoading(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          source: "world",
          searchIntent: "structured",
          // Lista subito, verdetti dopo (come la ricerca AI): prima si aspettavano ~6 s di Haiku.
          phase: "fast",
          lat: origin.lat,
          lng: origin.lng,
          ...(f.minRating != null && { minRating: f.minRating }),
          ...(f.minReviews != null && { minReviews: f.minReviews }),
          ...(f.minPriceLevel != null && { minPriceLevel: f.minPriceLevel }),
          ...(f.maxPriceLevel != null && { maxPriceLevel: f.maxPriceLevel }),
          ...(f.openNowOnly && { openNowOnly: true }),
          ...(f.zona.trim() ? { zona: f.zona.trim() } : f.radiusKm != null ? { radius: f.radiusKm * 1000 } : {}),
          ...(f.categories.length > 0 && { categories: f.categories }),
          ...(f.cuisines.length > 0 && { cuisines: f.cuisines }),
          ...(f.occasion && { occasion: f.occasion }),
          ...(f.features.length > 0 && { features: f.features }),
          ...(openAt && { openAt, openAtId: f.openAt }),
        }),
      });
      const data = await res.json();
      rememberFirme(data?.risultati);
      if (searchSeq.current !== ticket) return;
      if (!res.ok) { setFilterError(data.error ?? "Ricerca non riuscita. Riprova."); return; }
      type RawPlace = {
        id: string; name: string; category: string | null; lat: number | null; lng: number | null;
        rating: number | null; priceLevel: number | null; address: string | null;
        userRatingCount: number | null; openNow: boolean | null; websiteUri: string | null; phone: string | null;
        selectedReviews: { text: string }[] | null; synthesis: string | null; tags: string[] | null; verdict: string | null;
        goFor: string[] | null; dontExpect: string[] | null; matchReason: string | null; photoRef?: string | null; photoAuthor?: string | null; editorialSummary?: string | null;
      };
      const raw: RawPlace[] = (data.risultati ?? []).filter((p: RawPlace) => p.lat != null && p.lng != null);
      const places: Place[] = raw.map((p) => ({ id: p.id, name: p.name, category: p.category, address: p.address ?? null, lat: p.lat as number, lng: p.lng as number, tags: null, note: null, rating: p.rating ?? null, priceLevel: p.priceLevel ?? null }));
      const details: Record<string, VenueDetails> = {};
      for (const p of raw) {
        details[p.id] = {
          userRatingCount: p.userRatingCount ?? null,
          openNow: p.openNow ?? null,
          websiteUri: p.websiteUri ?? null,
          phone: p.phone ?? null,
          selectedReviews: p.selectedReviews ?? null,
          synthesis: p.synthesis ?? null,
          tags: p.tags ?? null,
          verdict: p.verdict ?? null,
          goFor: p.goFor ?? null,
          dontExpect: p.dontExpect ?? null,
          matchReason: p.matchReason ?? null,
          photoRef: p.photoRef ?? null,
          photoAuthor: p.photoAuthor ?? null,
          editorialSummary: p.editorialSummary ?? null,
        };
      }
      setAiSearch({ risultati: places, filtri: data.filtri_usati ?? null, id: ticket });
      setVenueDetails({ ...savedSynthRef.current, ...details });
      // Come per la ricerca AI: la mappa si sposta sui risultati. Con il raggio si vede tutto il cerchio.
      if (withRadius && places.length > 0) {
        const dLat = ((f.radiusKm as number) * 1000) / 111_320;
        const dLng = dLat / Math.max(Math.cos((origin.lat * Math.PI) / 180), 0.01);
        fitToPlaces([{ lat: origin.lat - dLat, lng: origin.lng - dLng }, { lat: origin.lat + dLat, lng: origin.lng + dLng }]);
      } else {
        fitToPlaces(places);
      }
      void loadVerdicts(ticket, query, data.sintesi_pendente ?? null);
      // nuova ricerca: i filtri rapidi della precedente non devono restringere questa
      setQuickFilters(new Set());
      setMovedSinceSearch(false);
      dispatch({ type: "OPEN_LIST" });
    } catch {
      setFilterError("Ricerca non riuscita. Riprova.");
    } finally {
      setFilterLoading(false);
    }
  };

  // Cerchio del raggio: solo mentre si guardano i risultati dei Filtri (una ricerca a parole lo toglie).
  const radiusF = withDefaults(filters);
  const radiusCircle = aiSearch !== null && aiSearch.query == null && radiusCenter && radiusF.radiusKm != null && !radiusF.zona.trim()
    ? { center: radiusCenter, km: radiusF.radiusKm }
    : null;

  // Pin visibili: con una ricerca AI seguono i filtri rapidi della lista.
  const quickOn = useBeta("filtri-lista");
  const mapPlaces =
    aiSearch !== null && quickOn ? applyQuickFilters(displayedPlaces, quickFilters, venueDetails) : displayedPlaces;

  // Variante pin con foto (?pin=b, stile Places): solo per i locali che hanno già la foto nella
  // card (le prime 6 della lista B), con lo stesso indirizzo immagine → nessuna foto in più da pagare.
  const pinVariant = useVariant("pin");
  const pinPhotoIds = new Set(
    pinVariant === "b" && aiSearch !== null && listVariant === "b" && clusterPlaces === null
      ? carouselOrder.slice(0, PHOTO_CARDS)
      : [],
  );

  // Dopo una ricerca i primi risultati (e il pin della card al centro) non finiscono mai
  // dentro un cerchio "2"/"3": prima i più adatti restavano nascosti mentre quelli spostati
  // in fondo (es. i locali di massa nelle ricerche "non turistiche") avevano il nome in vista.
  const topIds = aiSearch !== null && clusterPlaces === null
    ? [...(carouselOrder.length > 0 ? carouselOrder : mapPlaces.map((p) => p.id)).slice(0, TOP_PINS), ...(focusId ? [focusId] : [])]
    : [];
  const topKey = topIds.join(",");
  const topPlaces = useMemo(() => {
    const ids = new Set(topKey ? topKey.split(",") : []);
    return mapPlaces.filter((p) => ids.has(p.id));
  }, [mapPlaces, topKey]);

  // Nomi dei primi risultati senza sovrapposizioni: vince quello più in alto in lista.
  const hiddenLabels = useMemo(() => {
    if (topPlaces.length < 2) return new Set<string>();
    const rank = (id: string) => (id === focusId ? -1 : carouselOrder.indexOf(id) === -1 ? 999 : carouselOrder.indexOf(id));
    const ordered = [...topPlaces].sort((a, b) => rank(a.id) - rank(b.id));
    return labelsToHide(ordered.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, name: p.name, big: p.id === focusId })), viewState.zoom);
  }, [topPlaces, carouselOrder, focusId, viewState.zoom]);

  const clusterIndex = useMemo(() => {
    const top = new Set(topPlaces.map((p) => p.id));
    const points = mapPlaces.filter((p) => !top.has(p.id)).map((place) => ({
      type: "Feature" as const,
      properties: { cluster: false, placeData: place },
      geometry: { type: "Point" as const, coordinates: [place.lng, place.lat] },
    }));
    const index = new Supercluster({ radius: 50, maxZoom: 20 });
    index.load(points);
    return index;
  }, [mapPlaces, topPlaces]);

  const roundedZoom = Math.ceil(viewState.zoom);
  const clusters = useMemo(() => {
    const map = (mapRef.current as { getMap?: () => { getBounds: () => { getWest: () => number; getSouth: () => number; getEast: () => number; getNorth: () => number } } } | null)?.getMap?.();
    if (!map) {
      return mapPlaces.map((place) => ({
        type: "Feature" as const,
        properties: { cluster: false, placeData: place },
        geometry: { type: "Point" as const, coordinates: [place.lng, place.lat] },
      }));
    }
    const b = map.getBounds();
    const bbox: [number, number, number, number] = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
    return [
      ...clusterIndex.getClusters(bbox, roundedZoom),
      ...topPlaces.map((place) => ({
        type: "Feature" as const,
        properties: { cluster: false, placeData: place },
        geometry: { type: "Point" as const, coordinates: [place.lng, place.lat] },
      })),
    ];
  }, [clusterIndex, roundedZoom, viewState.longitude, viewState.latitude, mapPlaces, topPlaces]);

  // Porta il pin nella parte di mappa visibile sopra il carosello, solo se è fuori.
  const panIntoView = (place: Place) => {
    const map = (mapRef.current as { getMap?: () => { project: (ll: [number, number]) => { x: number; y: number }; easeTo: (o: object) => void } } | null)?.getMap?.();
    if (!map || typeof window === "undefined") return;
    const pt = map.project([place.lng, place.lat]);
    // Da computer la lista è a fianco, non sopra la mappa: basta che il pin sia nella mappa.
    if (isDesktop()) {
      const box = (map as unknown as { getContainer: () => HTMLElement }).getContainer();
      if (pt.x > 40 && pt.x < box.clientWidth - 40 && pt.y > 60 && pt.y < box.clientHeight - 40) return;
      map.easeTo({ center: [place.lng, place.lat], duration: 500 });
      return;
    }
    const { innerWidth: w, innerHeight: h } = window;
    if (pt.x > 30 && pt.x < w - 30 && pt.y > 140 && pt.y < h * 0.5) return;
    map.easeTo({ center: [place.lng, place.lat], offset: [0, -Math.round(h * 0.18)], duration: 500 });
  };

  // Sposta la mappa in modo che tutti i risultati siano visibili sopra la lista
  // e sotto barra di ricerca + "Esplora / I miei salvati" (pin alti ~50 px sopra il punto).
  // Mappa non ancora caricata (link condiviso aperto a freddo: i risultati arrivano prima
  // della mappa): l'inquadratura si fa appena la mappa è pronta (onLoad).
  const pendingFitRef = useRef<{ list: { lat: number; lng: number }[]; top: number } | null>(null);
  // Non map.loaded(): torna false anche mentre si scaricano i riquadri dopo ogni spostamento.
  const mapReadyRef = useRef(false);
  const fitToPlaces = (list: { lat: number; lng: number }[], top = 190) => {
    if (list.length === 0) return;
    const map = (mapRef.current as { getMap?: () => { fitBounds: (b: [[number, number], [number, number]], o: object) => void } } | null)?.getMap?.();
    if (!map || !mapReadyRef.current) { pendingFitRef.current = { list, top }; return; }
    pendingFitRef.current = null;
    const lngs = list.map((p) => p.lng);
    const lats = list.map((p) => p.lat);
    const h = typeof window !== "undefined" ? window.innerHeight : 800;
    try {
      map.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        // Da computer niente carosello né barra sopra la mappa: margini uguali su tutti i lati.
        { padding: isDesktop() ? { top: 90, bottom: 60, left: 60, right: 60 } : { top, bottom: Math.round(h * 0.5), left: 40, right: 40 }, maxZoom: 15, duration: 900 },
      );
    } catch {
      // mappa non pronta: si lascia la vista com'è
    }
  };

  // Ricerca AI in linguaggio naturale (primo tempo: lista Google; verdetti dopo).
  // center: per i link condivisi (?q=…&at=lat,lng), che cercano nel punto di chi ha condiviso.
  // Mentre si scrive nella barra: dopo una pausa di 700 ms l'AI capisce già la frase (nessuna
  // chiamata Google). All'Invio la ricerca parte subito su Google.
  useEffect(() => {
    if (view !== "all" || aiQuery.trim().length < 8) return;
    const t = setTimeout(() => prefetchIntent(aiQuery), 700);
    return () => clearTimeout(t);
  }, [aiQuery, view]);

  const runAISearch = async (q: string, center?: { lat: number; lng: number }) => {
    const at = center ?? { lat: viewState.latitude, lng: viewState.longitude };
    // Il numero della ricerca si prende SUBITO: una risposta arrivata dopo ✕, un'altra ricerca
    // o i filtri ha un numero vecchio e si scarta.
    const ticket = ++searchSeq.current;
    setLoadingVerdicts(false);
    setAiSearching(true);
      setAiError(null);
      try {
        // Frase già capita mentre si scriveva: la ricerca non riaspetta l'AI (~1-2 s in meno).
        const intent = view === "all" ? await intentFor(q) : null;
        if (searchSeq.current !== ticket) return;
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: q,
            source: view === "all" ? "world" : "saved",
            searchIntent: "natural",
            phase: "fast",
            ...(intent && { intent, intentQuery: q.trim() }),
            lat: at.lat,
            lng: at.lng,
          }),
        });
        const data = await res.json();
        rememberFirme(data?.risultati);
        if (searchSeq.current !== ticket) return;
        if (!res.ok) {
          setAiError(data.error ?? "Qualcosa è andato storto. Riprova.");
          return;
        }
        type RawPlace = {
          id: string; name: string; category: string | null; lat: number | null; lng: number | null;
          rating: number | null; priceLevel: number | null; address: string | null;
          userRatingCount: number | null; openNow: boolean | null; websiteUri: string | null; phone: string | null;
          selectedReviews: { text: string }[] | null; synthesis: string | null; tags: string[] | null; verdict: string | null;
          goFor: string[] | null; dontExpect: string[] | null; matchReason: string | null; photoRef?: string | null; photoAuthor?: string | null; editorialSummary?: string | null;
        };
        const raw: RawPlace[] = (data.risultati ?? []).filter((p: RawPlace) => p.lat != null && p.lng != null);
        const places: Place[] = raw.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          address: p.address ?? null,
          lat: p.lat as number,
          lng: p.lng as number,
          tags: null,
          note: null,
          rating: p.rating ?? null,
          priceLevel: p.priceLevel ?? null,
        }));
        const details: Record<string, VenueDetails> = {};
        for (const p of raw) {
          details[p.id] = {
            userRatingCount: p.userRatingCount ?? null,
            openNow: p.openNow ?? null,
            websiteUri: p.websiteUri ?? null,
            phone: p.phone ?? null,
            selectedReviews: p.selectedReviews ?? null,
            synthesis: p.synthesis ?? null,
            tags: p.tags ?? null,
            verdict: p.verdict ?? null,
            goFor: p.goFor ?? null,
            dontExpect: p.dontExpect ?? null,
            matchReason: p.matchReason ?? null,
            photoRef: p.photoRef ?? null,
            photoAuthor: p.photoAuthor ?? null,
            editorialSummary: p.editorialSummary ?? null,
          };
        }
        const id = ticket;
        setClusterPlaces(null); setFilterError(null);
        setAiSearch({ risultati: places, filtri: data.filtri_usati, id, query: q, daParte: data.da_parte ?? null });
        setVenueDetails({ ...savedSynthRef.current, ...details }); setFilters(EMPTY_FILTERS);
        dispatch({ type: "OPEN_LIST" });
        setQuickFilters(new Set());
      setMovedSinceSearch(false);
      if (view === "all") saveRecentSearch(q);
      // Distanze solo se hanno senso: senza la posizione del telefono si misura dal centro della mappa,
      // e cercando "a Milano" con la mappa su Roma ogni card diceva "479 km".
      const nearAt = places.filter((p) => distanceMeters(at, p) < 20_000).length;
      setSearchOrigin(userPos || nearAt >= places.length / 2 ? at : null);
      fitToPlaces(places);
      void loadVerdicts(id, q, data.sintesi_pendente ?? null);
      } catch {
        setAiError("Errore di rete. Controlla la connessione e riprova.");
      } finally {
        if (searchSeq.current === ticket) setAiSearching(false);
      }

  };

  // Posizione per "Vicino a me" e il raggio "da me": chiesta solo a un tocco dell'utente, con una
  // spiegazione umana se il telefono la nega (null = si continua senza).
  const askPosition = (): Promise<{ lat: number; lng: number } | null> => new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoState("unavailable");
      setFilterError("Questo telefono non mi dice dove sei: sposta la mappa sulla zona che ti interessa, oppure scrivila nei Filtri.");
      resolve(null);
      return;
    }
    setGeoState("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserPos(here);
        setGeoState("idle");
        resolve(here);
      },
      (err) => {
        const denied = err.code === err.PERMISSION_DENIED;
        setGeoState(denied ? "denied" : "unavailable");
        setFilterError(denied
          ? "Per cercare vicino a te mi serve la posizione: attivala nelle impostazioni del browser. Intanto cerco intorno al centro della mappa."
          : "Non riesco a trovare la tua posizione: cerco intorno al centro della mappa.");
        resolve(null);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  });

  // "📍 Vicino a me, aperto adesso" (piano 2.1): i Filtri con aperto ora + 1 km da me e la frase
  // adatta all'ora. Una sola ricerca Google, come un'applicazione dei Filtri.
  const searchNearNow = () => {
    const near = nearNowQuery(new Date());
    const f: Filters = { ...EMPTY_FILTERS, openNowOnly: true, radiusKm: 1, radiusFrom: "me" };
    trackFeature("vicino_adesso");
    setIdeasOpen(false);
    setClusterPlaces(null);
    setFilterError(null);
    setFilters(f);
    void runFilteredSearch(f, { query: near.query });
  };

  // Posizione: chiesta solo quando l'utente tocca il pulsante (mai al caricamento).
  const goToMyPosition = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) { setGeoState("unavailable"); return; }
    setGeoState("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setViewState((v) => ({ ...v, latitude: pos.coords.latitude, longitude: pos.coords.longitude, zoom: 14 }));
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const near = savedPlaces
          .filter((p) => p.tags?.includes(VISIT_WANT))
          .map((p) => ({ place: p, meters: distanceMeters(here, p) }))
          .filter((x) => x.meters <= NEARBY_SAVED_METERS)
          .sort((a, b) => a.meters - b.meters)[0];
        if (near) {
          setNearbySaved(near);
          if (nearbyTimer.current) clearTimeout(nearbyTimer.current);
          nearbyTimer.current = setTimeout(() => setNearbySaved(null), 9000);
        }
        setGeoState("idle");
        setWelcomeDismissed(true);
      },
      (err) => {
        const denied = err.code === err.PERMISSION_DENIED;
        setGeoState(denied ? "denied" : "unavailable");
        // A card iniziale chiusa il messaggio non si vedrebbe: avviso in sovrimpressione.
        if (welcomeHidden) setFilterError(denied ? "Non ho il permesso di vedere dove sei: attivalo nelle impostazioni del browser, oppure scrivi la zona (es. “a Trastevere”)." : "Non riesco a trovare la tua posizione: scrivi la zona (es. “a Trastevere”).");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  // Secondo tempo della ricerca AI: verdetti e motivi arrivano dopo la lista.
  // Se nel frattempo l'utente ha cambiato o azzerato la ricerca (id diverso) si scarta.
  const loadVerdicts = async (id: number, searchedQuery: string, pending: PendingSynthesis | null) => {
    if (!pending) { if (searchSeq.current === id) setLoadingVerdicts(false); return; }
    setLoadingVerdicts(true);
    try {
      type VerdictReply = { dettagli?: Record<string, Partial<VenueDetails>>; esclusi?: string[]; livelli?: Record<string, string> };
      // A gruppi in parallelo (le prime 2 card arrivano per prime, ~3-4 s): ogni verdetto si mostra
      // appena pronto; esclusioni e ordine si applicano una volta sola, a gruppi arrivati.
      const groups = pending.gruppi?.length ? pending.gruppi : [{ places: pending.places, token: pending.token }];
      const replies = await Promise.all(groups.map(async (g): Promise<VerdictReply | null> => {
        try {
          const res = await fetch("/api/search/synthesis", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: searchedQuery, places: g.places, token: g.token }),
          });
          if (!res.ok || searchSeq.current !== id) return null;
          const part: VerdictReply = await res.json();
          if (searchSeq.current !== id) return null;
          setVenueDetails((prev) => {
            const next = { ...prev };
            for (const [pid, d] of Object.entries(part.dettagli ?? {})) {
              next[pid] = { ...(prev[pid] as VenueDetails), ...d } as VenueDetails;
            }
            return next;
          });
          return part;
        } catch {
          return null; // un gruppo perso non ferma gli altri: quelle card restano con i dati Google
        }
      }));
      if (searchSeq.current !== id) return;
      const esclusi = new Set(replies.flatMap((r) => r?.esclusi ?? []));
      const livelli: Record<string, string> = Object.assign({}, ...replies.map((r) => r?.livelli ?? {}));
      if (esclusi.size > 0 || Object.keys(livelli).length > 0) {
        // Il fuoco sulla prima card (messo dal carosello, non dall'utente) non deve seguirla quando
        // si riordina: il carosello scorreva fino in fondo, sul locale meno adatto, e la mappa con lui.
        // Passa al nuovo primo appena la lista riordinata è sullo schermo (effetto su aiSearch).
        if (Object.keys(livelli).length > 0 && openVenueIdRef.current == null && focusedIdRef.current != null && focusedIdRef.current === aiFirstIdRef.current) refocusFirst.current = true;
        setAiSearch((prev) => {
          if (!prev || prev.id !== id) return prev;
          // Il locale aperto in questo momento resta (nel dubbio il locale resta): toglierlo
          // chiudeva la scheda sotto le dita e lasciava solo la mappa.
          let risultati = prev.risultati.filter((p) => !esclusi.has(p.id) || p.id === openVenueIdRef.current);
          // Se l'AI scartasse tutti i locali (sommando i gruppi) non si esclude niente: nel dubbio il locale resta.
          if (risultati.length === 0) risultati = prev.risultati;
          // Ordine per quanto il locale è adatto alla richiesta (giudizio di Haiku sulle recensioni):
          // "alto" in cima, "basso" in fondo, a parità resta l'ordine di Google. Solo se l'utente non ha
          // ancora aperto o scorso le card. I locali già messi da parte (molto famosi, fuori tema)
          // restano in fondo: il giudizio non li riporta su.
          const aside = new Set([...(prev.daParte?.turistici ?? []), ...(prev.daParte?.fuori_tema ?? []), ...(prev.daParte?.fuori_zona ?? [])]);
          const touched = openVenueIdRef.current != null || (focusedIdRef.current != null && focusedIdRef.current !== prev.risultati[0]?.id);
          if (!touched) {
            const rank = (p: Place) => aside.has(p.name) ? 3 : livelli[p.id] === "alto" ? 0 : livelli[p.id] === "basso" ? 2 : 1;
            risultati = risultati.map((p, i) => ({ p, i })).sort((a, b) => rank(a.p) - rank(b.p) || a.i - b.i).map((x) => x.p);
          }
          return { ...prev, risultati };
        });
      }
    } catch {
      // Degrada: la lista Google resta, senza verdetti.
    } finally {
      if (searchSeq.current === id) setLoadingVerdicts(false);
    }
  };

  // Esc (da computer) chiude la finestra più in alto: Salva, scheda, filtri, articolo, pannello.
  const closeTopmost = useRef<() => void>(() => {});
  useEffect(() => {
    closeTopmost.current = () => {
      if (pendingSavePlaceId) { setPendingSavePlaceId(null); setPendingSaveTags([]); return; }
      if (pendingEditPlace) { setPendingEditPlace(null); return; }
      if (overlay.kind === "venue" || overlay.kind === "filters" || overlay.kind === "ai") { dispatch({ type: "CLOSE" }); return; }
      if (articleOpen) {
        // L'articolo ha una voce nella cronologia: si chiude tornando indietro.
        if (window.history.state?.articolo) window.history.back();
        else setArticleOpen(false);
      }
    };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Nei campi di testo Esc lascia fare al campo (es. annullare il tag nuovo).
      if ((e.target as HTMLElement | null)?.closest("input, textarea")) return;
      closeTopmost.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Tocco su "Salvati" / "Mappa" nella barra in basso mentre si è già sulla mappa: la pagina
  // non si ricarica, cambia solo ?vista=… e la mappa segue.
  const vistaParam = useSearchParams().get("vista");
  const lastVista = useRef(vistaParam);
  useEffect(() => {
    if (lastVista.current === vistaParam) return;
    lastVista.current = vistaParam;
    // Fuori dal ciclo dell'effetto, come gli altri arrivi dall'indirizzo.
    if (vistaParam === "salvati" && view !== "saved") {
      setTimeout(() => {
        clearAiSearch(); setAiQuery(""); setClusterPlaces(null); setFilterError(null);
        setView("saved"); dispatch({ type: "OPEN_LIST" });
      }, 0);
    } else if (vistaParam !== "salvati" && view === "saved") {
      setTimeout(() => { setView("all"); setActiveTag(null); setActiveCity(null); setSavedQuery(""); dispatch({ type: "RESET" }); }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- segue solo l'indirizzo
  }, [vistaParam]);

  // L'indirizzo dice se si stanno guardando i salvati (?vista=salvati): la barra in basso accende "Salvati".
  // Solo quando la vista cambia davvero, non al primo disegno: lì è l'indirizzo a decidere la vista
  // (vedi sotto). Si confronta con la vista precedente e non con un "già fatto": in sviluppo React
  // esegue due volte gli effetti al montaggio e la seconda volta toglieva ?vista=salvati appena
  // arrivati dalla barra in basso, e la mappa rimbalzava tra Esplora e Salvati.
  const syncedView = useRef(view);
  useEffect(() => {
    if (syncedView.current === view) return;
    syncedView.current = view;
    const params = new URLSearchParams(window.location.search);
    if ((params.get("vista") === "salvati") === (view === "saved")) return;
    if (view === "saved") params.set("vista", "salvati");
    else params.delete("vista");
    const rest = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}`);
  }, [view]);

  // Link a una ricerca (/mappa?q=…&at=lat,lng): la rifà una volta all'apertura, nello stesso punto.
  // Costa quanto una ricerca scritta a mano. Poi toglie q dall'indirizzo, così ricaricare non la ripete.
  const sharedSearchDone = useRef(false);
  // La mappa è stata spostata con il dito: la posizione arrivata dopo non la sposta più.
  const touchedMap = useRef(false);
  useEffect(() => {
    if (sharedSearchDone.current) return;
    sharedSearchDone.current = true;
    const params = new URLSearchParams(window.location.search);
    // La mappa riparte da dove era l'ultima volta (non sempre da Roma); un link con "at" o un locale vincono.
    const linked = Boolean(params.get("at") || params.get("sorpresa"));
    const last = linked ? null : readLastView();
    if (last) setTimeout(() => setViewState((v) => ({ ...v, latitude: last.lat, longitude: last.lng, zoom: last.zoom })), 0);
    // Posizione già permessa (mai chiesta qui): la mappa parte da dove sei se non c'è un'ultima vista
    // o se l'ultima vista è in un'altra città (oltre 30 km). Lorenzo a Milano, 17/10: mappa su Roma.
    const here = linked ? Promise.resolve(null) : grantedPosition();
    const startHere = (pos: { lat: number; lng: number } | null): pos is { lat: number; lng: number } =>
      pos !== null && (!last || distanceMeters(pos, last) > 30000);
    const plainOpen = ["salvato", "vista", "filtri", "q"].every((k) => !params.get(k));
    void here.then((pos) => {
      if (pos) setUserPos(pos);
      if (!plainOpen || !startHere(pos) || touchedMap.current || searchSeq.current > 0) return;
      setViewState((v) => ({ ...v, latitude: pos.lat, longitude: pos.lng, zoom: 13 }));
    });
    // Dal profilo: /mappa?salvato=UUID apre i salvati e poi la scheda (quando arrivano).
    const savedId = params.get("salvato");
    if (savedId && /^[0-9a-f-]{36}$/i.test(savedId)) {
      openSavedRef.current = savedId;
      params.delete("salvato");
      const rest = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}`);
      setTimeout(() => { setWelcomeDismissed(true); setView("saved"); dispatch({ type: "OPEN_LIST" }); }, 0);
      return;
    }
    // "Salvati" nella barra in basso e scorciatoia dell'app installata: /mappa?vista=salvati apre "I miei salvati".
    // Dal profilo anche già filtrati: &stato=voglio|fatto oppure &tag=<raccolta>.
    // vista=salvati resta nell'indirizzo (così "Salvati" resta acceso in basso); stato e tag si tolgono.
    if (params.get("vista") === "salvati") {
      const stato = params.get("stato");
      const tag = params.get("tag")?.trim().slice(0, 60) || null;
      const startTag = stato === "voglio" ? VISIT_WANT : stato === "fatto" ? VISIT_DONE : tag;
      params.delete("stato");
      params.delete("tag");
      const rest = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}`);
      setTimeout(() => { setWelcomeDismissed(true); setActiveTag(startTag); setView("saved"); dispatch({ type: "OPEN_LIST" }); }, 0);
      return;
    }
    // Dalla home "Oppure cerca con i filtri" (/mappa?filtri=1): apre subito il pannello dei filtri.
    if (params.get("filtri") === "1") {
      params.delete("filtri");
      const rest = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}`);
      setTimeout(() => { setWelcomeDismissed(true); dispatch({ type: "OPEN_FILTERS" }); }, 0);
      return;
    }
    // "Apri scheda" da Sorprendimi (/mappa?sorpresa=<Place ID>): il locale arriva dalla memoria della
    // sorpresa nel telefono (stessa ricerca, nessuna chiamata in più) e si apre la sua scheda.
    const surpriseId = params.get("sorpresa");
    if (surpriseId) {
      params.delete("sorpresa");
      const rest = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}`);
      const hit = surpriseFromMemory(surpriseId.slice(0, 300));
      if (!hit || hit.place.lat == null || hit.place.lng == null) return;
      const p = hit.place;
      rememberFirme([p]);
      const place: Place = {
        id: p.id, name: p.name, category: p.category, address: p.address ?? null, lat: p.lat as number, lng: p.lng as number,
        tags: null, note: null, rating: p.rating ?? null, priceLevel: p.priceLevel ?? null,
      };
      const details: VenueDetails = {
        userRatingCount: p.userRatingCount ?? null, openNow: p.openNow ?? null, websiteUri: p.websiteUri ?? null,
        phone: p.phone ?? null, selectedReviews: p.selectedReviews ?? null, synthesis: null, tags: null,
        verdict: hit.verdict, goFor: null, dontExpect: null, matchReason: null,
        photoRef: p.photoRef ?? null, photoAuthor: p.photoAuthor ?? null, editorialSummary: p.editorialSummary ?? null,
      };
      setTimeout(() => {
        setWelcomeDismissed(true);
        setViewState((v) => ({ ...v, latitude: place.lat, longitude: place.lng, zoom: 15 }));
        setAiSearch({ risultati: [place], filtri: null, id: ++searchSeq.current, query: "Sorprendimi" });
        setVenueDetails((prev) => ({ ...prev, [place.id]: details }));
        setFocusedId(place.id);
        dispatch({ type: "OPEN_VENUE", placeId: place.id });
      }, 0);
      return;
    }
    const q = params.get("q")?.trim().slice(0, 200);
    // meno di 3 caratteri: link troncato o sbagliato, niente ricerca a pagamento
    if (!q || q.length < 3) return;
    const atParts = (params.get("at") ?? "").split(",");
    const [lat, lng] = atParts.map(Number);
    // entrambe le coordinate scritte davvero (Number("") varrebbe 0: Golfo di Guinea)
    const center = atParts.length === 2 && atParts.every((x) => x.trim() !== "") &&
      Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
      ? { lat, lng }
      : undefined;
    params.delete("q");
    params.delete("at");
    const rest = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}`);
    // Fuori dal ciclo dell'effetto: gli aggiornamenti di stato partono dopo il primo disegno.
    // Senza "at" la ricerca parte da dove sei (permesso già dato) o dall'ultima vista.
    void (center ? Promise.resolve(null) : here).then((pos) => {
      const start = center ?? (startHere(pos) ? pos : last ? { lat: last.lat, lng: last.lng } : undefined);
      if (start) setViewState((v) => ({ ...v, latitude: start.lat, longitude: start.lng, zoom: center || startHere(pos) ? 13 : v.zoom }));
      setWelcomeDismissed(true);
      setAiQuery(q);
      void runAISearch(q, start);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al primo caricamento
  }, []);

  return (
    // Da computer (lg, piano 6.5) diventa una griglia: mappa a sinistra, pannello a destra largo
    // --pannello (ricerca in alto, sotto lista o scheda). Sul telefono resta tutto sovrapposto alla mappa.
    <div className="fixed inset-0 md:top-14 lg:grid lg:grid-cols-[minmax(0,1fr)_var(--pannello)] lg:grid-rows-[auto_minmax(0,1fr)] lg:[--pannello:420px] xl:[--pannello:460px]">
      {/* Fondo del pannello da computer (sotto ricerca, lista e scheda). */}
      <div aria-hidden className="hidden lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:block lg:border-l lg:border-border lg:bg-bg" />
      {/* Torna alla mia posizione: sempre raggiungibile, anche dopo aver chiuso la card iniziale.
          Con la barra sta sulla seconda riga, così la frase cercata ha tutta la larghezza (17/10: "Rooftop romanti…"). */}
      <button
        type="button"
        onClick={goToMyPosition}
        disabled={geoState === "loading"}
        aria-label="La mia posizione"
        className={`absolute right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-surface text-brand shadow-float active:scale-95 disabled:opacity-60 lg:right-[calc(var(--pannello)+1rem)] lg:top-4 ${barOn ? "top-[4.125rem]" : "top-4"} ${venueOpen ? "max-lg:invisible" : ""}`}
      >
        <LocateFixed size={20} className={geoState === "loading" ? "animate-pulse" : ""} />
      </button>
      {/* Tocco fuori dal pannello "Ti suggeriamo": si chiude e la mappa torna libera. */}
      {ideasShown && <div aria-hidden data-testid="idee-fuori" className="absolute inset-0 z-10" onClick={() => setIdeasOpen(false)} />}
      {/* Pannello controlli superiori: ricerca AI + ricerca luoghi + switch impilati.
          Sul telefono, a scheda aperta, si nasconde: sotto il velo si accavallava con "‹ 1 di 2 ›". */}
      <div data-testid="pannello-ricerca" className={`absolute top-4 left-4 z-10 flex flex-col gap-2 pointer-events-none lg:pointer-events-auto lg:static lg:col-start-2 lg:row-start-1 lg:w-auto lg:max-w-none lg:px-5 lg:pb-3 lg:pt-5 ${venueOpen ? "max-lg:invisible" : ""} ${barOn ? "w-[calc(100%-2rem)] max-w-md" : "w-80 max-w-[90vw]"}`}>
        {/* Da computer, a mappa vuota: titolo del pannello sopra la barra (sul telefono non c'è). */}
        {view === "all" && aiSearch === null && !aiSearching && overlay.kind === "none" && (
          <div data-testid="pannello-intro" className="hidden pb-2 lg:block">
            <h1 className="font-title text-2xl font-semibold leading-tight text-brand in-data-[titoli=serif]:text-3xl">Dove andiamo?</h1>
            <p className="mt-1 text-sm font-sans text-text-muted">Scrivi cosa cerchi come lo diresti a un amico: trovo i posti giusti per te, non quelli di tutti, e ti dico perché.</p>
          </div>
        )}
        {/* Riga icone: Concierge AI + Filtri (con ?beta=barra: campo "Cosa cerchi?" sempre visibile, come Places) */}
        <div className="pointer-events-auto flex gap-2">
          {barOn ? (
            <form
              data-testid="barra-ricerca"
              className="flex min-w-0 flex-1 items-center gap-2 rounded-pill bg-surface pl-3.5 pr-1 shadow-float"
              onSubmit={(e) => {
                e.preventDefault();
                const q = aiQuery.trim();
                if (q.length < 3 || aiSearching) return;
                (document.activeElement as HTMLElement | null)?.blur();
                setWelcomeDismissed(true);
                if (overlay.kind === "ai") dispatch({ type: "CLOSE" });
                void runAISearch(q);
              }}
            >
              {aiSearching ? (
                <span className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-border border-t-brand" />
              ) : (
                <Sparkles size={18} className="shrink-0 text-accent" aria-hidden />
              )}
              <input
                ref={barInputRef}
                type="search"
                enterKeyHint="search"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                onFocus={() => setIdeasOpen(true)}
                placeholder="Chiedi all'AI…"
                aria-label="Chiedi all'AI: cosa cerchi?"
                className="min-h-11 min-w-0 flex-1 bg-transparent text-base font-sans text-text placeholder:text-text-muted focus:outline-none [&::-webkit-search-cancel-button]:hidden"
              />
              {voiceOn && aiQuery === "" && aiSearch === null && (
                <VoiceButton
                  onError={setAiError}
                  onText={(t) => {
                    // Stessi controlli dell'invio scritto: niente ricerca a pagamento per un "sì".
                    const q = t.trim();
                    setAiQuery(q);
                    if (q.length < 3 || aiSearching) return;
                    setWelcomeDismissed(true);
                    if (overlay.kind === "ai") dispatch({ type: "CLOSE" });
                    void runAISearch(q);
                  }}
                />
              )}
              {(aiQuery !== "" || aiSearch !== null) && (
                <button
                  type="button"
                  aria-label="Cancella la ricerca"
                  onClick={() => { setClusterPlaces(null); setFilterError(null); clearAiSearch(); setAiQuery(""); setAiError(null); dispatch({ type: "RESET" }); }}
                  className="flex h-10 w-10 shrink-0 items-center justify-center text-base text-text-muted"
                >
                  ✕
                </button>
              )}
            </form>
          ) : (
          <button
            type="button"
            onClick={() => {
              // La ricerca AI resta: si azzera solo con ✕ o passando ai filtri.
              dispatch({ type: overlay.kind === "ai" ? "CLOSE" : "OPEN_AI" });
            }}
            aria-label="Ricerca con l'AI"
            className="relative flex h-11 w-11 items-center justify-center rounded-full bg-surface shadow-float hover:shadow-card transition-shadow"
          >
            <Sparkles size={20} className="text-brand" />
            {aiSearch?.filtri != null && (
              <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-accent border-2 border-surface" />
            )}
          </button>
          )}
          <button
            type="button"
            aria-label="Filtri"
            data-testid={savedControlsOn ? "salvati-apri-filtri" : undefined}
            onClick={() => {
              // Nei salvati un solo "Filtri": stato, città, raccolte, ordine (e da lì tipo/voto/prezzo).
              if (savedControlsOn) { setSavedSheetOpen(true); return; }
              clearAiSearch();
              setAiQuery("");
              setAiError(null);
              dispatch({ type: "OPEN_FILTERS" });
            }}
            className={`relative flex shrink-0 h-11 items-center justify-center rounded-full bg-surface shadow-float hover:shadow-card transition-shadow ${barOn ? "gap-1.5 px-3.5" : "w-11"}`}
          >
            <SlidersHorizontal size={barOn ? 18 : 20} className={barOn ? "text-brand" : "text-text-muted"} />
            {barOn && <span className="text-sm font-display font-semibold text-brand">Filtri</span>}
            {(savedControlsOn ? savedActiveCount : countActive(filters)) > 0 && (
              <span data-testid={savedControlsOn ? "salvati-filtri-attivi" : undefined} className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent font-display text-xs font-bold text-white">
                {savedControlsOn ? savedActiveCount : countActive(filters)}
              </span>
            )}
          </button>
        </div>
        {/* Errore della ricerca dalla barra: se la card iniziale è chiusa non si vedrebbe altrove. */}
        {barOn && aiError && !aiSearching && overlay.kind !== "ai" && !(view === "all" && aiSearch === null && overlay.kind === "none" && !welcomeHidden) && (
          <button
            type="button"
            data-testid="errore-barra"
            onClick={() => setAiError(null)}
            className="pointer-events-auto self-start rounded-card bg-surface px-3 py-2 text-left text-sm font-sans text-error shadow-float"
          >
            {aiError} ✕
          </button>
        )}
        {/* Mentre scrivi: prima i tuoi salvati che c'entrano (un tocco = la sua scheda), poi Invio cerca nel mondo. */}
        {barOn && view === "all" && aiSearch === null && !aiSearching && aiQuery.trim().length >= 4 && savedMatches(savedPlaces, aiQuery).length > 0 && (
          <div data-testid="nei-salvati" className="pointer-events-auto rounded-card border border-border bg-surface p-2 shadow-float">
            <p className="px-1 pb-1 text-xs font-display font-semibold uppercase tracking-wide text-accent">📌 Nei tuoi salvati</p>
            {savedMatches(savedPlaces, aiQuery).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setView("saved"); setAiQuery(""); dispatch({ type: "OPEN_VENUE", placeId: p.id });
                  const map = (mapRef.current as { getMap?: () => { flyTo: (opts: { center: [number, number]; zoom: number }) => void } } | null)?.getMap?.();
                  if (map) map.flyTo({ center: [p.lng, p.lat], zoom: Math.max(viewState.zoom, 15) });
                }}
                className="flex w-full items-center gap-2 rounded-btn px-1 py-1.5 text-left active:bg-brand-light"
              >
                <span aria-hidden className="text-xl">{getCategoryEmoji(p.category, p.name)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-display font-semibold text-text">{p.name}</span>
                  <span className="block truncate text-xs font-sans text-text-muted">
                    {[p.tags?.includes(VISIT_DONE) ? "✓ Ci sono stato" : p.tags?.includes(VISIT_WANT) ? "📌 Voglio andarci" : null, cityFromAddress(p.address), p.note ? `“${p.note}”` : null].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
            ))}
            <p className="px-1 pt-1 text-xs font-sans text-text-muted">Premi Invio per cercare nuovi posti con l&apos;AI.</p>
          </div>
        )}
        {/* Seconda riga (Lorenzo 16/10: schermo più libero): Esplora/I miei salvati e UN solo accesso
            a tutti i suggerimenti ("Idee"), che si aprono in un pannello ordinato. A destra resta
            libero il posto del pulsante "La mia posizione". */}
        <div className={`flex items-center gap-2 lg:pr-0 ${barOn ? "pr-14" : ""}`}>
          <div className="pointer-events-auto flex shrink-0 rounded-pill overflow-hidden shadow-float bg-surface">
            <button
              type="button"
              onClick={() => { setView("all"); setActiveTag(null); setActiveCity(null); setSavedQuery(""); clearAiSearch(); setAiQuery(""); setClusterPlaces(null); setFilterError(null); dispatch({ type: "RESET" }); }}
              className={
                view === "all"
                  ? "min-h-10 px-3 py-2 text-sm font-display font-semibold bg-brand text-white"
                  : "min-h-10 px-3 py-2 text-sm font-display font-semibold bg-surface text-text-muted hover:text-text"
              }
            >
              Esplora
            </button>
            <button
              type="button"
              onClick={() => { setView("saved"); clearAiSearch(); setAiQuery(""); setClusterPlaces(null); setFilterError(null); dispatch({ type: "OPEN_LIST" }); }}
              className={
                view === "saved"
                  ? "min-h-10 px-3 py-2 text-sm font-display font-semibold bg-brand text-white"
                  : "min-h-10 px-3 py-2 text-sm font-display font-semibold bg-surface text-text-muted hover:text-text"
              }
            >
              I miei salvati
            </button>
          </div>
          {chipsOn && view === "all" && aiSearch === null && !aiSearching && overlay.kind === "none" && (
            <button
              type="button"
              data-testid="apri-idee"
              aria-expanded={ideasShown}
              onClick={() => setIdeasOpen((o) => !o)}
              className={`pointer-events-auto flex min-h-10 shrink-0 items-center gap-1.5 rounded-pill px-3.5 text-sm font-display font-semibold shadow-float active:scale-95 ${ideasShown ? "bg-brand text-white" : "bg-surface text-brand"}`}
            >
              {ideasShown ? <X size={16} aria-hidden /> : <Lightbulb size={16} className="text-accent" aria-hidden />}
              Idee
            </button>
          )}
        </div>
        {/* "Ti suggeriamo" (Lorenzo 16/10): tutti i suggerimenti dietro un solo tocco (Idee o tocco sulla barra),
            in gruppi brevi come lo storico di Places. Resta nel DOM anche chiuso (nascosto). */}
        {chipsOn && view === "all" && aiSearch === null && !aiSearching && overlay.kind === "none" && aiQuery.trim() === "" && (
          <div
            data-testid="idee-pannello"
            className={`pointer-events-auto max-h-[calc(100dvh-14rem)] w-[calc(100vw-2rem)] max-w-md overflow-y-auto rounded-card bg-surface p-2 shadow-float lg:w-auto lg:max-w-none ${ideasShown ? "" : "hidden"}`}
          >
            <p className="px-2 pb-1 pt-1 font-title text-lg font-semibold text-brand">Ti suggeriamo</p>
            <IdeaGroup title="Adesso">
              {momentExample && (
                <IdeaRow testId="suggerimento-momento" emoji={momentExample.split(" ")[0]} title={momentExample.replace(/^\S+\s/, "")} onClick={() => { const q = momentExample.replace(/^\S+\s/, ""); setIdeasOpen(false); setAiQuery(q); void runAISearch(q); }} />
              )}
              <IdeaRow testId="vicino-adesso" emoji="📍" title="Vicino a me, aperto adesso" sub={nearNowQuery(new Date()).sub} onClick={searchNearNow} />
              <IdeaRow testId="mappa-sorprendimi" emoji="🎲" title="Sorprendimi" sub="Un posto nuovo che probabilmente ti piace" href={`/sorprendimi?da=mappa&lat=${viewState.latitude.toFixed(4)}&lng=${viewState.longitude.toFixed(4)}`} />
              {userId && savedPlaces.length > 0 && (
                <IdeaRow testId="idee-stasera" emoji="🍽️" title="Stasera dove andiamo?" sub="Tre proposte dai tuoi salvati" href="/stasera" />
              )}
            </IdeaGroup>
            <IdeaGroup title="Per te">
              {tasteSuggestion && (
                <IdeaRow testId="suggerimento-per-te" label={`✨ Per te: ${tasteSuggestion}`} emoji="✨" title={tasteSuggestion} sub="Dai tuoi gusti" onClick={() => { setIdeasOpen(false); setAiQuery(tasteSuggestion); void runAISearch(tasteSuggestion); }} />
              )}
              {savedSuggestion && (
                <IdeaRow testId="suggerimento-salvati" label={`✨ Dai tuoi salvati: ${savedSuggestion.label}`} emoji="📌" title={savedSuggestion.label} sub="Dai tuoi salvati" onClick={() => { setIdeasOpen(false); setAiQuery(savedSuggestion.query); void runAISearch(savedSuggestion.query); }} />
              )}
              <IdeaRow testId="mappa-assistente" emoji="💬" title="Parla con l'assistente" sub="Chiedi, affina, prenota" href="/assistente" />
            </IdeaGroup>
            {recentOn && (JSON.parse(recentSearches) as string[]).length > 0 && (
              <IdeaGroup
                title="Recenti"
                action={
                  <button type="button" data-testid="cancella-recenti" onClick={clearRecentSearches} aria-label="Cancella le ricerche recenti" className="min-h-8 px-2 text-xs font-sans text-text-muted active:scale-95">
                    Cancella
                  </button>
                }
              >
                {(JSON.parse(recentSearches) as string[]).slice(0, 3).map((r) => (
                  <IdeaRow key={`r-${r}`} testId="recenti" label={`↻ ${r}`} emoji="↻" title={r} onClick={() => { setIdeasOpen(false); setAiQuery(r); void runAISearch(r); }} />
                ))}
              </IdeaGroup>
            )}
            <IdeaGroup title="Prova a chiedere">
              {WELCOME_EXAMPLES.map((ex) => (
                <IdeaRow key={ex.query} label={ex.query} emoji="🔎" title={ex.title} sub={ex.sub} onClick={() => { setIdeasOpen(false); setAiQuery(ex.query); void runAISearch(ex.query); }} />
              ))}
            </IdeaGroup>
          </div>
        )}
        {/* Pannello AI espandibile */}
        {overlay.kind === "ai" && (
          <div className="pointer-events-auto w-80 max-w-[90vw] relative lg:w-auto lg:max-w-none">
            <AISearchPanel
              key={view}
              query={aiQuery}
              setQuery={setAiQuery}
              onSubmit={(q) => { void runAISearch(q); }}
              isSearching={aiSearching}
              error={aiError}
              onClear={() => { setClusterPlaces(null); setFilterError(null); clearAiSearch(); setAiQuery(""); setAiError(null); dispatch({ type: "RESET" }); }}
              activeFiltri={aiSearch?.filtri ?? null}
              activeCount={aiSearch?.risultati.length ?? null}
              recent={recentOn ? (JSON.parse(recentSearches) as string[]).slice(0, 3) : []}
              withInput={!barOn}
            />
          </div>
        )}
        {savedControlsOn && (
          <div data-testid="salvati-filtri" className="pointer-events-auto flex flex-col gap-1.5 rounded-card border border-border bg-surface p-1.5 shadow-float">
            {/* Una riga (Lorenzo 16/10, "il dono della sintesi"): cerca + "Stasera". Stato, città, raccolte e
                ordine sono dietro "Filtri" in alto (col numero dei filtri accesi). */}
            <div className="flex items-center gap-1.5">
              <input
                type="search"
                value={savedQuery}
                onChange={(e) => {
                  const v = e.target.value;
                  setSavedQuery(v); setClusterPlaces(null);
                  // Dopo una pausa la mappa va sui salvati trovati ("il giapponese di Milano" da Roma).
                  if (savedFitTimer.current) clearTimeout(savedFitTimer.current);
                  savedFitTimer.current = setTimeout(() => {
                    const found = filterSaved(savedPlaces, activeTag, activeCity, v);
                    if (v.trim() && found.length > 0) fitToPlaces(found, 150);
                  }, 600);
                }}
                placeholder={`Cerca in ${savedPlaces.length} salvati`}
                aria-label="Cerca tra i salvati"
                className="min-h-10 min-w-0 flex-1 rounded-btn border border-border bg-white px-3 text-base font-sans text-text placeholder:text-text-muted focus:border-brand focus:outline-none"
              />
              {/* Il momento della scelta (VISIONE.md: "ritrovarlo nel momento giusto"): tre proposte dai tuoi salvati. */}
              <Link
                href="/stasera"
                data-testid="vai-stasera"
                aria-label="Stasera dove andiamo?"
                className="flex min-h-10 shrink-0 items-center gap-1 rounded-btn bg-brand px-3 text-sm font-display font-semibold text-white active:scale-95"
              >
                <span aria-hidden>🍽️</span> Stasera
              </Link>
            </div>
            {/* I filtri accesi restano in vista: un tocco li toglie. */}
            {(activeTag !== null || activeCity !== null || savedNearestOn) && (
              <div data-testid="salvati-attivi" className="-mx-1.5 flex gap-1.5 overflow-x-auto px-1.5 [scrollbar-width:none]">
                {activeTag !== null && (
                  <button type="button" onClick={() => { setActiveTag(null); clearAiSearch(); setClusterPlaces(null); }} aria-label={`Togli ${tagLabel(activeTag)}`} className={`shrink-0 ${CHIP_ACTIVE}`}>
                    {tagLabel(activeTag)} <X size={12} aria-hidden />
                  </button>
                )}
                {activeCity !== null && (
                  <button type="button" onClick={() => { setActiveCity(null); clearAiSearch(); setClusterPlaces(null); fitToPlaces(filterSaved(savedPlaces, activeTag, null, savedQuery), 150); }} aria-label={`Togli ${activeCity}`} className={`shrink-0 ${CHIP_ACTIVE}`}>
                    📍 {activeCity} <X size={12} aria-hidden />
                  </button>
                )}
                {savedNearestOn && (
                  <button type="button" onClick={() => setSavedNearest(false)} aria-label="Togli Più vicini" className={`shrink-0 ${CHIP_ACTIVE}`}>
                    Più vicini <X size={12} aria-hidden />
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Messaggio se non loggato e vista "salvati" */}
      {view === "saved" && !userId && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none lg:static lg:col-start-2 lg:row-start-2 lg:items-start lg:px-5 lg:pt-2">
          <div className="bg-surface rounded-card shadow-float p-6 text-center max-w-xs pointer-events-auto lg:w-full lg:max-w-none lg:shadow-none">
            <p className="text-2xl mb-2">🔒</p>
            <p className="font-display font-semibold text-text">Accesso richiesto</p>
            <p className="mt-1 text-sm font-sans text-text-muted">
              Accedi per vedere la tua mappa personale
            </p>
            <a
              href="/login"
              className="mt-4 inline-block rounded-btn bg-brand px-4 py-2 text-sm font-display font-semibold text-white hover:opacity-90 active:scale-95"
            >
              Accedi
            </a>
          </div>
        </div>
      )}

      {/* Spinner caricamento salvati */}
      {view === "saved" && userId && loadingSaved && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none lg:static lg:col-start-2 lg:row-start-2 lg:items-start lg:px-5 lg:pt-2">
          <div className="bg-surface rounded-card shadow-card px-4 py-2 text-sm font-sans text-text-muted">
            Caricamento...
          </div>
        </div>
      )}

      {/* Empty state — nessun luogo da mostrare */}
      {displayedPlaces.length === 0 &&
        !(view === "saved" && !userId) &&
        !(view === "saved" && userId && loadingSaved) &&
        !(view === "all" && aiSearch === null) && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none lg:static lg:col-start-2 lg:row-start-2 lg:items-start lg:px-5 lg:pt-2">
            <div className="bg-surface rounded-card shadow-float p-6 text-center max-w-xs pointer-events-auto lg:w-full lg:max-w-none lg:shadow-none">
              <p className="text-2xl mb-2">
                {aiSearch !== null ? "🔍" : view === "saved" && savedFiltered ? "🏷️" : "📍"}
              </p>
              <p className="font-display font-semibold text-text">
                {aiSearch !== null
                  ? "Non ho trovato nulla"
                  : view === "saved" && savedFiltered
                    ? "Nessun salvato con questi filtri"
                    : view === "saved"
                      ? "La tua mappa è ancora vuota"
                      : "Nessun posto da mostrare"}
              </p>
              <p className="mt-1 text-sm font-sans text-text-muted">
                {aiSearch !== null
                  ? "Prova con meno requisiti o scrivi un'altra zona (es. “a Trastevere”)."
                  : view === "saved" && savedFiltered
                    ? "Cambia la ricerca o tocca “Tutti”"
                    : view === "saved"
                      ? "Salva i posti che scopri, da qualsiasi app: li ritrovi qui quando devi scegliere."
                      : "Sposta la mappa o cambia vista"}
              </p>
              {aiSearch === null && view === "saved" && !savedFiltered && (
                <button
                  type="button"
                  onClick={() => { setView("all"); setActiveTag(null); setActiveCity(null); setSavedQuery(""); setWelcomeDismissed(false); setIdeasOpen(true); dispatch({ type: "RESET" }); }}
                  className="mt-4 min-h-11 rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white active:scale-95"
                >
                  Cerca un locale
                </button>
              )}
              {/* Zero salvati (VISIONE.md "Raccogli"): i modi di salvare, a un tocco. */}
              {aiSearch === null && view === "saved" && !savedFiltered && (
                <div data-testid="raccogli-vuoto" className="mt-3 flex flex-wrap justify-center gap-2">
                  {([["📍 Da Google Maps", "/importa"], ["📸 Da uno screenshot", "/importa#da-screenshot"], ["✍️ A mano", "/importa#a-mano"]] as const).map(([label, href]) => (
                    <Link key={href} href={href} className="inline-flex min-h-10 items-center rounded-pill border border-border bg-white px-3.5 text-sm font-display font-semibold text-brand active:scale-95">
                      {label}
                    </Link>
                  ))}
                </div>
              )}
              {aiSearch !== null && (
                <div className="mt-4 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => { dispatch({ type: "OPEN_AI" }); if (barOn) barInputRef.current?.focus(); }}
                    className="min-h-11 rounded-pill bg-brand px-4 text-sm font-display font-semibold text-white active:scale-95"
                  >
                    Correggi la ricerca
                  </button>
                  <button
                    type="button"
                    onClick={() => { clearAiSearch(); setAiQuery(""); setWelcomeDismissed(false); setIdeasOpen(true); dispatch({ type: "RESET" }); }}
                    className="min-h-11 rounded-pill border border-border px-4 text-sm font-display font-semibold text-brand active:scale-95"
                  >
                    Vedi esempi
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      {/* Primo accesso, variante B (stile Places): suggerimenti a schede e campo di ricerca subito scrivibile. */}
      {homeVariant === "b" && view === "all" && aiSearch === null && overlay.kind === "none" && !welcomeDismissed && (
        <div
          data-testid="benvenuto"
          className="absolute inset-x-0 z-10 flex justify-center px-3 pointer-events-none lg:right-[var(--pannello)]"
          style={{ bottom: "calc(var(--nav-height-mobile) + var(--nav-sporgenza) + 0.5rem)" }}
        >
          <div className="pointer-events-auto w-full max-w-md">
            <div className="-mx-3 mb-2 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none]">
              {recentOn && (JSON.parse(recentSearches) as string[]).map((r) => (
                <button
                  key={`r-${r}`}
                  type="button"
                  data-testid="recenti"
                  disabled={aiSearching}
                  onClick={() => { setAiQuery(r); void runAISearch(r); }}
                  className="min-h-14 max-w-56 shrink-0 rounded-card border border-border bg-white/95 px-3.5 py-2 text-left text-sm font-sans text-accent shadow-card backdrop-blur active:scale-95 disabled:opacity-60"
                >
                  <span className="line-clamp-2">↻ {r}</span>
                </button>
              ))}
              {recentOn && (JSON.parse(recentSearches) as string[]).length > 0 && (
                <button
                  type="button"
                  onClick={clearRecentSearches}
                  aria-label="Cancella le ricerche recenti"
                  className="min-h-14 shrink-0 rounded-card px-2 text-xs font-sans text-text-muted active:scale-95"
                >
                  Cancella
                </button>
              )}
              {WELCOME_EXAMPLES.map((ex) => (
                <button
                  key={ex.query}
                  type="button"
                  aria-label={ex.query}
                  disabled={aiSearching}
                  onClick={() => { setAiQuery(ex.query); void runAISearch(ex.query); }}
                  className="min-h-14 shrink-0 rounded-card border border-border bg-white/95 px-3.5 py-2 text-left shadow-card backdrop-blur active:scale-95 disabled:opacity-60"
                >
                  <span className="block text-sm font-sans font-medium text-text">{ex.title}</span>
                  <span className="block text-sm font-sans text-text-muted">{ex.sub}</span>
                </button>
              ))}
            </div>
            {/* Con la barra in alto il campo c'è già: qui restano solo gli esempi. */}
            {!barOn && <form
              onSubmit={(e) => { e.preventDefault(); if (aiQuery.trim()) void runAISearch(aiQuery.trim()); }}
              className="rounded-card border border-border bg-white p-3 shadow-float"
            >
              <label htmlFor="cerca-home" className="sr-only">Cosa cerchi?</label>
              <textarea
                id="cerca-home"
                rows={2}
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (aiQuery.trim()) void runAISearch(aiQuery.trim()); }
                }}
                placeholder="Cosa cerchi?"
                className="font-title block w-full resize-none bg-transparent text-base text-text placeholder:text-text-muted focus:outline-none"
              />
              <div className="mt-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={goToMyPosition}
                  disabled={geoState === "loading"}
                  aria-label="Usa la mia posizione"
                  className="-ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-pill px-2 text-sm font-sans text-text-muted active:scale-95 disabled:opacity-60"
                >
                  <LocateFixed size={18} className="text-brand" />
                  {geoState === "loading" ? "Cerco…" : "Vicino a me"}
                </button>
                <button
                  type="submit"
                  disabled={aiSearching || aiQuery.trim() === ""}
                  aria-label="Cerca"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-white active:scale-95 disabled:opacity-40"
                >
                  {aiSearching ? (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  ) : (
                    <ArrowUp size={20} />
                  )}
                </button>
              </div>
              {aiError && <p className="mt-2 text-sm text-error">{aiError}</p>}
              {(geoState === "denied" || geoState === "unavailable") && (
                <p className="mt-2 text-xs font-sans text-text-muted">
                  {geoState === "denied"
                    ? "Non ho il permesso di vedere dove sei: attivalo dalle impostazioni del browser, oppure scrivi la zona (es. “a Trastevere”)."
                    : "Non riesco a trovare la tua posizione: scrivi la zona (es. “a Trastevere”)."}
                </p>
              )}
            </form>}
            {barOn && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={goToMyPosition}
                  disabled={geoState === "loading"}
                  aria-label="Usa la mia posizione"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-pill border border-border bg-white px-4 text-sm font-display font-semibold text-brand shadow-card active:scale-95 disabled:opacity-60"
                >
                  <LocateFixed size={16} aria-hidden />
                  {geoState === "loading" ? "Cerco…" : "Vicino a me"}
                </button>
                <button
                  type="button"
                  data-testid="benvenuto-filtri"
                  onClick={() => { clearAiSearch(); setAiQuery(""); dispatch({ type: "OPEN_FILTERS" }); }}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-pill border border-border bg-white px-4 text-sm font-display font-semibold text-brand shadow-card active:scale-95"
                >
                  <SlidersHorizontal size={16} aria-hidden /> Oppure usa i filtri
                </button>
              </div>
            )}
            {barOn && aiError && <p className="mt-1 rounded-card bg-surface px-3 py-2 text-sm text-error shadow-card">{aiError}</p>}
          </div>
        </div>
      )}

      {/* Senza la card in basso, l'invito ad aggiungere alla Home resta per chi torna (ha già cercato). */}
      {chipsOn && view === "all" && aiSearch === null && overlay.kind === "none" && recentOn && (JSON.parse(recentSearches) as string[]).length > 0 && (
        <div className="absolute inset-x-0 z-10 flex justify-center px-3" style={{ bottom: "calc(var(--nav-height-mobile) + var(--nav-sporgenza) + 0.5rem)" }}>
          <div className="w-full max-w-md empty:hidden">
            <InstallHint />
          </div>
        </div>
      )}
      {/* Primo accesso: barra compatta in basso (la mappa resta visibile). */}
      {homeVariant === "a" && view === "all" && aiSearch === null && overlay.kind === "none" && !welcomeHidden && (
        <div
          data-testid="benvenuto"
          className="absolute inset-x-0 z-10 flex justify-center px-3 pointer-events-none lg:right-[var(--pannello)]"
          style={{ bottom: "calc(var(--nav-height-mobile) + var(--nav-sporgenza) + 0.5rem)" }}
        >
          <div className="pointer-events-auto w-full max-w-md rounded-card bg-surface px-3 pb-3 pt-2 shadow-float">
            <div className="flex items-center justify-between">
              <p className="font-title text-lg font-semibold text-brand">{barOn ? "✨ Chiedi all'AI, per esempio:" : "Cosa cerchi?"}</p>
              <button
                type="button"
                onClick={() => setWelcomeDismissed(true)}
                aria-label="Chiudi"
                className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center text-lg text-text-muted"
              >
                ✕
              </button>
            </div>
            <div className="-mx-3 -mt-1 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none]">
              {recentOn && (JSON.parse(recentSearches) as string[]).map((r) => (
                <button
                  key={`r-${r}`}
                  type="button"
                  data-testid="recenti"
                  disabled={aiSearching}
                  onClick={() => { setAiQuery(r); void runAISearch(r); }}
                  className="min-h-11 shrink-0 rounded-pill bg-accent-light px-3.5 text-sm font-sans text-accent active:scale-95 disabled:opacity-60"
                >
                  ↻ {r}
                </button>
              ))}
              {recentOn && (JSON.parse(recentSearches) as string[]).length > 0 && (
                <button
                  type="button"
                  data-testid="cancella-recenti"
                  onClick={clearRecentSearches}
                  aria-label="Cancella le ricerche recenti"
                  className="min-h-11 shrink-0 rounded-pill px-2 text-xs font-sans text-text-muted underline-offset-2 active:scale-95"
                >
                  Cancella
                </button>
              )}
              <Link
                key="sorprendimi"
                href={`/sorprendimi?da=mappa&lat=${viewState.latitude.toFixed(4)}&lng=${viewState.longitude.toFixed(4)}`}
                data-testid="mappa-sorprendimi"
                className="flex min-h-11 shrink-0 items-center rounded-pill bg-accent px-3.5 text-sm font-sans font-semibold text-white active:scale-95"
              >
                🎲 Sorprendimi
              </Link>
              {tasteSuggestion && (
                <button
                  key="per-te"
                  type="button"
                  data-testid="suggerimento-per-te"
                  disabled={aiSearching}
                  onClick={() => { setAiQuery(tasteSuggestion); void runAISearch(tasteSuggestion); }}
                  className="min-h-11 shrink-0 rounded-pill bg-brand px-3.5 text-sm font-sans font-semibold text-white active:scale-95 disabled:opacity-60"
                >
                  ✨ Per te: {tasteSuggestion}
                </button>
              )}
              {momentExample && (
                <button
                  key="momento"
                  type="button"
                  data-testid="suggerimento-momento"
                  disabled={aiSearching}
                  onClick={() => { const q = momentExample.replace(/^\S+\s/, ""); setAiQuery(q); void runAISearch(q); }}
                  className="min-h-11 shrink-0 rounded-pill border border-brand/40 bg-white px-3.5 text-sm font-sans font-semibold text-brand active:scale-95 disabled:opacity-60"
                >
                  {momentExample}
                </button>
              )}
              {WELCOME_EXAMPLES.map(({ query: example }) => (
                <button
                  key={example}
                  type="button"
                  disabled={aiSearching}
                  onClick={() => { setAiQuery(example); void runAISearch(example); }}
                  className="min-h-11 shrink-0 rounded-pill border border-border bg-white px-3.5 text-sm font-sans text-text active:scale-95 disabled:opacity-60"
                >
                  {example}
                </button>
              ))}
            </div>
            {aiSearching && (
              <p className="mt-2 flex items-center gap-2 text-sm text-text-muted">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-border border-t-brand" />
                Sto cercando…
              </p>
            )}
            {aiError && <p className="mt-2 text-sm text-error">{aiError}</p>}
            <div className="mt-2 flex gap-2">
              {/* Campo di ricerca direttamente nella card (come la home di Places): si scrive subito.
                  Con la barra in alto il campo c'è già: qui resta solo "Dove sono". */}
              {!barOn && <form
                className="flex min-w-0 flex-1 items-center gap-2 rounded-pill bg-brand pl-3.5 pr-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  const q = aiQuery.trim();
                  if (q.length >= 3 && !aiSearching) void runAISearch(q);
                }}
              >
                <Sparkles size={16} className="shrink-0 text-accent" aria-hidden />
                <input
                  type="search"
                  enterKeyHint="search"
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  placeholder="Scrivi cosa cerchi…"
                  aria-label="Scrivi cosa cerchi"
                  className="min-h-11 min-w-0 flex-1 bg-transparent text-base font-sans text-white placeholder:text-white/70 focus:outline-none"
                />
                {aiQuery.trim().length >= 3 && (
                  <button type="submit" disabled={aiSearching} aria-label="Cerca" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white active:scale-95 disabled:opacity-60">
                    →
                  </button>
                )}
              </form>}
              <button
                type="button"
                onClick={goToMyPosition}
                disabled={geoState === "loading"}
                aria-label="Usa la mia posizione"
                className="min-h-11 shrink-0 rounded-pill border border-border px-4 text-sm font-display font-semibold text-brand active:scale-95 disabled:opacity-60"
              >
                {geoState === "loading" ? "Cerco…" : "📍 Dove sono"}
              </button>
              {barOn && (
                <button
                  type="button"
                  data-testid="benvenuto-filtri"
                  onClick={() => { clearAiSearch(); setAiQuery(""); dispatch({ type: "OPEN_FILTERS" }); }}
                  className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-pill border border-border px-4 text-sm font-display font-semibold text-brand active:scale-95"
                >
                  <SlidersHorizontal size={16} aria-hidden /> Oppure usa i filtri
                </button>
              )}
            </div>
            {/* Solo a chi torna (ha già cercato): al primo accesso conta la ricerca. */}
            {recentOn && (JSON.parse(recentSearches) as string[]).length > 0 && <InstallHint />}
            {(geoState === "denied" || geoState === "unavailable") && (
              <p className="mt-2 text-xs font-sans text-text-muted">
                {geoState === "denied"
                  ? "Non ho il permesso di vedere dove sei: attivalo dalle impostazioni del browser, oppure scrivi la zona (es. “a Trastevere”)."
                  : "Non riesco a trovare la tua posizione: scrivi la zona (es. “a Trastevere”)."}
              </p>
            )}
          </div>
        </div>
      )}


      {/* Dopo aver spostato la mappa: rifà la stessa ricerca nella zona visibile. */}
      {/* Vale anche per i risultati dei filtri: rifà la stessa ricerca a filtri nella zona visibile. */}
      {/* Niente "Cerca in quest'area" se la ricerca nomina già una zona ("a Trastevere"): il server
          ignora la posizione della mappa e restituirebbe la stessa lista, pagando un'altra ricerca. */}
      {view === "all" && aiSearch !== null && movedSinceSearch && (aiQuery.trim() !== "" || (aiSearch.query == null && countActive(filters) > 0)) && !(aiSearch.query != null && aiSearch.filtri?.zona && aiQuery.trim() === aiSearch.query.trim()) && (overlay.kind === "list" || overlay.kind === "none") && (
        <div className="pointer-events-none absolute inset-x-0 top-[7.5rem] z-10 flex justify-center lg:right-[var(--pannello)] lg:top-4">
          <button
            type="button"
            disabled={aiSearching || filterLoading}
            onClick={() => {
              if (aiSearch?.query == null && countActive(filters) > 0) {
                // Spostata la mappa, il raggio si misura da dove si guarda (non più da me).
                const f = withDefaults(filters).radiusKm != null ? { ...filters, radiusFrom: "map" as const } : filters;
                setFilters(f);
                void runFilteredSearch(f, { query: filterQueryRef.current });
                return;
              }
              const q = (aiSearch?.query ?? aiQuery).trim(); setAiQuery(q); void runAISearch(q);
            }}
            className="pointer-events-auto min-h-11 rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white shadow-float active:scale-95 disabled:opacity-60"
          >
            {aiSearching || filterLoading ? "Cerco…" : "Cerca in quest'area"}
          </button>
        </div>
      )}

      <Map
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        onMoveEnd={(evt) => saveLastView({ lat: evt.viewState.latitude, lng: evt.viewState.longitude, zoom: evt.viewState.zoom })}
        onMoveStart={(evt) => {
          if (!(evt as { originalEvent?: unknown }).originalEvent) return;
          touchedMap.current = true;
          if (aiSearch !== null) setMovedSinceSearch(true);
        }}
        ref={mapRef}
        // isolation: i livelli dei pin (fino a 100, vedi sotto) restano dentro la mappa e non salgono
        // mai sopra barra, pulsanti e card della pagina.
        // gridColumn/gridRow contano solo da computer (griglia lg): la mappa occupa la colonna di sinistra.
        style={{ width: "100%", height: "100%", isolation: "isolate", gridColumn: 1, gridRow: "1 / span 2" }}
        mapStyle={mapVariant === "chiara" ? "mapbox://styles/mapbox/light-v11" : "mapbox://styles/mapbox/streets-v12"}
        // Nomi di città e quartieri in italiano ("Roma", non "Rome"): senza, Mapbox usa l'inglese.
        language="it"
        onLoad={() => {
          mapReadyRef.current = true;
          const pending = pendingFitRef.current;
          if (pending) fitToPlaces(pending.list, pending.top);
        }}
        onStyleData={() => {
          const map = (mapRef.current as { getMap?: () => MapStyleApi } | null)?.getMap?.();
          if (map) hidePoiLabels(map);
        }}
        onClick={() => { setClusterPlaces(null); setFilterError(null); dispatch({ type: "CLOSE" }); }}
      >
        {clusters.map((c) => {
          const [lng, lat] = c.geometry.coordinates;

          if (c.properties.cluster) {
            const clusterId = (c as { id: number }).id;
            const clusterProps = c.properties as { cluster: true; point_count: number };
            return (
              <Marker
                key={`cluster-${clusterId}`}
                longitude={lng}
                latitude={lat}
                anchor="center"
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  const leaves = clusterIndex.getLeaves(clusterId, Infinity);
                  const places = leaves.map(
                    (l) => (l.properties as { placeData: Place }).placeData,
                  );
                  if (places.length === 0) return;
                  setClusterPlaces(places);
                  dispatch({ type: "OPEN_LIST" });
                }}
              >
                <div
                  className="flex items-center justify-center rounded-full bg-brand text-white font-display font-semibold cursor-pointer shadow-float border-2 border-accent"
                  style={{
                    width: `${30 + (clusterProps.point_count / displayedPlaces.length) * 30}px`,
                    height: `${30 + (clusterProps.point_count / displayedPlaces.length) * 30}px`,
                  }}
                >
                  {clusterProps.point_count}
                </div>
              </Marker>
            );
          }

          const place = c.properties.placeData as Place;
          return (
            <Marker
              key={place.id}
              longitude={place.lng}
              latitude={place.lat}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                // Con il carosello aperto il primo tocco porta la card al centro,
                // il secondo apre la scheda.
                // Da computer la lista è sempre a fianco: un clic apre subito la scheda.
                if (carouselOpen && focusId !== place.id && carouselOrder.includes(place.id) && !isDesktop()) {
                  setFocusedId(place.id);
                  return;
                }
                dispatch({ type: "OPEN_VENUE", placeId: place.id });
              }}
              // Tra i primi risultati, il più in alto in lista sta sopra: il suo nome non finisce sotto il
              // pin di uno che viene dopo (visto dal vivo il 14/10). Stesso ordine di labelsToHide.
              style={{ zIndex: focusId === place.id || selected?.id === place.id ? 100 : topPlaces.includes(place) ? 50 - Math.max(0, carouselOrder.indexOf(place.id)) : 1 }}
            >
              {/* Chiuso ora: pin più chiaro (resta toccabile), come la scritta "Chiuso ora" sulla card. */}
              <div
                className={`flex cursor-pointer flex-col items-center transition-opacity ${aiSearch !== null && venueDetails[place.id]?.openNow === false && focusId !== place.id && selected?.id !== place.id ? "opacity-60" : ""}`}
                data-testid="pin"
                data-place={place.id}
                data-focused={focusId === place.id ? "true" : undefined}
                data-closed={aiSearch !== null && venueDetails[place.id]?.openNow === false ? "true" : undefined}
              >
                {pinPhotoIds.has(place.id) && venueDetails[place.id]?.photoRef ? (
                  <span
                    className={`block overflow-hidden rounded-xl border-2 bg-white shadow-float transition-transform ${
                      selected?.id === place.id || focusId === place.id ? "h-14 w-14 scale-110 border-accent" : "h-11 w-11 border-white"
                    }`}
                  >
                    <PlacePhoto
                      photoRef={venueDetails[place.id]?.photoRef}
                      alt={place.name}
                      width={500}
                      className="h-full w-full object-cover"
                      fallback={<span className="flex h-full w-full items-center justify-center text-xl">{getCategoryEmoji(place.category, place.name)}</span>}
                    />
                  </span>
                ) : (
                  <span
                    role="img"
                    aria-label={place.category ?? "locale"}
                    className={`flex items-center justify-center overflow-hidden rounded-full border-2 bg-white text-xl leading-none shadow-float transition-transform ${
                      selected?.id === place.id || focusId === place.id ? "h-12 w-12 scale-110 border-accent" : "h-9 w-9 border-brand"
                    }`}
                  >
                    {/* Pin a fuoco: miniatura della foto della card (stesso indirizzo = già in cache, nessuna chiamata in più). */}
                    {focusId === place.id && aiSearch !== null && carouselOrder.indexOf(place.id) > -1 && carouselOrder.indexOf(place.id) < PHOTO_CARDS && venueDetails[place.id]?.photoRef ? (
                      <PlacePhoto
                        photoRef={venueDetails[place.id]?.photoRef}
                        alt=""
                        width={500}
                        className="h-full w-full rounded-full object-cover"
                        fallback={getCategoryEmoji(place.category, place.name)}
                      />
                    ) : (
                      getCategoryEmoji(place.category, place.name)
                    )}
                  </span>
                )}
                {/* Dopo una ricerca il nome solo sui primi risultati: con 20 etichette si sovrapponevano. */}
                {((aiSearch !== null && clusterPlaces === null ? (topPlaces.includes(place) && !hiddenLabels.has(place.id)) || viewState.zoom >= 16 : aiSearch !== null || viewState.zoom >= 14) || selected?.id === place.id) && (
                  <span className="mt-0.5 max-w-[110px] truncate rounded-pill bg-white/95 px-2 py-0.5 text-[11px] font-display font-semibold text-brand shadow-card">
                    {pinName(place.name)}
                  </span>
                )}
              </div>
            </Marker>
          );
        })}

        {/* I tuoi salvati sempre in vista (?beta=pin-salvati, come Mapstr): piccoli segnalibri anche in Esplora. */}
        {savedPinsOn && view === "all" && (() => {
          const shown = new Set(mapPlaces.map((p) => resolveUuid(p.id) ?? p.id));
          return savedPlaces.filter((p) => !shown.has(p.id)).map((p) => (
            <Marker
              key={`salvato-${p.id}`}
              longitude={p.lng}
              latitude={p.lat}
              anchor="bottom"
              style={{ zIndex: 0 }}
              onClick={(e) => { e.originalEvent.stopPropagation(); setView("saved"); dispatch({ type: "OPEN_VENUE", placeId: p.id }); }}
            >
              <span
                data-testid="pin-salvato"
                aria-label={`${p.name}, tra i tuoi salvati`}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-accent text-white shadow-float"
              >
                <Bookmark size={14} fill="currentColor" aria-hidden />
              </span>
            </Marker>
          ));
        })()}
        {/* Raggio dei Filtri (piano 2.1): cerchio leggero e la sua misura sul bordo, solo con i risultati dei Filtri. */}
        {radiusCircle && (
          <>
            <Source id="raggio" type="geojson" data={circlePolygon(radiusCircle.center, radiusCircle.km * 1000)}>
              <Layer id="raggio-area" type="fill" paint={{ "fill-color": "#1a3c40", "fill-opacity": 0.06 }} />
              <Layer id="raggio-bordo" type="line" paint={{ "line-color": "#1a3c40", "line-width": 1.5, "line-opacity": 0.55, "line-dasharray": [2, 1.5] }} />
            </Source>
            <Marker longitude={radiusCircle.center.lng} latitude={radiusCircle.center.lat + (radiusCircle.km * 1000) / 111_320} anchor="center" style={{ zIndex: 0 }}>
              <span data-testid="raggio-etichetta" className="rounded-pill bg-white/95 px-2 py-0.5 text-[11px] font-display font-semibold text-brand shadow-card">
                {radiusLabel(radiusCircle.km)}
              </span>
            </Marker>
          </>
        )}
        {userPos && (
          <Marker longitude={userPos.lng} latitude={userPos.lat} anchor="center" style={{ zIndex: 0 }}>
            <span data-testid="tu-sei-qui" aria-label="Tu sei qui" className="relative flex h-5 w-5 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-sky-500/40" />
              <span className="h-4 w-4 rounded-full border-2 border-white bg-sky-500 shadow-float" />
            </span>
          </Marker>
        )}
      </Map>

      {selected && (
        // Da computer la scheda si apre nel pannello a destra, al posto della lista (niente velo scuro).
        <div data-testid="scheda-pannello" className="fixed inset-0 z-50 flex flex-col items-center justify-end bg-black/40 lg:static lg:z-auto lg:col-start-2 lg:row-start-2 lg:min-h-0 lg:items-stretch lg:justify-start lg:border-l lg:border-border lg:bg-bg" onClick={() => dispatch({ type: "CLOSE" })}>
          {/* "‹ 2 di 8 ›": si passa al risultato vicino senza tornare alla lista (stesso ordine del carosello). */}
          {(() => {
            const ids = carouselOrder.length > 0 ? carouselOrder : displayedPlaces.map((p) => p.id);
            const i = ids.indexOf(selected.id);
            if (i < 0 || ids.length < 2) return null;
            const go = (j: number) => {
              const id = ids[(j + ids.length) % ids.length];
              const place = displayedPlaces.find((p) => p.id === id);
              if (!place) return;
              setFocusedId(id);
              dispatch({ type: "OPEN_VENUE", placeId: id });
              const map = (mapRef.current as { getMap?: () => { flyTo: (opts: { center: [number, number]; zoom: number }) => void } } | null)?.getMap?.();
              if (map) map.flyTo({ center: [place.lng, place.lat], zoom: Math.max(viewState.zoom, 15) });
            };
            return (
              <div data-testid="scheda-nav" onClick={(e) => e.stopPropagation()} className="mb-2 flex items-center gap-1 rounded-pill bg-surface p-1 shadow-float lg:mx-5 lg:mb-3 lg:self-start lg:shadow-none">
                <button type="button" onClick={() => go(i - 1)} aria-label="Locale precedente" className="flex h-10 w-10 items-center justify-center rounded-full text-lg text-brand active:scale-95">‹</button>
                <span className="min-w-16 text-center text-sm font-display font-semibold text-brand">{i + 1} di {ids.length}</span>
                <button type="button" onClick={() => go(i + 1)} aria-label="Locale successivo" className="flex h-10 w-10 items-center justify-center rounded-full text-lg text-brand active:scale-95">›</button>
              </div>
            );
          })()}
          {/* key: con ‹ › la scheda nuova riparte dall'inizio (foto e nome), non dal punto in cui era scorsa la precedente. */}
          <DragToClose key={selected.id} onClose={() => dispatch({ type: "CLOSE" })} className="w-full max-w-lg max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-card bg-surface shadow-float lg:min-h-0 lg:max-w-none lg:max-h-none lg:flex-1 lg:rounded-none lg:shadow-none">
            <VenueSheet
              key={selected.id}
              origin={userPos ?? searchOrigin}
              googlePlaceId={/^[0-9a-f-]{36}$/i.test(selected.id) ? Object.keys(placeUuids).find((g) => placeUuids[g] === selected.id) ?? null : selected.id}
              venue={{
                id: selected.id, name: selected.name, address: selected.address,
                category: selected.category, rating: selected.rating,
                priceLevel: selected.priceLevel, lat: selected.lat, lng: selected.lng,
                personalTags: selected.tags,
                personalNote: selected.note,
                ...(venueDetails[selected.id] ?? {
                  userRatingCount: null, openNow: null, websiteUri: null, phone: null,
                  selectedReviews: null, synthesis: null, tags: null, verdict: null,
                  goFor: null, dontExpect: null, matchReason: null,
                }),
              }}
              isSaved={isPlaceSaved(selected.id)}
              canEdit={view === "saved"}
              onVisitStatus={(st) => void setVisitStatus(selected.id, st)}
              onOpinion={(op) => void setVisitStatus(selected.id, op, [OPINION_LIKE, OPINION_DISLIKE])}
              verdettoInArrivo={verdettoInCorso === selected.id}
              rankSlot={userId && resolveUuid(selected.id) ? (
                <ClassificaScheda userId={userId} place={{ id: resolveUuid(selected.id)!, name: selected.name, category: selected.category, address: selected.address }} />
              ) : null}
              // Id UUID = locale già nel database (es. salvati ancora in caricamento): niente salvataggio
              // rapido, eviterebbe un doppione in places.
              onQuickSave={/^[0-9a-f-]{36}$/i.test(selected.id) ? undefined : (st) => {
                if (!userId) { askLoginToSave(selected, [st]); return; }
                setPendingSaveTags([st]);
                setPendingSavePlaceId(selected.id);
              }}
              onEdit={() => setPendingEditPlace(selected)}
              onClose={() => dispatch({ type: "CLOSE" })}
              userPos={userPos}
              saveSlot={
                <SaveButton
                  placeId={resolveUuid(selected.id) ?? selected.id}
                  googlePlaceId={selected.id}
                  userId={userId}
                  isSaved={isPlaceSaved(selected.id)}
                  onToggle={handleToggle}
                  onSaveRequest={(googlePlaceId) => setPendingSavePlaceId(googlePlaceId)}
                  onLoginRequest={/^[0-9a-f-]{36}$/i.test(selected.id) ? undefined : () => askLoginToSave(selected)}
                />
              }
              communitySlot={
                <CommunityLocale
                  id={resolveUuid(selected.id) ?? selected.id}
                  userId={userId}
                  contesto="mappa"
                  voto={votoOf(selected.tags)}
                />
              }
            />
          </DragToClose>
        </div>
      )}

      {(() => {
        const pendingPlace = pendingSavePlaceId
          ? (places.find(p => p.id === pendingSavePlaceId) ?? aiSearch?.risultati.find(p => p.id === pendingSavePlaceId) ?? null)
          : null;
        return pendingPlace && userId ? (
          <SaveModal
            place={pendingPlace}
            initialTags={pendingSaveTags}
            knownTags={availableTags}
            reviewCount={venueDetails[pendingPlace.id]?.userRatingCount ?? null}
            // Solo se la card aveva già la foto (stesso indirizzo, già in cache): nessuna foto in più.
            photoRef={carouselOrder.indexOf(pendingPlace.id) > -1 && carouselOrder.indexOf(pendingPlace.id) < PHOTO_CARDS ? venueDetails[pendingPlace.id]?.photoRef ?? null : null}
            userId={userId}
            onSaved={(tags, note, uuid) => {
              track("salva", { id: uuid ?? pendingPlace.id, lat: pendingPlace.lat, lng: pendingPlace.lng }, { fonte: "finestra", ...((tags ?? []).includes(VISIT_DONE) ? { stato: VISIT_DONE } : (tags ?? []).includes(VISIT_WANT) ? { stato: VISIT_WANT } : {}) });
              // Mai i nomi delle raccolte: sono testo scritto dall'utente ("Cena con Giulia").
              if (uuid) {
                setPlaceUuids((prev) => ({ ...prev, [pendingPlace.id]: uuid }));
                setSavedIds((prev) => new Set(prev).add(uuid));
              }
              setSavedPlaces(prev => [
                ...prev.filter(p => p.id !== uuid),
                { ...pendingPlace, id: uuid ?? pendingPlace.id, tags, note },
              ]);
              setPendingSavePlaceId(null);
              setPendingSaveTags([]);
            }}
            onCancel={() => { setPendingSavePlaceId(null); setPendingSaveTags([]); }}
          />
        ) : null;
      })()}

      {pendingEditPlace && userId && (
        <SaveModal
          place={pendingEditPlace}
          knownTags={availableTags}
          userId={userId}
          mode="edit"
          initialTags={pendingEditPlace.tags ?? []}
          initialNote={pendingEditPlace.note ?? ""}
          onSaved={(tags, note) => {
            const updated = { ...pendingEditPlace, tags, note };
            setSavedPlaces((prev) =>
              prev.map((p) => (p.id === pendingEditPlace.id ? updated : p))
            );
            setPendingEditPlace(null);
          }}
          onCancel={() => setPendingEditPlace(null)}
        />
      )}

      {/* Con la scheda aperta l'avviso sale sopra la barra Salva/Percorso/Chiama/Sito (prima la copriva). */}
      {nearbySaved && !savedToast && !selected && (
        <div className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-3 lg:right-[var(--pannello)]" style={{ bottom: "calc(var(--nav-height-mobile) + var(--nav-sporgenza) + 0.5rem)" }}>
          <div role="status" data-testid="vicino-salvato" className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-card bg-brand px-4 py-2.5 text-white shadow-float">
            <span className="min-w-0 flex-1 text-sm font-sans">
              <span className="font-semibold">📌 A {distanceLabel(userPos ?? nearbySaved.place, nearbySaved.place)}</span> c&apos;è {nearbySaved.place.name}, che volevi provare
            </span>
            <button
              type="button"
              onClick={() => { dispatch({ type: "OPEN_VENUE", placeId: nearbySaved.place.id }); setNearbySaved(null); }}
              className="min-h-10 shrink-0 rounded-pill bg-accent px-4 text-sm font-display font-semibold active:scale-95"
            >
              Apri
            </button>
          </div>
        </div>
      )}
      {savedToast && (
        <div className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-3 lg:right-[var(--pannello)]" style={{ bottom: selected ? "calc(var(--nav-height-mobile) + 5.75rem)" : "calc(var(--nav-height-mobile) + var(--nav-sporgenza) + 0.5rem)" }}>
          <div role="status" data-testid="salvato-avviso" className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-card bg-brand px-4 py-2.5 text-white shadow-float">
            <span className="min-w-0 flex-1 truncate text-sm font-sans">
              <span className="font-semibold">📌 Salvato</span> · {savedToast.name}
            </span>
            <button
              type="button"
              onClick={() => { setPendingEditPlace(savedToast); setSavedToast(null); }}
              className="min-h-10 shrink-0 rounded-pill bg-white/15 px-3 text-sm font-display font-semibold active:scale-95"
            >
              Aggiungi nota
            </button>
          </div>
        </div>
      )}

      {/* Ricerca in corso senza card iniziale (link ?q=, home): card fantasma come Places, la mappa non resta muta. */}
      {aiSearching && aiSearch === null && welcomeHidden && overlay.kind === "none" && (
        <div data-testid="ricerca-in-corso" className="pointer-events-none absolute left-0 right-0 z-10 lg:static lg:col-start-2 lg:row-start-2 lg:min-h-0 lg:overflow-hidden lg:border-l lg:border-border" style={{ bottom: "var(--nav-height-mobile)" }}>
          <div className="mx-3 mb-2 w-fit max-w-[calc(100%-1.5rem)] rounded-card bg-surface px-4 py-2 shadow-float lg:mx-5 lg:shadow-none">
            <p className="truncate font-title text-base font-semibold text-brand first-letter:uppercase">{aiQuery}</p>
            <p className="flex items-center gap-2 text-xs font-sans text-text-muted">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-border border-t-accent" />
              Cerco i posti giusti…
            </p>
          </div>
          <div className="flex gap-3 overflow-hidden px-3 pb-3 lg:flex-col lg:px-5">
            {[0, 1].map((i) => (
              <div key={i} className="h-[190px] w-[78vw] max-w-sm shrink-0 animate-pulse rounded-card bg-brand/80 p-4 shadow-float lg:w-auto lg:max-w-none">
                <div className="h-7 w-7 rounded-full bg-white/20" />
                <div className="mt-4 h-5 w-2/3 rounded bg-white/25" />
                <div className="mt-2 h-3 w-1/3 rounded bg-white/15" />
                <div className="mt-4 h-3 w-5/6 rounded bg-white/15" />
              </div>
            ))}
          </div>
        </div>
      )}

      {filterLoading && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center pt-24 lg:right-[var(--pannello)] lg:pt-20">
          <div className="pointer-events-auto flex items-center gap-2 rounded-pill bg-surface px-4 py-2 shadow-float">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-border border-t-accent" />
            <span className="text-sm font-sans text-text">Sto cercando…</span>
          </div>
        </div>
      )}

      {filterError && (
        <div className="absolute inset-x-0 top-0 z-20 flex justify-center pt-24 lg:right-[var(--pannello)] lg:pt-20">
          <button
            type="button"
            onClick={() => setFilterError(null)}
            className="rounded-pill bg-surface px-4 py-2 text-sm font-sans text-text shadow-float"
          >
            {filterError} ✕
          </button>
        </div>
      )}

      {overlay.kind === "list" && (
        <BottomSheet
          places={clusterPlaces ?? displayedPlaces}
          // Nei salvati: il verdetto già in cache (place_synthesis), letto all'avvio senza costi.
          details={aiSearch !== null || view === "saved" ? venueDetails : undefined}
          savedMode={view === "saved" && aiSearch === null}
          showCity={view === "saved" && aiSearch === null && activeCity === null}
          loadingVerdicts={aiSearch !== null && loadingVerdicts}
          variant={listVariant}
          // Nei salvati "Più vicini" ha senso solo dalla posizione vera, non dal punto dell'ultima ricerca.
          origin={view === "saved" ? userPos : userPos ?? searchOrigin}
          // Nei salvati l'ordine si sceglie nel foglio "Filtri" (niente riga di chip in più).
          nearest={view === "saved" && aiSearch === null ? savedNearestOn : undefined}
          quick={quickFilters}
          title={aiSearch !== null && view === "all" ? aiSearch.query ?? null : null}
          heading={view === "saved" && aiSearch === null
            ? `I tuoi salvati${activeCity ? ` · ${activeCity}` : ""}`
            : aiSearch !== null && aiSearch.query == null && countActive(filters) > 0 ? `Filtri: ${filtersSummary(filters)}` : null}
          focusedId={focusId}
          understood={aiSearch?.filtri ? filtriParts(aiSearch.filtri).slice(0, 4) : []}
          setAside={aiSearch?.daParte ?? null}
          onOrder={setCarouselOrder}
          onRefine={() => { dispatch({ type: "OPEN_AI" }); if (barOn) barInputRef.current?.focus(); }}
          showSearchFeedback={clusterPlaces === null}
          onShareList={shareOn && view === "saved" && aiSearch === null ? async (list) => {
            // Come la mappa condivisibile di Mapstr, ma senza dati pubblici: un messaggio con i link.
            const lines = list.slice(0, 30).map((p) => {
              const gid = Object.keys(placeUuids).find((g) => placeUuids[g] === p.id);
              const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}${gid ? `&query_place_id=${encodeURIComponent(gid)}` : ""}`;
              // La nota è privata ("solo per te"): non finisce nel messaggio.
              return `• ${p.name}\n  ${url}`;
            });
            const text = `I miei posti su Mapetite${activeCity ? ` · ${activeCity}` : ""}:\n\n${lines.join("\n")}`;
            try {
              if (typeof navigator.share === "function") { await navigator.share({ title: "I miei posti su Mapetite", text }); return "shared"; }
              await navigator.clipboard.writeText(text);
              return "copied";
            } catch {
              return null; // foglio di condivisione chiuso
            }
          } : undefined}
          onOpenArticle={articleOn && aiSearch !== null && view === "all" && clusterPlaces === null ? () => setArticleOpen(true) : undefined}
          isSaved={isPlaceSaved}
          similarTo={aiSearch !== null && view === "all" && savedPlaces.length > 0 ? (id) => {
            if (isPlaceSaved(id)) return null;
            const place = displayedPlaces.find((p) => p.id === id);
            return place ? similarSaved(place, savedPlaces) : null;
          } : undefined}
          savedLabel={(id) => {
            const uuid = resolveUuid(id);
            const tags = uuid ? savedPlaces.find((p) => p.id === uuid)?.tags : null;
            if (!uuid || !savedIds.has(uuid)) return null;
            return tags?.includes(VISIT_DONE) ? "✓ Ci sono stato" : tags?.includes(VISIT_WANT) ? "📌 Voglio andarci" : "📌 Salvato";
          }}
          // Già salvato: la scheda permette di modificarlo o rimuoverlo (vedi quickSave).
          onSave={aiSearch !== null && view === "all" ? (place) => { void quickSave(place); } : undefined}
          onFocus={(place) => { setFocusedId(place.id); panIntoView(place); }}
          // Da computer: il mouse su una card accende il suo pin, senza spostare la mappa.
          onHover={(place) => setFocusedId(place.id)}
          shareAt={searchOrigin ?? { lat: viewState.latitude, lng: viewState.longitude }}
          onToggleQuick={(f) => setQuickFilters((prev) => {
            const next = new Set(prev);
            if (next.has(f)) next.delete(f);
            else next.add(f);
            return next;
          })}
          onSelect={(place) => {
            viewBeforeVenue.current = { latitude: viewState.latitude, longitude: viewState.longitude, zoom: viewState.zoom };
            dispatch({ type: "OPEN_VENUE", placeId: place.id });
            const map = (mapRef.current as { getMap?: () => { flyTo: (opts: { center: [number, number]; zoom: number }) => void } } | null)?.getMap?.();
            if (map) map.flyTo({ center: [place.lng, place.lat], zoom: Math.max(viewState.zoom, 17) });
          }}
          onClose={() => { setClusterPlaces(null); setFilterError(null); clearAiSearch(); setAiQuery(""); dispatch({ type: "RESET" }); }}
        />
      )}

      {articleOpen && articleOn && aiSearch !== null && view === "all" && (
        <AnswerArticle
          title={aiSearch.query ?? aiQuery}
          understood={aiSearch.filtri ? filtriParts(aiSearch.filtri).slice(0, 4) : []}
          places={(() => {
            // Stesso ordine e stessi filtri rapidi del carosello.
            const byId = new globalThis.Map(displayedPlaces.map((p) => [p.id, p]));
            const ordered = carouselOrder.map((id) => byId.get(id)).filter((p): p is Place => p != null);
            return ordered.length > 0 || quickFilters.size > 0 ? ordered : displayedPlaces;
          })()}
          details={venueDetails}
          loadingVerdicts={loadingVerdicts}
          origin={userPos ?? searchOrigin}
          isSaved={isPlaceSaved}
          onSave={(place) => { void quickSave(place); }}
          onSelect={(place) => dispatch({ type: "OPEN_VENUE", placeId: place.id })}
          onAsk={(q) => { setArticleOpen(false); setAiQuery(q); void runAISearch(q); }}
          shareAt={searchOrigin ?? { lat: viewState.latitude, lng: viewState.longitude }}
          onClose={() => setArticleOpen(false)}
        />
      )}

      {/* Foglio "Filtri" dei salvati: tutto ciò che prima erano tre righe di chip sempre in vista. */}
      {savedSheetOpen && savedControlsOn && (
          <div data-testid="salvati-foglio" className="fixed inset-x-0 top-0 z-50 flex items-end justify-center bg-black/40" style={{ bottom: "var(--nav-height-mobile)" }} onClick={() => setSavedSheetOpen(false)}>
            <div role="dialog" aria-label="Filtri dei salvati" onClick={(e) => e.stopPropagation()} className="max-h-full w-full max-w-md overflow-y-auto rounded-t-card bg-surface px-4 pb-4 pt-3 shadow-float">
              <div className="flex items-center justify-between">
                <p className="font-title text-lg font-semibold text-brand">Filtra i salvati</p>
                <button type="button" aria-label="Chiudi i filtri" onClick={() => setSavedSheetOpen(false)} className="flex h-10 w-10 items-center justify-center text-text-muted"><X size={20} aria-hidden /></button>
              </div>
              <p className="mb-1.5 mt-1 text-xs font-display font-semibold uppercase tracking-wide text-text-muted">Stato</p>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" aria-pressed={activeTag !== VISIT_WANT && activeTag !== VISIT_DONE} onClick={() => pickTag(null)} className={sheetChip(activeTag !== VISIT_WANT && activeTag !== VISIT_DONE)}>Tutti · {savedPlaces.length}</button>
                {[VISIT_WANT, VISIT_DONE].map((t) => (
                  <button key={t} type="button" aria-pressed={activeTag === t} onClick={() => pickTag(activeTag === t ? null : t)} className={sheetChip(activeTag === t)}>
                    {tagLabel(t)} · {countTag(t)}
                  </button>
                ))}
              </div>
              {availableCities.length > 1 && (
                <>
                  <p className={sheetSection}>Città</p>
                  <div className="flex flex-wrap gap-1.5">
                    {availableCities.map(({ city, count }) => (
                      <button
                        key={`c-${city}`}
                        type="button"
                        aria-pressed={activeCity === city}
                        onClick={() => {
                          const next = activeCity === city ? null : city;
                          setActiveCity(next); clearAiSearch(); setClusterPlaces(null); setFilterError(null);
                          fitToPlaces(filterSaved(savedPlaces, activeTag, next, savedQuery), 150);
                        }}
                        className={sheetChip(activeCity === city)}
                      >
                        📍 {city} · {count}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {sheetCollections.length > 0 && (
                <>
                  <p className={sheetSection}>Raccolte</p>
                  <div className="flex flex-wrap gap-1.5">
                    {sheetCollections.map((tag) => (
                      <button key={tag} type="button" aria-pressed={activeTag === tag} onClick={() => pickTag(activeTag === tag ? null : tag)} className={sheetChip(activeTag === tag)}>
                        {tagLabel(tag)} · {countTag(tag)}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <p className={sheetSection}>Ordine</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <button type="button" aria-pressed={!savedNearestOn} onClick={() => setSavedNearest(false)} className={sheetChip(!savedNearestOn)}>Ultimi salvati</button>
                {userPos ? (
                  <button type="button" aria-pressed={savedNearestOn} onClick={() => setSavedNearest((v) => !v)} className={sheetChip(savedNearestOn)}>Più vicini</button>
                ) : (
                  <span className="text-xs font-sans text-text-muted">Per ordinarli per distanza tocca <LocateFixed size={12} className="inline" aria-hidden /> in alto</span>
                )}
              </div>
              <button
                type="button"
                data-testid="salvati-tipo"
                onClick={() => { setSavedSheetOpen(false); clearAiSearch(); setAiQuery(""); setAiError(null); dispatch({ type: "OPEN_FILTERS" }); }}
                className="mt-4 flex min-h-11 w-full items-center justify-between rounded-btn border border-border px-3 text-sm font-display font-semibold text-brand active:scale-[0.99]"
              >
                Tipo di locale, voto e prezzo <ChevronRight size={16} aria-hidden />
              </button>
              {/* "Non so dove andare": sceglie a caso tra i salvati mostrati, prima quelli "Voglio andarci". */}
              {pickOn && sheetShown.length >= 2 && (
                <button
                  type="button"
                  data-testid="scegli-tu"
                  onClick={() => {
                    trackFeature("sorprendimi");
                    setSavedSheetOpen(false);
                    const want = sheetShown.filter((p) => p.tags?.includes(VISIT_WANT));
                    const pool = (want.length > 0 ? want : sheetShown).filter((p) => p.id !== selected?.id);
                    const place = pool[Math.floor(Math.random() * pool.length)] ?? sheetShown[0];
                    setFocusedId(place.id);
                    dispatch({ type: "OPEN_VENUE", placeId: place.id });
                    const map = (mapRef.current as { getMap?: () => { flyTo: (opts: { center: [number, number]; zoom: number }) => void } } | null)?.getMap?.();
                    if (map) map.flyTo({ center: [place.lng, place.lat], zoom: Math.max(viewState.zoom, 15) });
                  }}
                  className="mt-2 flex min-h-11 w-full items-center justify-between rounded-btn border border-border px-3 text-sm font-display font-semibold text-accent active:scale-[0.99]"
                >
                  🎲 Non sai scegliere? Scegli tu <ChevronRight size={16} aria-hidden />
                </button>
              )}
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => { setActiveTag(null); setActiveCity(null); setSavedQuery(""); setSavedNearest(false); clearAiSearch(); setClusterPlaces(null); setFilterError(null); }}
                  className="min-h-11 rounded-btn border border-border px-4 text-sm font-display font-semibold text-text"
                >
                  Azzera filtri
                </button>
                <button type="button" data-testid="salvati-mostra" onClick={() => setSavedSheetOpen(false)} className="min-h-11 flex-1 rounded-btn bg-brand px-4 text-sm font-display font-semibold text-white active:scale-[0.99]">
                  {sheetShown.length === 0 ? "Nessun posto" : `Mostra ${sheetShown.length} ${sheetShown.length === 1 ? "posto" : "posti"}`}
                </button>
              </div>
            </div>
          </div>
      )}

      <FiltersSheet
        isOpen={overlay.kind === "filters"}
        filters={filters}
        onClose={() => dispatch({ type: "CLOSE" })}
        onApply={(f) => { setClusterPlaces(null); setFilterError(null); setFilters(f); void runFilteredSearch(f); }}
        city={cityNear(viewState.latitude, viewState.longitude)}
      />
    </div>
  );
}
