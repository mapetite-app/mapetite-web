"use client";

import { useState } from "react";
import Map, { Marker, Popup } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

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

export default function MapView({ places }: { places: Place[] }) {
  const [selected, setSelected] = useState<Place | null>(null);

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
          </Popup>
        )}
      </Map>
    </div>
  );
}
