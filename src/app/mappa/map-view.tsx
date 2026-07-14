"use client";

import { useEffect, useMemo, useReducer, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Map, { Marker } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import Supercluster from "supercluster";
import { createClient } from "@/lib/supabase/client";
import { getCategoryEmoji } from "@/lib/emoji";
import FiltersSheet, { type Filters, EMPTY_FILTERS, countActive } from "@/components/filters-sheet";
import VenueSheet from "@/components/venue-sheet";
import BottomSheet from "@/components/bottom-sheet";
import { SlidersHorizontal, Sparkles } from "lucide-react";
import { overlayReducer, type Overlay, type OverlayAction } from "@/lib/panel-state";

const PRESET_TAGS = ["Da provare", "Già visitato", "Romantico", "Economico", "Speciale", "Con amici"];

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
    <div className="mt-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={
          isSaved
            ? "rounded-btn bg-success px-3 py-1 text-sm font-display font-semibold text-white hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
            : "rounded-btn bg-brand px-3 py-1 text-sm font-display font-semibold text-white hover:opacity-90 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
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
};

function buildAISummary(filtri: AIFiltri): string {
  const parts: string[] = [];
  if (filtri.categoria) parts.push(filtri.categoria);
  parts.push(...filtri.parole_chiave);
  if (filtri.vicino_a_me) parts.push("vicino a te");
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
};

