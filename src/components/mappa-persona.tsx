"use client";

import Link from "next/link";
import Map, { Marker } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { getCategoryEmoji } from "@/lib/emoji";

// Mappa dei posti di una persona (profilo pubblico e /u/<handle>/mappa): pin con l'emoji del
// tipo di locale, corallo se "Ci sono stato", teal se "Da provare". Tocco sul pin: la
// pagina pubblica del locale. Si carica solo nel browser (mappa-persona-lazy.tsx).

export type MapSpot = { id: string; name: string; category: string | null; lat: number; lng: number; visited: boolean };

function bounds(spots: MapSpot[]): [[number, number], [number, number]] {
  const lats = spots.map((s) => s.lat);
  const lngs = spots.map((s) => s.lng);
  const pad = spots.length === 1 ? 0.01 : 0.002;
  return [
    [Math.min(...lngs) - pad, Math.min(...lats) - pad],
    [Math.max(...lngs) + pad, Math.max(...lats) + pad],
  ];
}

export default function MappaPersona({ spots, className = "" }: { spots: MapSpot[]; className?: string }) {
  if (spots.length === 0) return null;
  return (
    <div data-testid="mappa-persona" className={`relative overflow-hidden rounded-card border border-border bg-surface ${className}`}>
      <Map
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{ bounds: bounds(spots), fitBoundsOptions: { padding: 36, maxZoom: 15 } }}
        style={{ width: "100%", height: "100%", isolation: "isolate" }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        language="it"
        attributionControl={false}
        cooperativeGestures
      >
        {spots.map((s) => (
          <Marker key={s.id} longitude={s.lng} latitude={s.lat} anchor="bottom">
            <Link
              href={`/locali/${s.id}`}
              aria-label={s.name}
              data-testid="pin-persona"
              className={`flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-lg shadow-float ${s.visited ? "bg-accent" : "bg-brand"}`}
            >
              {getCategoryEmoji(s.category, s.name)}
            </Link>
          </Marker>
        ))}
      </Map>
    </div>
  );
}
