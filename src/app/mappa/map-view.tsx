"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Map, { Marker, Popup } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { createClient } from "@/lib/supabase/client";

const PRESET_TAGS = ["Da provare", "Già visitato", "Romantico", "Economico", "Speciale", "Con amici"];

function SaveModal({
  placeId,
  userId,
  mode = "save",
  initialTags = [],
  initialNote = "",
  onSaved,
  onCancel,
}: {
  placeId: string;
  userId: string;
  mode?: "save" | "edit";
  initialTags?: string[];
  initialNote?: string;
  onSaved: (tags: string[] | null, note: string | null) => void;
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

      if (mode === "edit") {
        const { error } = await supabase
          .from("saved_places")
          .update({ tags, note: noteValue })
          .eq("user_id", userId)
          .eq("place_id", placeId);
        if (error) { setError(true); return; }
      } else {
        const { error } = await supabase
          .from("saved_places")
          .insert({ user_id: userId, place_id: placeId, tags, note: noteValue });
        if (error && error.code !== "23505") { setError(true); return; }
      }

      onSaved(tags, noteValue);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-80 max-w-[90vw] rounded-xl bg-white p-5 shadow-xl">
        <h2 className="mb-3 text-base font-semibold text-zinc-900">
          {mode === "edit" ? "Modifica locale" : "Salva locale"}
        </h2>

        <p className="mb-2 text-xs text-zinc-500">Tag</p>
        <div className="mb-4 flex flex-wrap gap-2">
          {PRESET_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={
                selectedTags.includes(tag)
                  ? "rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white"
                  : "rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-200"
              }
            >
              {tag}
            </button>
          ))}
        </div>

        <p className="mb-1 text-xs text-zinc-500">Nota personale</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Aggiungi una nota..."
          rows={3}
          className="w-full resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
        />

        {error && (
          <p className="mt-1 text-sm text-red-600">
            Errore durante il salvataggio. Riprova.
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="flex-1 rounded-md bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "..." : "Salva"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 rounded-md bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-200 disabled:opacity-60"
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
          <span className={(hovered || value) >= star ? "text-amber-400" : "text-zinc-300"}>
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
    <form onSubmit={handleSubmit} className="mt-3 space-y-2 border-t border-zinc-100 pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {existing ? "Modifica la tua recensione" : "Lascia una recensione"}
      </p>
      <StarPicker value={rating} onChange={(v) => { setRating(v); setStatus("idle"); }} />
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Commento (opzionale)"
        rows={2}
        className="w-full resize-none rounded-md border border-zinc-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-400"
      />
      {status === "error" && (
        <p className="text-xs text-red-500">{errorMsg}</p>
      )}
      {status === "done" && (
        <p className="text-xs text-emerald-600">Recensione pubblicata ✓</p>
      )}
      <button
        type="submit"
        disabled={status === "saving"}
        className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "saving" ? "..." : existing ? "Aggiorna" : "Pubblica recensione"}
      </button>
    </form>
  );
}

type Place = {
  id: string;
  name: string;
  category: string | null;
  lat: number;
  lng: number;
  tags: string[] | null;
  note: string | null;
};

const EMOJI_RULES: [string[], string][] = [
  [["pizza", "pizzeria"], "🍕"],
  [["sushi", "giappones", "japanese"], "🍣"],
  [["pesce", "fish", "seafood", "frutti di mare"], "🐟"],
  [["gelat", "ice cream", "ice_cream"], "🍦"],
  [["forno", "panific", "panetteria", "bakery", "pasticc", "pastry"], "🥐"],
  [["caff", "cafe", "coffee"], "☕️"],
  [["enotec", "wine"], "🍷"],
  [["bar", "pub", "birrer", "brewery"], "🍺"],
  [["burger", "hamburger", "panino", "paninote"], "🍔"],
  [["ramen", "noodle", "cines", "chinese", "thai", "asiatic", "asian"], "🍜"],
  [["steak", "grill", "brace", "carne", "macelleria"], "🥩"],
  [["ristorante", "restaurant", "trattoria", "osteria"], "🍝"],
];

function getCategoryEmoji(category: string | null): string {
  if (!category) return "🍴";
  const c = category.toLowerCase();
  for (const [keywords, emoji] of EMOJI_RULES) {
    if (keywords.some((kw) => c.includes(kw))) return emoji;
  }
  return "🍴";
}

