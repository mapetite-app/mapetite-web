"use client";

import { useRef, useState } from "react";
import { getCategoryEmoji } from "@/lib/emoji";
import type { Place } from "@/app/mappa/map-view";

export interface BottomSheetProps {
  places: Place[];
  onSelect: (place: Place) => void;
  onClose: () => void;
}

export default function BottomSheet({ places, onSelect, onClose }: BottomSheetProps) {
  const [snap, setSnap] = useState<"compact" | "medium" | "tall">("medium");
  const snapMaxHeight = snap === "compact" ? "25vh" : snap === "tall" ? "75vh" : "45vh";
  const cycleSnap = () => setSnap((s) => s === "compact" ? "medium" : s === "medium" ? "tall" : "compact");
  const contentRef = useRef<HTMLDivElement>(null);

  if (places.length === 0) return null;

  return (
    <div
      className="pointer-events-auto absolute bottom-0 left-0 right-0 mx-auto max-w-2xl z-10 flex flex-col overflow-hidden rounded-t-card bg-surface shadow-float"
      style={{ maxHeight: snapMaxHeight }}
    >
      <button
        type="button"
        onClick={cycleSnap}
        className="flex w-full cursor-pointer items-center justify-center bg-surface py-2"
      >
        <div className="h-1 w-10 rounded-pill bg-border" />
      </button>
      <div ref={contentRef} className="flex-1 overflow-y-auto px-3 pb-4">
        <div className="flex items-center justify-between px-1 pb-2">
          <p className="text-xs font-sans text-text-muted">
            {places.length} {places.length === 1 ? "risultato" : "risultati"}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi lista"
            className="text-text-muted hover:text-text text-lg leading-none px-1"
          >
            ✕
          </button>
        </div>
        <ul className="flex flex-col gap-1">
          {places.map((place) => (
            <li key={place.id}>
              <button
                type="button"
                onClick={() => onSelect(place)}
                className="flex w-full items-start gap-3 rounded-btn px-2 py-2.5 text-left hover:bg-brand/5"
              >
                <span className="text-xl leading-none">
                  {getCategoryEmoji(place.category, place.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-display font-semibold text-text">
                    {place.name}
                  </span>
                  {place.address && (
                    <span className="block truncate text-xs font-sans text-text-muted">
                      {place.address}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