function AISearchPanel({
  onResults,
  onClear,
  activeFiltri,
  activeCount,
  view,
  viewState,
}: {
  onResults: (places: Place[], filtri: AIFiltri, details: Record<string, VenueDetails>) => void;
  onClear: () => void;
  activeFiltri: AIFiltri | null;
  activeCount: number | null;
  view: "all" | "saved";
  viewState: { latitude: number; longitude: number };
}) {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsSearching(true);
    setError(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          source: view === "all" ? "world" : "saved",
          lat: viewState.latitude,
          lng: viewState.longitude,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Qualcosa è andato storto. Riprova.");
        return;
      }
      type RawPlace = {
        id: string; name: string; category: string | null; lat: number | null; lng: number | null;
        rating: number | null; priceLevel: number | null; address: string | null;
        userRatingCount: number | null; openNow: boolean | null; websiteUri: string | null; phone: string | null;
        selectedReviews: { text: string }[] | null; synthesis: string | null; tags: string[] | null; verdict: string | null;
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
        };
      }
      onResults(places, data.filtri_usati, details);
    } catch {
      setError("Errore di rete. Controlla la connessione e riprova.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="rounded-card bg-surface p-3 shadow-float">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca con parole tue: una trattoria autentica vicino casa…"
          className="flex-1 min-w-0 rounded-btn border border-border px-3 py-1.5 text-sm font-sans text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <button
          type="submit"
          disabled={isSearching}
          className="shrink-0 rounded-btn bg-brand px-3 py-1.5 text-sm font-display font-semibold text-white hover:opacity-90 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSearching ? "..." : "Cerca"}
        </button>
        {activeFiltri !== null && (
          <button
            type="button"
            onClick={() => { setQuery(""); setError(null); onClear(); }}
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
  const [aiSearch, setAiSearch] = useState<{ risultati: Place[]; filtri: AIFiltri | null } | null>(null);
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
        : activeTag === null
          ? savedPlaces
          : savedPlaces.filter((p) => p.tags?.includes(activeTag));

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
    const savedVersion = savedPlaces.find((p) => p.id === id);
    return savedVersion ? { ...base, tags: savedVersion.tags, note: savedVersion.note } : base;
  }, [overlay, places, displayedPlaces, savedPlaces]);

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
    supabase
      .from("saved_places")
      .select("tags, note, places(id, name, category, lat, lng, google_place_id)")
      .eq("user_id", userId)
      .then(({ data, error }) => {
        setLoadingSaved(false);
        if (error) {
          console.error("Errore nel caricamento dei locali salvati:", error);
          return;
        }
        const uuidMap: Record<string, string> = {};
        const fetched = (data ?? [])
          .map((row) => {
            // google_place_id serve solo a costruire il ponte id Google -> UUID, poi si scarta.
            const raw = row.places as unknown as (Place & { google_place_id?: string | null }) | null;
            if (!raw || raw.lat == null || raw.lng == null) return null;
            const { google_place_id, ...place } = raw;
            if (google_place_id) uuidMap[google_place_id] = place.id;
            return { ...place, tags: row.tags as string[] | null, note: row.note as string | null };
          })
          .filter((p): p is Place => p !== null);
        setSavedPlaces(fetched);
        setPlaceUuids((prev) => ({ ...prev, ...uuidMap }));
      });
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
        };
      }
      setAiSearch({ risultati: places, filtri: data.filtri_usati ?? null });
      setVenueDetails(details);
      dispatch({ type: "OPEN_LIST" });
    } catch {
      setFilterError("Ricerca non riuscita. Riprova.");
    } finally {
      setFilterLoading(false);
    }
  };

  const clusterIndex = useMemo(() => {
    const points = displayedPlaces.map((place) => ({
      type: "Feature" as const,
      properties: { cluster: false, placeData: place },
      geometry: { type: "Point" as const, coordinates: [place.lng, place.lat] },
    }));
    const index = new Supercluster({ radius: 50, maxZoom: 20 });
    index.load(points);
    return index;
  }, [displayedPlaces]);

  const roundedZoom = Math.ceil(viewState.zoom);
  const clusters = useMemo(() => {
    const map = (mapRef.current as { getMap?: () => { getBounds: () => { getWest: () => number; getSouth: () => number; getEast: () => number; getNorth: () => number } } } | null)?.getMap?.();
    if (!map) {
      return displayedPlaces.map((place) => ({
        type: "Feature" as const,
        properties: { cluster: false, placeData: place },
        geometry: { type: "Point" as const, coordinates: [place.lng, place.lat] },
      }));
    }
    const b = map.getBounds();
    const bbox: [number, number, number, number] = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
    return clusterIndex.getClusters(bbox, roundedZoom);
  }, [clusterIndex, roundedZoom, viewState.longitude, viewState.latitude]);

  return (
    <div className="fixed inset-0 md:top-14">
      {/* Pannello controlli superiori: ricerca AI + ricerca luoghi + switch impilati */}
      <div className="absolute top-4 left-4 z-10 flex w-80 max-w-[90vw] flex-col gap-2 pointer-events-none">
        {/* Riga icone: Concierge AI + Filtri */}
        <div className="pointer-events-auto flex gap-2">
          <button
            type="button"
            onClick={() => {
              setFilters(EMPTY_FILTERS);
              setAiSearch(null);
              dispatch({ type: overlay.kind === "ai" ? "RESET" : "OPEN_AI" });
            }}
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
              onResults={(places, filtri, details) => { setClusterPlaces(null); setFilterError(null); setAiSearch({ risultati: places, filtri }); setVenueDetails(details); setFilters(EMPTY_FILTERS); dispatch({ type: "OPEN_LIST" }); }}
              onClear={() => { setClusterPlaces(null); setFilterError(null); setAiSearch(null); dispatch({ type: "RESET" }); }}
              activeFiltri={aiSearch?.filtri ?? null}
              activeCount={aiSearch?.risultati.length ?? null}
              view={view}
              viewState={viewState}
            />
          </div>
        )}
        <div className="pointer-events-auto self-start flex rounded-card overflow-hidden shadow-card border border-border bg-surface">
          <button
            type="button"
            onClick={() => { setView("all"); setActiveTag(null); setAiSearch(null); setClusterPlaces(null); setFilterError(null); dispatch({ type: "RESET" }); }}
            className={
              view === "all"
                ? "px-4 py-2 text-sm font-display font-semibold bg-brand text-white"
                : "px-4 py-2 text-sm font-display font-semibold bg-surface text-text-muted hover:text-text"
            }
          >
            Tutti i locali
          </button>
          <button
            type="button"
            onClick={() => { setView("saved"); setAiSearch(null); setClusterPlaces(null); setFilterError(null); dispatch({ type: "OPEN_LIST" }); }}
            className={
              view === "saved"
                ? "px-4 py-2 text-sm font-display font-semibold bg-brand text-white"
                : "px-4 py-2 text-sm font-display font-semibold bg-surface text-text-muted hover:text-text"
            }
          >
            I miei salvati
          </button>
        </div>
        {view === "saved" && availableTags.length > 0 && (
          <div className="pointer-events-auto flex flex-wrap gap-1.5 rounded-card border border-border bg-surface p-2 shadow-float">
            <button
              type="button"
              onClick={() => { setActiveTag(null); setAiSearch(null); setClusterPlaces(null); setFilterError(null); }}
              className={
                activeTag === null
                  ? "rounded-pill bg-brand px-3 py-1 text-xs font-display font-semibold text-white"
                  : "rounded-pill bg-accent-light px-3 py-1 text-xs font-display font-semibold text-accent hover:opacity-80"
              }
            >
              Tutti
            </button>
            {availableTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => { setActiveTag(tag); setAiSearch(null); setClusterPlaces(null); setFilterError(null); }}
                className={
                  activeTag === tag
                    ? "rounded-pill bg-brand px-3 py-1 text-xs font-display font-semibold text-white"
                    : "rounded-pill bg-accent-light px-3 py-1 text-xs font-display font-semibold text-accent hover:opacity-80"
                }
              >
                {tag}
              </button>
            ))}
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
                {aiSearch !== null ? "🔍" : view === "saved" && activeTag !== null ? "🏷️" : "📍"}
              </p>
              <p className="font-display font-semibold text-text">
                {aiSearch !== null
                  ? "Nessun risultato"
                  : view === "saved" && activeTag !== null
                    ? "Nessun posto con questo tag"
                    : view === "saved"
                      ? "Nessun posto salvato"
                      : "Nessun posto da mostrare"}
              </p>
              <p className="mt-1 text-sm font-sans text-text-muted">
                {aiSearch !== null
                  ? "Prova a modificare la ricerca"
                  : view === "saved" && activeTag !== null
                    ? "Cambia filtro o salva nuovi posti"
                    : view === "saved"
                      ? "Inizia a salvare i posti che vuoi ricordare"
                      : "Sposta la mappa o cambia vista"}
              </p>
            </div>
          </div>
        )}

      <Map
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        ref={mapRef}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
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
                dispatch({ type: "OPEN_VENUE", placeId: place.id });
              }}
            >
              <span
                role="img"
                aria-label={place.category ?? "locale"}
                className="text-3xl leading-none cursor-pointer drop-shadow"
              >
                {getCategoryEmoji(place.category, place.name)}
              </span>
            </Marker>
          );
        })}

      </Map>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => dispatch({ type: "CLOSE" })}>
          <div className="w-full max-w-lg max-h-[85dvh] overflow-y-auto rounded-t-card bg-surface shadow-float" onClick={(e) => e.stopPropagation()}>
            <VenueSheet
              venue={{
                id: selected.id, name: selected.name, address: selected.address,
                category: selected.category, rating: selected.rating,
                priceLevel: selected.priceLevel, lat: selected.lat, lng: selected.lng,
                personalTags: selected.tags,
                personalNote: selected.note,
                ...(venueDetails[selected.id] ?? {
                  userRatingCount: null, openNow: null, websiteUri: null, phone: null,
                  selectedReviews: null, synthesis: null, tags: null, verdict: null,
                }),
              }}
              isSaved={isPlaceSaved(selected.id)}
              canEdit={view === "saved"}
              onEdit={() => setPendingEditPlace(selected)}
              onClose={() => dispatch({ type: "CLOSE" })}
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
          </div>
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
          onSelect={(place) => {
            dispatch({ type: "OPEN_VENUE", placeId: place.id });
            const map = (mapRef.current as { getMap?: () => { flyTo: (opts: { center: [number, number]; zoom: number }) => void } } | null)?.getMap?.();
            if (map) map.flyTo({ center: [place.lng, place.lat], zoom: Math.max(viewState.zoom, 17) });
          }}
          onClose={() => { setClusterPlaces(null); setFilterError(null); setAiSearch(null); dispatch({ type: "RESET" }); }}
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
