"use client";

import Map, { Layer, Marker, Source } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

// Mini mappa della serata a tappe (piano 1.2): pin numerati nell'ordine delle tappe e la linea
// del percorso (in linea d'aria: il percorso vero lo calcola Google Maps). Si carica solo nel
// browser (serata-mappa-lazy.tsx).

export type SerataStop = { id: string; name: string; lat: number; lng: number };

function bounds(stops: SerataStop[]): [[number, number], [number, number]] {
  const lats = stops.map((s) => s.lat);
  const lngs = stops.map((s) => s.lng);
  const pad = stops.length === 1 ? 0.006 : 0.0015;
  return [
    [Math.min(...lngs) - pad, Math.min(...lats) - pad],
    [Math.max(...lngs) + pad, Math.max(...lats) + pad],
  ];
}

export default function SerataMappa({ stops, className = "" }: { stops: SerataStop[]; className?: string }) {
  if (stops.length === 0) return null;
  const line = {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "LineString" as const, coordinates: stops.map((s) => [s.lng, s.lat]) },
  };
  return (
    <div data-testid="serata-mappa" className={`relative overflow-hidden rounded-card border border-border bg-surface ${className}`}>
      <Map
        // Tappe cambiate (un'alternativa scelta): la mappa si ricentra.
        key={stops.map((s) => s.id).join()}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{ bounds: bounds(stops), fitBoundsOptions: { padding: 44, maxZoom: 17 } }}
        style={{ width: "100%", height: "100%", isolation: "isolate" }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        language="it"
        attributionControl={false}
        cooperativeGestures
      >
        {stops.length > 1 && (
          <Source id="serata-percorso" type="geojson" data={line}>
            <Layer id="serata-linea" type="line" layout={{ "line-cap": "round", "line-join": "round" }} paint={{ "line-color": "#1a3c40", "line-width": 3, "line-dasharray": [1.5, 1.5] }} />
          </Source>
        )}
        {stops.map((s, i) => (
          <Marker key={s.id} longitude={s.lng} latitude={s.lat} anchor="center">
            <span
              data-testid="serata-pin"
              aria-label={`Tappa ${i + 1}: ${s.name}`}
              className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-accent font-display text-sm font-bold text-white shadow-float"
            >
              {i + 1}
            </span>
          </Marker>
        ))}
      </Map>
    </div>
  );
}
