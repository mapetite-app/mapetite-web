"use client";

import { useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Map, { Marker } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import Supercluster from "supercluster";
import { createClient } from "@/lib/supabase/client";
import { getCategoryEmoji } from "@/lib/emoji";
import FiltersSheet, { type Filters, EMPTY_FILTERS, countActive } from "@/components/filters-sheet";
import VenueSheet from "@/components/venue-sheet";
import AnswerArticle from "@/components/answer-article";
import BottomSheet, { applyQuickFilters, PHOTO_CARDS, type QuickFilter } from "@/components/bottom-sheet";
import PlacePhoto from "@/components/place-photo";
import InstallHint from "@/components/install-hint";
import DragToClose from "@/components/drag-to-close";
import { ArrowUp, LocateFixed, SlidersHorizontal, Sparkles } from "lucide-react";
import { loadRecentSearches, saveRecentSearch, useBeta, useOptIn, useVariant } from "@/lib/beta";
import { cityFromAddress } from "@/lib/city";
import { categoryLabel } from "@/lib/category-label";
import { momentSuggestion } from "@/lib/moment";
import { tasteQuery } from "@/lib/preferences";
import { overlayReducer, type Overlay, type OverlayAction } from "@/lib/panel-state";

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
}: {
  place: Place;
  userId: string;
  mode?: "save" | "edit";
  initialTags?: string[];
  initialNote?: string;
  onSaved: (tags: string[] | null, note: string | null, uuid?: string) => void;
  onCancel: () => void;
}) {
  const [selectedTags, setSelectedTags] = useState<string[]>(initialTags);
  const [note, setNote] = useState(initialNote);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSave = () => {
    setError(false);
    startTransition(async () => {
      const supabase = createClient();
      const tags = selectedTags.length > 0 ? selectedTags : null;
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
        if (error && error.code !== "23505") { setError(true); return; }
      }

      onSaved(tags, noteValue, savedUuid);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-80 max-w-[90vw] rounded-card bg-surface p-5 shadow-float">
        <h2 className="mb-3 text-base font-display font-semibold text-text">
          {mode === "edit" ? "Modifica locale" : "Salva locale"}
        </h2>

        <p className="mb-2 text-xs font-sans text-text-muted">Tag</p>
        <div className="mb-4 flex flex-wrap gap-2">
          {PRESET_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={
                selectedTags.includes(tag)
                  ? "rounded-pill bg-brand px-3 py-1 text-xs font-display font-semibold text-white"
                  : "rounded-pill bg-accent-light px-3 py-1 text-xs font-display font-semibold text-accent hover:opacity-80"
              }
            >
              {tag}
            </button>
          ))}
        </div>

        <p className="mb-1 text-xs font-sans text-text-muted">Nota personale</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Aggiungi una nota..."
          rows={3}
          className="w-full resize-none rounded-btn border border-border px-3 py-2 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-brand"
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
            className="flex-1 rounded-btn bg-brand px-3 py-2 text-sm font-display font-semibold text-white hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "..." : "Salva"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 rounded-btn border border-border bg-surface px-3 py-2 text-sm font-display font-semibold text-text-muted hover:text-text disabled:opacity-60"
          >
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
}

type ReviewItem = {
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          aria-label={`${star} stelle`}
          className="text-xl leading-none focus:outline-none"
        >
          <span className={(hovered || value) >= star ? "text-star" : "text-border"}>
            ★
          </span>
        </button>
      ))}
    </div>
  );
}

function ReviewForm({
  placeId,
  userId,
  existing,
  onSaved,
}: {
  placeId: string;
  userId: string;
  existing: ReviewItem | null;
  onSaved: (items: ReviewItem[]) => void;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setStatus("error");
      setErrorMsg("Seleziona almeno una stella.");
      return;
    }
    setStatus("saving");
    setErrorMsg("");

    const supabase = createClient();
    const { error } = await supabase.from("reviews").upsert(
      { place_id: placeId, user_id: userId, rating, comment: comment.trim() || null },
      { onConflict: "user_id,place_id" }
    );

    if (error) {
      setStatus("error");
      setErrorMsg("Salvataggio non riuscito. Riprova.");
      return;
    }

    const { data } = await supabase
      .from("reviews")
      .select("user_id, rating, comment, created_at")
      .eq("place_id", placeId)
      .order("created_at", { ascending: false });

    setStatus("done");
    onSaved((data ?? []) as ReviewItem[]);
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2 border-t border-border pt-3">
      <p className="text-xs font-display font-semibold uppercase tracking-wide text-text-muted">
        {existing ? "Modifica la tua recensione" : "Lascia una recensione"}
      </p>
      <StarPicker value={rating} onChange={(v) => { setRating(v); setStatus("idle"); }} />
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Commento (opzionale)"
        rows={2}
        className="w-full resize-none rounded-btn border border-border px-2 py-1.5 text-xs font-sans focus:outline-none focus:ring-1 focus:ring-brand"
      />
      {status === "error" && (
        <p className="text-xs text-error">{errorMsg}</p>
      )}
      {status === "done" && (
        <p className="text-xs text-success">Recensione pubblicata ✓</p>
      )}
      <button
        type="submit"
        disabled={status === "saving"}
        className="rounded-btn bg-brand px-3 py-1.5 text-xs font-display font-semibold text-white hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "saving" ? "..." : existing ? "Aggiorna" : "Pubblica recensione"}
      </button>
    </form>
  );
}

