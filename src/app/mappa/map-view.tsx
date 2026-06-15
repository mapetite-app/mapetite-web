"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Map, { Marker, Popup } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { createClient } from "@/lib/supabase/client";

type Place = {
  id: string;
  name: string;
  category: string | null;
  lat: number;
  lng: number;
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
}: {
  placeId: string;
  userId: string | null;
  isSaved: boolean;
  onToggle: (placeId: string, saved: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  const handleClick = () => {
    if (!userId) {
      router.push("/login");
      return;
    }

    setError(false);
    startTransition(async () => {
      const supabase = createClient();

      if (isSaved) {
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
      } else {
        const { error } = await supabase
          .from("saved_places")
          .insert({ user_id: userId, place_id: placeId });

        // 23505 = unique_violation: il locale era già salvato
        if (error && error.code !== "23505") {
          setError(true);
          return;
        }
        onToggle(placeId, true);
      }
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

export default function MapView({
  places,
  userId,
}: {
  places: Place[];
  userId: string | null;
}) {
  const [selected, setSelected] = useState<Place | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

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
  };

  return (
    <div className="fixed inset-0">
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
        {places.map((place) => (
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
            <SaveButton
              placeId={selected.id}
              userId={userId}
              isSaved={savedIds.has(selected.id)}
              onToggle={handleToggle}
            />
          </Popup>
        )}
      </Map>
    </div>
  );
}