function SaveButton({
  placeId,
  userId,
  isSaved,
  onToggle,
  onSaveRequest,
}: {
  placeId: string;
  userId: string | null;
  isSaved: boolean;
  onToggle: (placeId: string, saved: boolean) => void;
  onSaveRequest: (placeId: string) => void;
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
      onSaveRequest(placeId);
      return;
    }

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
            ? "rounded-md bg-emerald-600 px-3 py-1 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
            : "rounded-md bg-zinc-900 px-3 py-1 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-60 disabled:cursor-not-allowed"
        }
      >
        {isPending ? "..." : isSaved ? "Salvato" : "Salva"}
      </button>
      {error && (
        <p className="mt-1 text-sm text-red-600">
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

function SearchPanel({
  userId,
  onPlaceAdded,
}: {
  userId: string | null;
  onPlaceAdded: (place: Place) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const clearResults = () => {
    setResults([]);
    setError(null);
    setInfo(null);
    setQuery("");
    setAddedIds(new Set());
    setHasSearched(false);
  };

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);
    setInfo(null);
    setHasSearched(false);

    try {
      const res = await fetch("/api/places/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Errore nella ricerca.");
        setResults([]);
        return;
      }

      setResults(data.results ?? []);
      setHasSearched(true);
    } catch {
      setError("Errore nella ricerca.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleAdd = async (result: SearchResult) => {
    if (!userId) {
      router.push("/login");
      return;
    }

    if (result.lat == null || result.lng == null) return;

    setAddingId(result.id);
    setError(null);
    setInfo(null);

    try {
      const res = await fetch("/api/places/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          googlePlaceId: result.id,
          name: result.name,
          address: result.address,
          lat: result.lat,
          lng: result.lng,
          category: result.category,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Errore nell'aggiunta del locale.");
        return;
      }

      onPlaceAdded({
        id: data.place.id,
        name: data.place.name,
        category: data.place.category,
        lat: data.place.lat,
        lng: data.place.lng,
        tags: null,
        note: null,
      });

      if (data.created === false) {
        setResults([]);
        setHasSearched(false);
        setInfo("Questo locale è già nella mappa.");
        return;
      }

      clearResults();
    } catch {
      setError("Errore nell'aggiunta del locale.");
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="rounded-md bg-white p-3 shadow-lg">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!e.target.value) {
              setResults([]);
              setError(null);
              setInfo(null);
              setHasSearched(false);
            }
          }}
          placeholder="Cerca un locale..."
          className="flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
        />
        <button
          type="submit"
          disabled={isSearching}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSearching ? "..." : "Cerca"}
        </button>
        {(results.length > 0 || !!error || !!info || hasSearched) && (
          <button
            type="button"
            onClick={clearResults}
            aria-label="Chiudi risultati"
            className="shrink-0 rounded-md px-2 text-lg font-bold text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            ✕
          </button>
        )}
      </form>

      {isSearching && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-zinc-500">
          <span className="inline-block h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
          Sto cercando…
        </p>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {info && <p className="mt-2 text-sm text-amber-600">{info}</p>}

      {hasSearched && !isSearching && results.length === 0 && !error && (
        <p className="mt-2 text-sm text-zinc-500">
          Nessun locale trovato, prova con un altro nome.
        </p>
      )}

      {results.length > 0 && (
        <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto">
          {results.map((result) => (
            <li key={result.id} className="rounded-md border border-zinc-200 p-2">
              <p className="text-sm font-semibold text-zinc-900">{result.name}</p>
              <p className="text-xs text-zinc-500">{result.address}</p>
              <button
                type="button"
                onClick={() => handleAdd(result)}
                disabled={addingId === result.id || addedIds.has(result.id)}
                className={
                  addedIds.has(result.id)
                    ? "mt-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-60"
                    : "mt-1 rounded-md bg-zinc-900 px-2 py-1 text-xs font-semibold text-white hover:bg-zinc-700 disabled:opacity-60 disabled:cursor-not-allowed"
                }
              >
                {addedIds.has(result.id)
                  ? "Aggiunta ✓"
                  : addingId === result.id
                  ? "..."
                  : "Aggiungi alla mappa"}
              </button>
            </li>
          ))}
        </ul>
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
  const [selected, setSelected] = useState<Place | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [view, setView] = useState<ViewMode>("all");
  const [savedPlaces, setSavedPlaces] = useState<Place[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [pendingSavePlaceId, setPendingSavePlaceId] = useState<string | null>(null);
  const [pendingEditPlace, setPendingEditPlace] = useState<Place | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [selectedReviews, setSelectedReviews] = useState<{
    avg: number;
    count: number;
    items: ReviewItem[];
  } | null>(null);

  const availableTags = useMemo(() => {
    const seen = new Set<string>();
    for (const p of savedPlaces) {
      if (p.tags) for (const t of p.tags) seen.add(t);
    }
    return Array.from(seen);
  }, [savedPlaces]);

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
    const supabase = createClient();
    supabase
      .from("reviews")
      .select("user_id, rating, comment, created_at")
      .eq("place_id", selected.id)
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
  }, [selected?.id]);

  useEffect(() => {
    if (view !== "saved" || !userId) return;

    setLoadingSaved(true);
    const supabase = createClient();
    supabase
      .from("saved_places")
      .select("tags, note, places(id, name, category, lat, lng)")
      .eq("user_id", userId)
      .then(({ data, error }) => {
        setLoadingSaved(false);
        if (error) {
          console.error("Errore nel caricamento dei locali salvati:", error);
          return;
        }
        const fetched = (data ?? [])
          .map((row) => {
            const place = row.places as unknown as Place | null;
            if (!place || place.lat == null || place.lng == null) return null;
            return { ...place, tags: row.tags as string[] | null, note: row.note as string | null };
          })
          .filter((p): p is Place => p !== null);
        setSavedPlaces(fetched);
      });
  }, [view, userId]);

  const handleToggle = (placeId: string, saved: boolean) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (saved) {
        next.add(placeId);
      } else {
        next.delete(placeId);
      }
      return next;
    });
    if (!saved && view === "saved") {
      setSavedPlaces((prev) => prev.filter((p) => p.id !== placeId));
      setSelected(null);
    }
  };

  const handlePlaceAdded = (place: Place) => {
    setPlaces((prev) => (prev.some((p) => p.id === place.id) ? prev : [...prev, place]));
  };

  const displayedPlaces =
    view === "all"
      ? places
      : activeTag === null
        ? savedPlaces
        : savedPlaces.filter((p) => p.tags?.includes(activeTag));

  return (
    <div className="fixed inset-0 md:top-14">
      {/* Pannello controlli superiori: ricerca + switch impilati */}
      <div className="absolute top-4 left-4 z-10 flex w-80 max-w-[90vw] flex-col gap-2 pointer-events-none">
        <div className="pointer-events-auto">
          <SearchPanel userId={userId} onPlaceAdded={handlePlaceAdded} />
        </div>
        <div className="pointer-events-auto self-start flex rounded-lg overflow-hidden shadow-lg border border-zinc-200 bg-white">
          <button
            type="button"
            onClick={() => { setView("all"); setSelected(null); setActiveTag(null); }}
            className={
              view === "all"
                ? "px-4 py-2 text-sm font-semibold bg-zinc-900 text-white"
                : "px-4 py-2 text-sm font-semibold bg-white text-zinc-700 hover:bg-zinc-50"
            }
          >
            Tutti i locali
          </button>
          <button
            type="button"
            onClick={() => { setView("saved"); setSelected(null); }}
            className={
              view === "saved"
                ? "px-4 py-2 text-sm font-semibold bg-zinc-900 text-white"
                : "px-4 py-2 text-sm font-semibold bg-white text-zinc-700 hover:bg-zinc-50"
            }
          >
            I miei salvati
          </button>
        </div>
        {view === "saved" && availableTags.length > 0 && (
          <div className="pointer-events-auto flex flex-wrap gap-1.5 rounded-lg border border-zinc-200 bg-white p-2 shadow-lg">
            <button
              type="button"
              onClick={() => setActiveTag(null)}
              className={
                activeTag === null
                  ? "rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white"
                  : "rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-200"
              }
            >
              Tutti
            </button>
            {availableTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTag(tag)}
                className={
                  activeTag === tag
                    ? "rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white"
                    : "rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-200"
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
          <div className="bg-white rounded-xl shadow-lg p-6 text-center max-w-xs pointer-events-auto">
            <p className="text-2xl mb-2">🔒</p>
            <p className="text-zinc-800 font-semibold">Accesso richiesto</p>
            <p className="mt-1 text-sm text-zinc-500">
              Accedi per vedere la tua mappa personale
            </p>
            <a
              href="/login"
              className="mt-4 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700"
            >
              Accedi
            </a>
          </div>
        </div>
      )}

      {/* Spinner caricamento salvati */}
      {view === "saved" && userId && loadingSaved && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="bg-white rounded-lg shadow px-4 py-2 text-sm text-zinc-600">
            Caricamento...
          </div>
        </div>
      )}

      <Map
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{
          longitude: 12.4964,
          latitude: 41.9028,
          zoom: 11,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        onClick={() => setSelected(null)}
      >
        {displayedPlaces.map((place) => (
          <Marker
            key={place.id}
            longitude={place.lng}
            latitude={place.lat}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setSelected(place);
            }}
          >
            <span
              role="img"
              aria-label={place.category ?? "locale"}
              className="text-3xl leading-none cursor-pointer drop-shadow"
            >
              {getCategoryEmoji(place.category)}
            </span>
          </Marker>
        ))}

        {selected && (
          <Popup
            longitude={selected.lng}
            latitude={selected.lat}
            anchor="top"
            onClose={() => setSelected(null)}
            closeOnClick={false}
            maxWidth="210px"
          >
            <p className="text-sm font-semibold text-zinc-900">{selected.name}</p>
            <p className="text-xs text-zinc-500">{selected.category}</p>
            <div className="mt-2 border-t border-zinc-100 pt-2">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Recensioni
              </p>
              {selectedReviews ? (
                <>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-base font-semibold text-zinc-900">
                      {selectedReviews.avg.toLocaleString("it-IT", {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })}
                    </span>
                    <span className="text-amber-400 text-sm">
                      {"★".repeat(Math.round(selectedReviews.avg))}
                      <span className="text-zinc-300">
                        {"★".repeat(5 - Math.round(selectedReviews.avg))}
                      </span>
                    </span>
                    <span className="text-xs text-zinc-400">
                      su {selectedReviews.count}{" "}
                      {selectedReviews.count === 1 ? "recensione" : "recensioni"}
                    </span>
                  </div>
                  <ul className="mt-1.5 max-h-32 space-y-2 overflow-y-auto">
                    {selectedReviews.items.map((r, i) => (
                      <li key={i} className="text-xs">
                        <span className="text-amber-400">{"★".repeat(r.rating)}</span>
                        <span className="text-zinc-300">{"★".repeat(5 - r.rating)}</span>
                        {r.comment && (
                          <p className="mt-0.5 text-zinc-600">{r.comment}</p>
                        )}
                        <p className="text-zinc-400">
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
                <p className="text-xs text-zinc-400">Ancora nessuna recensione.</p>
              )}
              {userId ? (
                <ReviewForm
                  placeId={selected.id}
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
              ) : (
                <p className="mt-2 text-xs text-zinc-400">
                  <a href="/login" className="underline hover:text-zinc-700">
                    Accedi
                  </a>{" "}
                  per lasciare una recensione.
                </p>
              )}
            </div>
            {selected.tags && selected.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {selected.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {selected.note && (
              <p className="mt-1.5 text-xs text-zinc-500 italic">{selected.note}</p>
            )}
            {view === "saved" && (
              <button
                type="button"
                onClick={() => setPendingEditPlace(selected)}
                className="mt-2 rounded-md border border-zinc-300 px-3 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
              >
                Modifica
              </button>
            )}
            <SaveButton
              placeId={selected.id}
              userId={userId}
              isSaved={savedIds.has(selected.id)}
              onToggle={handleToggle}
              onSaveRequest={(placeId) => setPendingSavePlaceId(placeId)}
            />
          </Popup>
        )}
      </Map>

      {pendingSavePlaceId && userId && (
        <SaveModal
          placeId={pendingSavePlaceId}
          userId={userId}
          onSaved={() => {
            handleToggle(pendingSavePlaceId!, true);
            setPendingSavePlaceId(null);
          }}
          onCancel={() => setPendingSavePlaceId(null)}
        />
      )}

      {pendingEditPlace && userId && (
        <SaveModal
          placeId={pendingEditPlace.id}
          userId={userId}
          mode="edit"
          initialTags={pendingEditPlace.tags ?? []}
          initialNote={pendingEditPlace.note ?? ""}
          onSaved={(tags, note) => {
            const updated = { ...pendingEditPlace, tags, note };
            setSavedPlaces((prev) =>
              prev.map((p) => (p.id === pendingEditPlace.id ? updated : p))
            );
            setSelected((prev) =>
              prev?.id === pendingEditPlace.id ? updated : prev
            );
            setPendingEditPlace(null);
          }}
          onCancel={() => setPendingEditPlace(null)}
        />
      )}
    </div>
  );
}