const OTHER_CITY = "Altre zone";
const CHIP_ON = "rounded-pill bg-brand px-3 py-1.5 text-xs font-display font-semibold text-white";
const CHIP_OFF = "rounded-pill bg-accent-light px-3 py-1.5 text-xs font-display font-semibold text-accent hover:opacity-80";
const CHIP_CITY = "rounded-pill border border-border bg-white px-3 py-1.5 text-xs font-display font-semibold text-brand hover:opacity-80";

// Salvati filtrati per tag, città e testo (nome, categoria, indirizzo, nota, tag).
function filterSaved(list: Place[], tag: string | null, city: string | null, query: string): Place[] {
  const q = query.trim().toLocaleLowerCase("it");
  return list.filter((p) => {
    if (tag !== null && !p.tags?.includes(tag)) return false;
    if (city !== null && (cityFromAddress(p.address) ?? OTHER_CITY) !== city) return false;
    if (!q) return true;
    return [p.name, p.category, p.address, p.note, ...(p.tags ?? [])]
      .some((v) => v != null && v.toLocaleLowerCase("it").includes(q));
  });
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
}: {
  placeId: string;        // UUID canonico Supabase: usato per delete e onToggle
  googlePlaceId: string;  // ID Google: usato per il salvataggio (/api/places/add)
  userId: string | null;
  isSaved: boolean;
  onToggle: (placeId: string, saved: boolean) => void;
  onSaveRequest: (googlePlaceId: string) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  const handleClick = () => {
    if (!userId) {
      router.push("/login");
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
      const supabase = createClient();
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
type PendingSynthesis = { places: unknown[]; token: string };

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
}) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    onSubmit(query.trim());
  };

  return (
    <div className="rounded-card bg-surface p-3 shadow-float">
      <form onSubmit={handleSubmit} className="flex gap-2">
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
      </form>

      {isSearching && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-text-muted">
          <span className="inline-block h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-border border-t-brand" />
          Sto cercando…
        </p>
      )}

      {error && <p className="mt-2 text-sm text-error">{error}</p>}

      {/* Aggiunte rapide: con una ricerca attiva affinano la frase, altrimenti sono esempi. */}
      {!isSearching && (
        <div className="-mx-3 mt-2 flex gap-1.5 overflow-x-auto px-3 [scrollbar-width:none]" data-testid="aggiunte-rapide">
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
  const [viewState, setViewState] = useState({ longitude: 12.4964, latitude: 41.9028, zoom: 11 });
  const mapRef = useRef(null);
  const [pendingSavePlaceId, setPendingSavePlaceId] = useState<string | null>(null);
  const [pendingEditPlace, setPendingEditPlace] = useState<Place | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  // Salvati (voce 8): ricerca per testo e filtro per città ricavata dall'indirizzo.
  const [savedQuery, setSavedQuery] = useState("");
  const [activeCity, setActiveCity] = useState<string | null>(null);
  // Suggerimento "Per te" nella card iniziale, dai gusti indicati nell'onboarding.
  const [tasteSuggestion, setTasteSuggestion] = useState<string | null>(null);
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    createClient()
      .from("profiles")
      .select("cuisines, occasions, atmospheres, price_range")
      .eq("id", userId)
      .maybeSingle()
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
  const [aiSearch, setAiSearch] = useState<{ risultati: Place[]; filtri: AIFiltri | null; id?: number; query?: string } | null>(null);
  // true mentre arriva il secondo tempo della ricerca (verdetti, esclusioni).
  const [loadingVerdicts, setLoadingVerdicts] = useState(false);
  const searchSeq = useRef(0);
  // Filtri rapidi della lista: valgono anche per i pin sulla mappa.
  const [quickFilters, setQuickFilters] = useState<Set<QuickFilter>>(new Set());
  // true quando l'utente sposta la mappa a mano dopo una ricerca → "Cerca in quest'area".
  const [movedSinceSearch, setMovedSinceSearch] = useState(false);
  // Variante della mappa da far scegliere: ?mappa=chiara (grigia stile Places), resta sul telefono.
  const mapVariant = useSyncExternalStore(
    () => () => {},
    () => {
      const v = new URLSearchParams(window.location.search).get("mappa");
      try {
        if (v === "chiara" || v === "standard") window.localStorage.setItem("mapetite.mappa", v);
        return window.localStorage.getItem("mapetite.mappa") ?? "standard";
      } catch {
        return v ?? "standard";
      }
    },
    () => "standard",
  );
  // Variante grafica della lista risultati (voce 5): scelta di Lorenzo 11/10 = B
  // (carosello). ?lista=a riporta la variante A finché non la si rimuove.
  const listVariant = useSyncExternalStore(
    () => () => {},
    () => (new URLSearchParams(window.location.search).get("lista") === "a" ? "a" : "b"),
    () => "b" as const,
  );
  // Suggerimento legato all'ora del telefono: solo sul client (sul server l'ora non è quella dell'utente).
  const momentExample = useSyncExternalStore(
    () => () => {},
    () => momentSuggestion(new Date()),
    () => null,
  );
  // Testo della ricerca AI: vive qui perché il pannello si smonta alla chiusura.
  const [aiQuery, setAiQuery] = useState("");
  const [aiSearching, setAiSearching] = useState(false);
  // Schermata di benvenuto: sparisce alla prima interazione.
  const recentOn = useBeta("recenti");
  // Risposta "come un articolo" (?beta=articolo, spenta di default).
  const articleOn = useOptIn("articolo");
  const [articleOpen, setArticleOpen] = useState(false);
  const recentSearches = useSyncExternalStore(
    () => () => {},
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
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [searchOrigin, setSearchOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [geoState, setGeoState] = useState<"idle" | "loading" | "denied" | "unavailable">("idle");
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
  const [selectedReviews, setSelectedReviews] = useState<{
    avg: number;
    count: number;
    items: ReviewItem[];
  } | null>(null);

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

  const savedFiltered = activeTag !== null || activeCity !== null || savedQuery.trim() !== "";

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

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();
    supabase
      .from("saved_places")
      .select("place_id")
      .eq("user_id", userId)
      .then(({ data, error }) => {
        if (error) {
          console.error("Errore nel caricamento dei locali salvati:", error);
          return;
        }
        setSavedIds(new Set((data ?? []).map((row) => row.place_id as string)));
      });
  }, [userId]);

  useEffect(() => {
    if (!selected) {
      setSelectedReviews(null);
      return;
    }
    const uuid = resolveUuid(selected.id);
    if (!uuid) {
      setSelectedReviews(null);
      return;
    }
    const supabase = createClient();
    supabase
      .from("reviews")
      .select("user_id, rating, comment, created_at")
      .eq("place_id", uuid)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!data || data.length === 0) {
          setSelectedReviews(null);
          return;
        }
        const avg =
          data.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) /
          data.length;
        setSelectedReviews({
          avg,
          count: data.length,
          items: data as ReviewItem[],
        });
      });
  }, [selected?.id, placeUuids]);

  useEffect(() => {
    if (!userId) return;

    setLoadingSaved(true);
    const supabase = createClient();

    (async () => {
      const { data, error } = await supabase
        .from("saved_places")
        .select("tags, note, places(id, name, category, address, lat, lng, google_place_id, rating, price_level)")
        .eq("user_id", userId);

      setLoadingSaved(false);
      if (error) {
        console.error("Errore nel caricamento dei locali salvati:", error);
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
        setVenueDetails((prev) => ({ ...prev, ...savedDetails }));
      }
    })();
  }, [userId]);

  const handleToggle = (placeId: string, saved: boolean) => {
    const uuid = resolveUuid(placeId);
    if (!uuid) return; // senza UUID non c'e' nulla da tracciare
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (saved) next.add(uuid); else next.delete(uuid);
      return next;
    });
    if (!saved) {
      setSavedPlaces((prev) => prev.filter((p) => p.id !== uuid));
      if (view === "saved") dispatch({ type: "CLOSE" });
    }
  };

  // Stato del salvato come in Places ("Voglio andarci" / "Ci sono stato"): usa i tag già
  // esistenti "Da provare" / "Già visitato", uno esclude l'altro; ritoccarlo lo toglie.
  const visitBusy = useRef(false);
  const setVisitStatus = async (placeId: string, status: VisitStatus) => {
    const uuid = resolveUuid(placeId);
    if (!userId || !uuid || visitBusy.current) return;
    visitBusy.current = true;
    try {
      const supabase = createClient();
      // Tag attuali: dalla lista dei salvati, o dal database se lì non c'è (mai scrivere alla cieca).
      let currentTags = savedPlaces.find((p) => p.id === uuid)?.tags ?? null;
      if (currentTags === null) {
        const { data, error } = await supabase
          .from("saved_places").select("tags").eq("user_id", userId).eq("place_id", uuid).maybeSingle();
        if (error || !data) { setFilterError("Non sono riuscito a salvare: riprova."); return; }
        currentTags = (data.tags as string[] | null) ?? [];
      }
      const base = currentTags.filter((t) => t !== VISIT_WANT && t !== VISIT_DONE);
      const tags = currentTags.includes(status) ? base : [...base, status];
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

  const runFilteredSearch = async (f: Filters) => {
    if (view === "saved") {
      const allowed = f.categories;
      const filtered = allowed.length > 0
        ? savedPlaces.filter((p) => {
            const cat = (p.category ?? "").toLowerCase();
            return allowed.some((c) => cat.includes(c));
          })
        : savedPlaces;
      setAiSearch({ risultati: filtered, filtri: null });
      dispatch({ type: "OPEN_LIST" });
      return;
    }

    let query: string;
    if (f.categories.length > 0) {
      query = f.categories.map((c) => CATEGORY_QUERY[c] ?? c).join(" ");
    } else {
      query = "ristoranti bar locali";
    }

    setFilterError(null);
    setFilterLoading(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          source: "world",
          searchIntent: "structured",
          lat: viewState.latitude,
          lng: viewState.longitude,
          ...(f.minRating != null && { minRating: f.minRating }),
          ...(f.minReviews != null && { minReviews: f.minReviews }),
          ...(f.minPriceLevel != null && { minPriceLevel: f.minPriceLevel }),
          ...(f.maxPriceLevel != null && { maxPriceLevel: f.maxPriceLevel }),
          ...(f.openNowOnly && { openNowOnly: true }),
          ...(f.radiusKm != null && { radius: f.radiusKm * 1000 }),
          ...(f.categories.length > 0 && { categories: f.categories }),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setFilterError("Ricerca non riuscita. Riprova."); return; }
      type RawPlace = {
        id: string; name: string; category: string | null; lat: number | null; lng: number | null;
        rating: number | null; priceLevel: number | null; address: string | null;
        userRatingCount: number | null; openNow: boolean | null; websiteUri: string | null; phone: string | null;
        selectedReviews: { text: string }[] | null; synthesis: string | null; tags: string[] | null; verdict: string | null;
        goFor: string[] | null; dontExpect: string[] | null; matchReason: string | null; photoRef?: string | null; photoAuthor?: string | null;
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
        };
      }
      setAiSearch({ risultati: places, filtri: data.filtri_usati ?? null });
      setVenueDetails(details);
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

  const clusterIndex = useMemo(() => {
    const points = mapPlaces.map((place) => ({
      type: "Feature" as const,
      properties: { cluster: false, placeData: place },
      geometry: { type: "Point" as const, coordinates: [place.lng, place.lat] },
    }));
    const index = new Supercluster({ radius: 50, maxZoom: 20 });
    index.load(points);
    return index;
  }, [mapPlaces]);

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
    return clusterIndex.getClusters(bbox, roundedZoom);
  }, [clusterIndex, roundedZoom, viewState.longitude, viewState.latitude, mapPlaces]);

  // Porta il pin nella parte di mappa visibile sopra il carosello, solo se è fuori.
  const panIntoView = (place: Place) => {
    const map = (mapRef.current as { getMap?: () => { project: (ll: [number, number]) => { x: number; y: number }; easeTo: (o: object) => void } } | null)?.getMap?.();
    if (!map || typeof window === "undefined") return;
    const { innerWidth: w, innerHeight: h } = window;
    const pt = map.project([place.lng, place.lat]);
    if (pt.x > 30 && pt.x < w - 30 && pt.y > 140 && pt.y < h * 0.5) return;
    map.easeTo({ center: [place.lng, place.lat], offset: [0, -Math.round(h * 0.18)], duration: 500 });
  };

  // Sposta la mappa in modo che tutti i risultati siano visibili sopra la lista.
  const fitToPlaces = (list: Place[], top = 150) => {
    if (list.length === 0) return;
    const map = (mapRef.current as { getMap?: () => { fitBounds: (b: [[number, number], [number, number]], o: object) => void } } | null)?.getMap?.();
    if (!map) return;
    const lngs = list.map((p) => p.lng);
    const lats = list.map((p) => p.lat);
    const h = typeof window !== "undefined" ? window.innerHeight : 800;
    try {
      map.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding: { top, bottom: Math.round(h * 0.5), left: 40, right: 40 }, maxZoom: 15, duration: 900 },
      );
    } catch {
      // mappa non pronta: si lascia la vista com'è
    }
  };

  // Ricerca AI in linguaggio naturale (primo tempo: lista Google; verdetti dopo).
  // center: per i link condivisi (?q=…&at=lat,lng), che cercano nel punto di chi ha condiviso.
  const runAISearch = async (q: string, center?: { lat: number; lng: number }) => {
    const at = center ?? { lat: viewState.latitude, lng: viewState.longitude };
    setAiSearching(true);
      setAiError(null);
      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: q,
            source: view === "all" ? "world" : "saved",
            searchIntent: "natural",
            phase: "fast",
            lat: at.lat,
            lng: at.lng,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setAiError(data.error ?? "Qualcosa è andato storto. Riprova.");
          return;
        }
        type RawPlace = {
          id: string; name: string; category: string | null; lat: number | null; lng: number | null;
          rating: number | null; priceLevel: number | null; address: string | null;
          userRatingCount: number | null; openNow: boolean | null; websiteUri: string | null; phone: string | null;
          selectedReviews: { text: string }[] | null; synthesis: string | null; tags: string[] | null; verdict: string | null;
          goFor: string[] | null; dontExpect: string[] | null; matchReason: string | null; photoRef?: string | null; photoAuthor?: string | null;
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
          };
        }
        const id = ++searchSeq.current;
        setClusterPlaces(null); setFilterError(null);
        setAiSearch({ risultati: places, filtri: data.filtri_usati, id, query: q });
        setVenueDetails(details); setFilters(EMPTY_FILTERS);
        dispatch({ type: "OPEN_LIST" });
        setQuickFilters(new Set());
      setMovedSinceSearch(false);
      if (view === "all") saveRecentSearch(q);
      setSearchOrigin(at);
      fitToPlaces(places);
      void loadVerdicts(id, q, data.sintesi_pendente ?? null);
      } catch {
        setAiError("Errore di rete. Controlla la connessione e riprova.");
      } finally {
        setAiSearching(false);
      }

  };

  // Posizione: chiesta solo quando l'utente tocca il pulsante (mai al caricamento).
  const goToMyPosition = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) { setGeoState("unavailable"); return; }
    setGeoState("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setViewState((v) => ({ ...v, latitude: pos.coords.latitude, longitude: pos.coords.longitude, zoom: 14 }));
        setGeoState("idle");
        setWelcomeDismissed(true);
      },
      (err) => {
        const denied = err.code === err.PERMISSION_DENIED;
        setGeoState(denied ? "denied" : "unavailable");
        // A card iniziale chiusa il messaggio non si vedrebbe: avviso in sovrimpressione.
        if (welcomeDismissed) setFilterError(denied ? "Posizione non permessa: attivala nelle impostazioni del browser" : "Posizione non disponibile ora");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  // Secondo tempo della ricerca AI: verdetti e motivi arrivano dopo la lista.
  // Se nel frattempo l'utente ha cambiato o azzerato la ricerca (id diverso) si scarta.
  const loadVerdicts = async (id: number, searchedQuery: string, pending: PendingSynthesis | null) => {
    if (!pending) return;
    setLoadingVerdicts(true);
    try {
      const res = await fetch("/api/search/synthesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchedQuery, places: pending.places, token: pending.token }),
      });
      if (!res.ok || searchSeq.current !== id) return;
      const data: { dettagli?: Record<string, Partial<VenueDetails>>; esclusi?: string[] } = await res.json();
      const esclusi = new Set(data.esclusi ?? []);
      setVenueDetails((prev) => {
        const next = { ...prev };
        for (const [pid, d] of Object.entries(data.dettagli ?? {})) {
          next[pid] = { ...(prev[pid] as VenueDetails), ...d } as VenueDetails;
        }
        return next;
      });
      if (esclusi.size > 0) {
        setAiSearch((prev) =>
          prev && prev.id === id
            ? { ...prev, risultati: prev.risultati.filter((p) => !esclusi.has(p.id)) }
            : prev,
        );
      }
    } catch {
      // Degrada: la lista Google resta, senza verdetti.
    } finally {
      if (searchSeq.current === id) setLoadingVerdicts(false);
    }
  };

  // Link a una ricerca (/mappa?q=…&at=lat,lng): la rifà una volta all'apertura, nello stesso punto.
  // Costa quanto una ricerca scritta a mano. Poi toglie q dall'indirizzo, così ricaricare non la ripete.
  const sharedSearchDone = useRef(false);
  useEffect(() => {
    if (sharedSearchDone.current) return;
    sharedSearchDone.current = true;
    const params = new URLSearchParams(window.location.search);
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
    setTimeout(() => {
      if (center) setViewState((v) => ({ ...v, latitude: center.lat, longitude: center.lng, zoom: 13 }));
      setWelcomeDismissed(true);
      setAiQuery(q);
      void runAISearch(q, center);
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al primo caricamento
  }, []);

  return (
    <div className="fixed inset-0 md:top-14">
      {/* Torna alla mia posizione: sempre raggiungibile, anche dopo aver chiuso la card iniziale. */}
      <button
        type="button"
        onClick={goToMyPosition}
        disabled={geoState === "loading"}
        aria-label="La mia posizione"
        className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-surface text-brand shadow-float active:scale-95 disabled:opacity-60"
      >
        <LocateFixed size={20} className={geoState === "loading" ? "animate-pulse" : ""} />
      </button>
      {/* Pannello controlli superiori: ricerca AI + ricerca luoghi + switch impilati */}
      <div className="absolute top-4 left-4 z-10 flex w-80 max-w-[90vw] flex-col gap-2 pointer-events-none">
        {/* Riga icone: Concierge AI + Filtri */}
        <div className="pointer-events-auto flex gap-2">
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
          <button
            type="button"
            onClick={() => {
              setAiSearch(null);
              setAiQuery("");
              dispatch({ type: "OPEN_FILTERS" });
            }}
            className="relative flex h-11 w-11 items-center justify-center rounded-full bg-surface shadow-float hover:shadow-card transition-shadow"
          >
            <SlidersHorizontal size={20} className="text-text-muted" />
            {countActive(filters) > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent font-display text-xs font-bold text-white">
                {countActive(filters)}
              </span>
            )}
          </button>
        </div>
        {/* Pannello AI espandibile */}
        {overlay.kind === "ai" && (
          <div className="pointer-events-auto w-80 max-w-[90vw] relative">
            <AISearchPanel
              key={view}
              query={aiQuery}
              setQuery={setAiQuery}
              onSubmit={(q) => { void runAISearch(q); }}
              isSearching={aiSearching}
              error={aiError}
              onClear={() => { setClusterPlaces(null); setFilterError(null); setAiSearch(null); setAiQuery(""); setAiError(null); dispatch({ type: "RESET" }); }}
              activeFiltri={aiSearch?.filtri ?? null}
              activeCount={aiSearch?.risultati.length ?? null}
              recent={recentOn ? (JSON.parse(recentSearches) as string[]).slice(0, 3) : []}
            />
          </div>
        )}
        <div className="pointer-events-auto self-start flex rounded-card overflow-hidden shadow-card border border-border bg-surface">
          <button
            type="button"
            onClick={() => { setView("all"); setActiveTag(null); setActiveCity(null); setSavedQuery(""); setAiSearch(null); setAiQuery(""); setClusterPlaces(null); setFilterError(null); dispatch({ type: "RESET" }); }}
            className={
              view === "all"
                ? "px-4 py-2 text-sm font-display font-semibold bg-brand text-white"
                : "px-4 py-2 text-sm font-display font-semibold bg-surface text-text-muted hover:text-text"
            }
          >
            Esplora
          </button>
          <button
            type="button"
            onClick={() => { setView("saved"); setAiSearch(null); setAiQuery(""); setClusterPlaces(null); setFilterError(null); dispatch({ type: "OPEN_LIST" }); }}
            className={
              view === "saved"
                ? "px-4 py-2 text-sm font-display font-semibold bg-brand text-white"
                : "px-4 py-2 text-sm font-display font-semibold bg-surface text-text-muted hover:text-text"
            }
          >
            I miei salvati
          </button>
        </div>
        {view === "saved" && userId && savedPlaces.length > 0 && (
          <div data-testid="salvati-filtri" className="pointer-events-auto flex flex-col gap-2 rounded-card border border-border bg-surface p-2 shadow-float">
            <input
              type="search"
              value={savedQuery}
              onChange={(e) => { setSavedQuery(e.target.value); setClusterPlaces(null); }}
              placeholder={`Cerca tra i tuoi ${savedPlaces.length} salvati`}
              aria-label="Cerca tra i salvati"
              className="min-h-10 w-full rounded-btn border border-border bg-white px-3 text-base font-sans text-text placeholder:text-text-muted focus:border-brand focus:outline-none"
            />
            <div className="-mx-2 flex gap-1.5 overflow-x-auto px-2 [scrollbar-width:none]">
              <button
                type="button"
                onClick={() => { setActiveTag(null); setActiveCity(null); setSavedQuery(""); setAiSearch(null); setClusterPlaces(null); setFilterError(null); }}
                className={`shrink-0 ${!savedFiltered ? CHIP_ON : CHIP_OFF}`}
              >
                Tutti
              </button>
              {availableCities.length > 1 && availableCities.map(({ city, count }) => (
                <button
                  key={`c-${city}`}
                  type="button"
                  aria-pressed={activeCity === city}
                  onClick={() => {
                    const next = activeCity === city ? null : city;
                    setActiveCity(next); setAiSearch(null); setClusterPlaces(null); setFilterError(null);
                    // sotto il riquadro dei filtri salvati (~220px)
                    fitToPlaces(filterSaved(savedPlaces, activeTag, next, savedQuery), 230);
                  }}
                  className={`shrink-0 ${activeCity === city ? CHIP_ON : CHIP_CITY}`}
                >
                  📍 {city} · {count}
                </button>
              ))}
              {availableTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={activeTag === tag}
                  onClick={() => { setActiveTag(activeTag === tag ? null : tag); setAiSearch(null); setClusterPlaces(null); setFilterError(null); }}
                  className={`shrink-0 ${activeTag === tag ? CHIP_ON : CHIP_OFF}`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Messaggio se non loggato e vista "salvati" */}
      {view === "saved" && !userId && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="bg-surface rounded-card shadow-float p-6 text-center max-w-xs pointer-events-auto">
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
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
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
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="bg-surface rounded-card shadow-float p-6 text-center max-w-xs pointer-events-auto">
              <p className="text-2xl mb-2">
                {aiSearch !== null ? "🔍" : view === "saved" && savedFiltered ? "🏷️" : "📍"}
              </p>
              <p className="font-display font-semibold text-text">
                {aiSearch !== null
                  ? "Non ho trovato nulla"
                  : view === "saved" && savedFiltered
                    ? "Nessun salvato con questi filtri"
                    : view === "saved"
                      ? "Nessun posto salvato"
                      : "Nessun posto da mostrare"}
              </p>
              <p className="mt-1 text-sm font-sans text-text-muted">
                {aiSearch !== null
                  ? "Prova con meno requisiti o scrivi un'altra zona (es. “a Trastevere”)."
                  : view === "saved" && savedFiltered
                    ? "Cambia la ricerca o tocca “Tutti”"
                    : view === "saved"
                      ? "Tocca il segnalibro su un locale per ritrovarlo qui, con note e tag."
                      : "Sposta la mappa o cambia vista"}
              </p>
              {aiSearch === null && view === "saved" && !savedFiltered && (
                <button
                  type="button"
                  onClick={() => { setView("all"); setActiveTag(null); setActiveCity(null); setSavedQuery(""); setWelcomeDismissed(false); dispatch({ type: "RESET" }); }}
                  className="mt-4 min-h-11 rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white active:scale-95"
                >
                  Cerca un locale
                </button>
              )}
              {aiSearch !== null && (
                <div className="mt-4 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "OPEN_AI" })}
                    className="min-h-11 rounded-pill bg-brand px-4 text-sm font-display font-semibold text-white active:scale-95"
                  >
                    Correggi la ricerca
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAiSearch(null); setAiQuery(""); setWelcomeDismissed(false); dispatch({ type: "RESET" }); }}
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
          className="absolute inset-x-0 z-10 flex justify-center px-3 pointer-events-none"
          style={{ bottom: "calc(var(--nav-height-mobile) + 0.5rem)" }}
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
            <form
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
            </form>
          </div>
        </div>
      )}

      {/* Primo accesso: barra compatta in basso (la mappa resta visibile). */}
      {homeVariant === "a" && view === "all" && aiSearch === null && overlay.kind === "none" && !welcomeDismissed && (
        <div
          data-testid="benvenuto"
          className="absolute inset-x-0 z-10 flex justify-center px-3 pointer-events-none"
          style={{ bottom: "calc(var(--nav-height-mobile) + 0.5rem)" }}
        >
          <div className="pointer-events-auto w-full max-w-md rounded-card bg-surface px-3 pb-3 pt-2 shadow-float">
            <div className="flex items-center justify-between">
              <p className="font-title text-lg font-semibold text-brand">Cosa cerchi?</p>
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
              {/* Campo di ricerca direttamente nella card (come la home di Places): si scrive subito. */}
              <form
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
              </form>
              <button
                type="button"
                onClick={goToMyPosition}
                disabled={geoState === "loading"}
                aria-label="Usa la mia posizione"
                className="min-h-11 shrink-0 rounded-pill border border-border px-4 text-sm font-display font-semibold text-brand active:scale-95 disabled:opacity-60"
              >
                {geoState === "loading" ? "Cerco…" : "📍 Dove sono"}
              </button>
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
      {aiSearch !== null && movedSinceSearch && aiQuery.trim() !== "" && (overlay.kind === "list" || overlay.kind === "none") && (
        <div className="pointer-events-none absolute inset-x-0 top-[7.5rem] z-10 flex justify-center">
          <button
            type="button"
            disabled={aiSearching}
            onClick={() => { const q = (aiSearch?.query ?? aiQuery).trim(); setAiQuery(q); void runAISearch(q); }}
            className="pointer-events-auto min-h-11 rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white shadow-float active:scale-95 disabled:opacity-60"
          >
            {aiSearching ? "Cerco…" : "Cerca in quest'area"}
          </button>
        </div>
      )}

      <Map
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        onMoveStart={(evt) => { if ((evt as { originalEvent?: unknown }).originalEvent && aiSearch !== null) setMovedSinceSearch(true); }}
        ref={mapRef}
        style={{ width: "100%", height: "100%" }}
        mapStyle={mapVariant === "chiara" ? "mapbox://styles/mapbox/light-v11" : "mapbox://styles/mapbox/streets-v12"}
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
                if (carouselOpen && focusId !== place.id && carouselOrder.includes(place.id)) {
                  setFocusedId(place.id);
                  return;
                }
                dispatch({ type: "OPEN_VENUE", placeId: place.id });
              }}
              style={{ zIndex: focusId === place.id || selected?.id === place.id ? 2 : 1 }}
            >
              <div className="flex cursor-pointer flex-col items-center" data-testid="pin" data-focused={focusId === place.id ? "true" : undefined}>
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
                {(aiSearch !== null || viewState.zoom >= 14 || selected?.id === place.id) && (
                  <span className="mt-0.5 max-w-[110px] truncate rounded-pill bg-white/95 px-2 py-0.5 text-[11px] font-display font-semibold text-brand shadow-card">
                    {place.name}
                  </span>
                )}
              </div>
            </Marker>
          );
        })}

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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => dispatch({ type: "CLOSE" })}>
          <DragToClose onClose={() => dispatch({ type: "CLOSE" })} className="w-full max-w-lg max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-card bg-surface shadow-float">
            <VenueSheet
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
                />
              }
              communitySlot={
                <>
                  {selectedReviews ? (
                    <>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-base font-display font-semibold text-text">
                          {selectedReviews.avg.toLocaleString("it-IT", {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })}
                        </span>
                        <span className="text-star text-sm">
                          {"★".repeat(Math.round(selectedReviews.avg))}
                          <span className="text-border">
                            {"★".repeat(5 - Math.round(selectedReviews.avg))}
                          </span>
                        </span>
                        <span className="text-xs font-sans text-text-muted">
                          su {selectedReviews.count}{" "}
                          {selectedReviews.count === 1 ? "recensione" : "recensioni"}
                        </span>
                      </div>
                      <ul className="mt-1.5 max-h-32 space-y-2 overflow-y-auto">
                        {selectedReviews.items.map((r, i) => (
                          <li key={i} className="text-xs">
                            <span className="text-star">{"★".repeat(r.rating)}</span>
                            <span className="text-border">{"★".repeat(5 - r.rating)}</span>
                            {r.comment && (
                              <p className="mt-0.5 font-sans text-text-muted">{r.comment}</p>
                            )}
                            <p className="font-sans text-text-muted">
                              {new Date(r.created_at).toLocaleDateString("it-IT", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="text-xs font-sans text-text-muted">Ancora nessuna recensione.</p>
                  )}
                  {!userId ? (
                    <p className="mt-2 text-xs font-sans text-text-muted">
                      <a href="/login" className="underline hover:text-text">
                        Accedi
                      </a>{" "}
                      per lasciare una recensione.
                    </p>
                  ) : resolveUuid(selected.id) === null ? (
                    <p className="mt-2 text-xs font-sans text-text-muted">
                      Salva questo locale per poter lasciare una recensione.
                    </p>
                  ) : (
                    <ReviewForm
                      placeId={resolveUuid(selected.id)!}
                      userId={userId}
                      existing={
                        selectedReviews?.items.find((r) => r.user_id === userId) ?? null
                      }
                      onSaved={(items) => {
                        if (items.length === 0) {
                          setSelectedReviews(null);
                          return;
                        }
                        const avg =
                          items.reduce((sum, r) => sum + r.rating, 0) / items.length;
                        setSelectedReviews({ avg, count: items.length, items });
                      }}
                    />
                  )}
                </>
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
            userId={userId}
            onSaved={(tags, note, uuid) => {
              if (uuid) {
                setPlaceUuids((prev) => ({ ...prev, [pendingPlace.id]: uuid }));
                setSavedIds((prev) => new Set(prev).add(uuid));
              }
              setSavedPlaces(prev => [
                ...prev.filter(p => p.id !== uuid),
                { ...pendingPlace, id: uuid ?? pendingPlace.id, tags, note },
              ]);
              setPendingSavePlaceId(null);
            }}
            onCancel={() => setPendingSavePlaceId(null)}
          />
        ) : null;
      })()}

      {pendingEditPlace && userId && (
        <SaveModal
          place={pendingEditPlace}
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

      {/* Ricerca in corso senza card iniziale (link ?q=, home): card fantasma come Places, la mappa non resta muta. */}
      {aiSearching && aiSearch === null && welcomeDismissed && overlay.kind === "none" && (
        <div data-testid="ricerca-in-corso" className="pointer-events-none absolute left-0 right-0 z-10" style={{ bottom: "var(--nav-height-mobile)" }}>
          <div className="mx-3 mb-2 w-fit max-w-[calc(100%-1.5rem)] rounded-card bg-surface px-4 py-2 shadow-float">
            <p className="truncate font-title text-base font-semibold text-brand first-letter:uppercase">{aiQuery}</p>
            <p className="flex items-center gap-2 text-xs font-sans text-text-muted">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-border border-t-accent" />
              Cerco i posti giusti…
            </p>
          </div>
          <div className="flex gap-3 overflow-hidden px-3 pb-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-[190px] w-[78vw] max-w-sm shrink-0 animate-pulse rounded-card bg-brand/80 p-4 shadow-float">
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
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center pt-24">
          <div className="pointer-events-auto flex items-center gap-2 rounded-pill bg-surface px-4 py-2 shadow-float">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-border border-t-accent" />
            <span className="text-sm font-sans text-text">Sto cercando…</span>
          </div>
        </div>
      )}

      {filterError && (
        <div className="absolute inset-x-0 top-0 z-20 flex justify-center pt-24">
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
          details={aiSearch !== null ? venueDetails : undefined}
          loadingVerdicts={aiSearch !== null && loadingVerdicts}
          variant={listVariant}
          origin={userPos ?? searchOrigin}
          quick={quickFilters}
          title={aiSearch !== null && view === "all" ? aiSearch.query ?? null : null}
          heading={view === "saved" && aiSearch === null ? `I tuoi salvati${activeCity ? ` · ${activeCity}` : ""}` : null}
          focusedId={focusId}
          understood={aiSearch?.filtri ? filtriParts(aiSearch.filtri).slice(0, 4) : []}
          onOrder={setCarouselOrder}
          onRefine={() => dispatch({ type: "OPEN_AI" })}
          onOpenArticle={articleOn && aiSearch !== null && view === "all" && clusterPlaces === null ? () => setArticleOpen(true) : undefined}
          isSaved={isPlaceSaved}
          onSave={aiSearch !== null && view === "all" ? (place) => {
            if (!userId) { window.location.href = "/login"; return; }
            // Già salvato: la scheda permette di modificarlo o rimuoverlo.
            if (isPlaceSaved(place.id)) { dispatch({ type: "OPEN_VENUE", placeId: place.id }); return; }
            setPendingSavePlaceId(place.id);
          } : undefined}
          onFocus={(place) => { setFocusedId(place.id); panIntoView(place); }}
          shareAt={searchOrigin ?? { lat: viewState.latitude, lng: viewState.longitude }}
          onToggleQuick={(f) => setQuickFilters((prev) => {
            const next = new Set(prev);
            if (next.has(f)) next.delete(f);
            else next.add(f);
            return next;
          })}
          onSelect={(place) => {
            dispatch({ type: "OPEN_VENUE", placeId: place.id });
            const map = (mapRef.current as { getMap?: () => { flyTo: (opts: { center: [number, number]; zoom: number }) => void } } | null)?.getMap?.();
            if (map) map.flyTo({ center: [place.lng, place.lat], zoom: Math.max(viewState.zoom, 17) });
          }}
          onClose={() => { setClusterPlaces(null); setFilterError(null); setAiSearch(null); setAiQuery(""); dispatch({ type: "RESET" }); }}
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
          onSave={(place) => {
            if (!userId) { window.location.href = "/login"; return; }
            if (isPlaceSaved(place.id)) { dispatch({ type: "OPEN_VENUE", placeId: place.id }); return; }
            setPendingSavePlaceId(place.id);
          }}
          onSelect={(place) => dispatch({ type: "OPEN_VENUE", placeId: place.id })}
          onAsk={(q) => { setArticleOpen(false); setAiQuery(q); void runAISearch(q); }}
          onClose={() => setArticleOpen(false)}
        />
      )}

      <FiltersSheet
        isOpen={overlay.kind === "filters"}
        filters={filters}
        onClose={() => dispatch({ type: "CLOSE" })}
        onApply={(f) => { setClusterPlaces(null); setFilterError(null); setFilters(f); void runFilteredSearch(f); }}
      />
    </div>
  );
}
