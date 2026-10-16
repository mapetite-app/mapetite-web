"use client";

import dynamic from "next/dynamic";
import type { SerataStop } from "./serata-mappa";

// La mappa (mapbox, pesante) si scarica solo nel browser e solo quando c'è una serata.
const SerataMappa = dynamic(() => import("./serata-mappa"), {
  ssr: false,
  loading: () => <div aria-hidden className="h-full w-full animate-pulse rounded-card bg-surface" />,
});

export type { SerataStop };

export default function SerataMappaLazy({ stops, className }: { stops: SerataStop[]; className?: string }) {
  return <SerataMappa stops={stops} className={className} />;
}
