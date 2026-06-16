"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Map, { Marker, Popup } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { createClient } from "@/lib/supabase/client";

const PRESET_TAGS = ["Da provare", "Già visitato", "Romantico", "Economico", "Speciale", "Con amici"];

function SaveModal({
  placeId,
  userId,
  onSaved,
  onCancel,
}: {
  placeId: string;
  userId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
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
      const { error } = await supabase.from("saved_places").insert({
        user_id: userId,
        place_id: placeId,
        tags: selectedTags.length > 0 ? selectedTags : null,
        note: note.trim() || null,
      });

      if (error && error.code !== "23505") {
        setError(true);
        return;
      }
      onSaved();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-80 max-w-[90vw] rounded-xl bg-white p-5 shadow-xl">
        <h2 className="mb-3 text-base font-semibold text-zinc-900">Salva locale</h2>

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

type Place = {
  id: string;
  name: string;
  category: string | null;
  lat: number;
  lng: number;
  tags: string[] | null;
  note: string | null;
};

const CATEGORY_EMOJI: Record<string, string> = {
  pizzeria: "🍕",
  ristorante: "🍝",
  trattoria: "🍝",
  osteria: "🍝",
  bar: "☕",
  caffè: "☕",
  caffetteria: "☕",
  sushi: "🍣",
  enoteca: "🍷",
};

function getCategoryEmoji(category: string | null): string {
  if (!category) return "📍";

  const normalized = category.toLowerCase();
  for (const [key, emoji] of Object.entries(CATEGORY_EMOJI)) {
    if (normalized.includes(key)) return emoji;
  }

  return "📍";
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

  const displayedPlaces = view === "all" ? places : savedPlaces;

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
            onClick={() => { setView("all"); setSelected(null); }}
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
          >
            <p className="font-semibold text-zinc-900">{selected.name}</p>
            <p className="text-sm text-zinc-500">{selected.category}</p>
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
            handleToggle(pendingSavePlaceId, true);
            setPendingSavePlaceId(null);
          }}
          onCancel={() => setPendingSavePlaceId(null)}
        />
      )}
    </div>
  );
}
