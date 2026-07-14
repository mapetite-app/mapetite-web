"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { getCategoryEmoji } from "@/lib/emoji";
import type { Place } from "@/app/mappa/map-view";

export interface BottomSheetProps {
  places: Place[];
  onSelect: (place: Place) => void;
  onClose: () => void;
}

// Snap points in dvh numerici (percentuali dell'altezza viewport).
const SNAPS = { compact: 25, medium: 45, tall: 75 } as const;
const ORDER = ["compact", "medium", "tall"] as const;
type SnapKey = keyof typeof SNAPS;

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

type DragState = {
  startY: number;
  startHeight: number;
  lastY: number;
  lastT: number;
  velocity: number; // px/ms, positiva = dito verso l'alto
  moved: boolean;
  fromContent: boolean; // il gesto è partito dalla lista scrollabile
};

export default function BottomSheet({ places, onSelect, onClose }: BottomSheetProps) {
  const [snap, setSnap] = useState<SnapKey>("medium");
  // Altezza in px imposta solo durante il drag; null = altezza controllata dallo snap.
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<DragState | null>(null);

  const cycleSnap = () =>
    setSnap((s) => ORDER[(ORDER.indexOf(s) + 1) % ORDER.length]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // Tap su un elemento interattivo (✕, voci lista): lascia passare il click,
    // non avviare il drag. L'handle è l'unica eccezione.
    const el = e.target as HTMLElement;
    const interactive = el.closest("button, a, input, [role='button']");
    if (interactive && !interactive.hasAttribute("data-drag-handle")) {
      return;
    }

    // Se il gesto parte dalla lista già scrollata, è uno scroll, non un drag.
    if (
      contentRef.current &&
      contentRef.current.contains(e.target as Node) &&
      contentRef.current.scrollTop > 0
    ) {
      return;
    }
    dragState.current = {
      startY: e.clientY,
      startHeight: sheetRef.current?.offsetHeight ?? 0,
      lastY: e.clientY,
      lastT: performance.now(),
      velocity: 0,
      moved: false,
      fromContent: contentRef.current?.contains(e.target as Node) ?? false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const ds = dragState.current;
    if (!ds) return;

    const dy = ds.startY - e.clientY; // dito in su = dy positivo = sheet cresce
    if (!ds.moved && Math.abs(dy) < 5) return; // soglia tap/drag
    if (!ds.moved) {
      if (ds.fromContent && dy < 0) {
        // trascinamento verso il basso partendo dalla lista: lascia scrollare
        dragState.current = null;
        return;
      }
      ds.moved = true;
    }

    const now = performance.now();
    const dt = now - ds.lastT;
    if (dt > 0) ds.velocity = (ds.lastY - e.clientY) / dt;
    ds.lastY = e.clientY;
    ds.lastT = now;

    const vh = window.innerHeight;
    const next = clamp(ds.startHeight + dy, vh * 0.15, vh * 0.92);
    setDragHeight(next);

    if (ds.moved) e.preventDefault();
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    setDragHeight(null);
    dragState.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const ds = dragState.current;
    if (!ds) return;

    // Nessun movimento: era un tap → lo snap lo gestisce onClick dell'handle.
    if (!ds.moved) {
      dragState.current = null;
      return;
    }

    const vh = window.innerHeight;
    const currentPct = ((dragHeight ?? ds.startHeight) / vh) * 100;

    let result: SnapKey;
    if (Math.abs(ds.velocity) > 0.5) {
      // Flick: vai allo snap successivo nella direzione del gesto,
      // partendo dallo snap di partenza.
      const startIdx = ORDER.indexOf(snap);
      const dir = ds.velocity > 0 ? 1 : -1;
      result = ORDER[clamp(startIdx + dir, 0, ORDER.length - 1)];
    } else {
      // Rilascio lento: snap più vicino alla percentuale corrente.
      result = ORDER.reduce((best, key) =>
        Math.abs(SNAPS[key] - currentPct) < Math.abs(SNAPS[best] - currentPct)
          ? key
          : best,
      ORDER[0]);
    }

    setSnap(result);
    endDrag(e);
  };

  const onPointerCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return;
    endDrag(e);
  };

  if (places.length === 0) return null;

  return (
    <div
      ref={sheetRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      className="pointer-events-auto absolute left-0 right-0 mx-auto max-w-2xl z-10 flex flex-col overflow-hidden rounded-t-card bg-surface shadow-float"
      style={{
        bottom: "var(--nav-height-mobile)",
        height: dragHeight !== null ? `${dragHeight}px` : `${SNAPS[snap]}dvh`,
        transition:
          dragHeight !== null ? "none" : "height 220ms cubic-bezier(0.32, 0.72, 0, 1)",
      }}
    >
      <button
        type="button"
        onClick={cycleSnap}
        aria-label="Cambia altezza pannello"
        data-drag-handle="true"
        className="flex w-full cursor-pointer items-center justify-center bg-surface py-2"
        style={{ touchAction: "none" }}
      >
        <div className="h-1 w-10 rounded-pill bg-border" />
      </button>
      <div
        ref={contentRef}
        className="flex-1 overflow-y-auto px-3 pb-4"
        style={{ touchAction: "pan-y" }}
      >
        <div className="flex items-center justify-between px-1 pb-2">
          <p className="text-xs font-sans text-text-muted">
            {places.length} {places.length === 1 ? "risultato" : "risultati"}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="-my-2 -mr-1 flex h-11 w-11 select-none touch-manipulation items-center justify-center text-lg leading-none text-text-muted hover:text-text"
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
