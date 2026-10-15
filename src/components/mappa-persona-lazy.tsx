"use client";

import dynamic from "next/dynamic";
import type { MapSpot } from "./mappa-persona";

// La mappa (mapbox, pesante) si scarica solo nel browser e dopo il resto della pagina:
// chi apre un profilo condiviso vede subito nome, numeri e posti.
const MappaPersona = dynamic(() => import("./mappa-persona"), {
  ssr: false,
  loading: () => <div aria-hidden className="h-full w-full animate-pulse rounded-card bg-surface" />,
});

export type { MapSpot };

export default function MappaPersonaLazy({ spots, className }: { spots: MapSpot[]; className?: string }) {
  return <MappaPersona spots={spots} className={className} />;
}
