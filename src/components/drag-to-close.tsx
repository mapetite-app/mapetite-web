"use client";

import { useRef, useState, type ReactNode } from "react";

// Contenitore della scheda: trascinando verso il basso (con la scheda già in cima)
// la scheda segue il dito e, oltre 110px, si chiude, come i fogli di iOS.
export default function DragToClose({ onClose, className, children }: { onClose: () => void; className: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const start = useRef<{ y: number; active: boolean } | null>(null);
  const [dy, setDyState] = useState(0);
  // il valore corrente serve subito al rilascio, anche prima del nuovo render
  const dyRef = useRef(0);
  const setDy = (v: number) => { dyRef.current = v; setDyState(v); };
  // durante il trascinamento niente animazione: la scheda segue il dito
  const [dragging, setDragging] = useState(false);

  return (
    <div
      ref={ref}
      data-testid="scheda-trascinabile"
      className={className}
      style={{ transform: dy > 0 ? `translateY(${dy}px)` : undefined, transition: dragging ? "none" : "transform 200ms ease-out" }}
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => {
        // solo se la scheda è già scorsa in cima: altrimenti è uno scroll normale
        const active = (ref.current?.scrollTop ?? 0) <= 0;
        start.current = { y: e.touches[0].clientY, active };
        setDragging(active);
      }}
      onTouchMove={(e) => {
        const s = start.current;
        if (!s?.active) return;
        const d = e.touches[0].clientY - s.y;
        if (d > 0) setDy(d);
        else if (dyRef.current !== 0) setDy(0);
      }}
      onTouchEnd={() => {
        const close = dyRef.current > 110;
        start.current = null;
        setDragging(false);
        setDy(0);
        if (close) onClose();
      }}
    >
      {/* maniglia: fa capire che si può trascinare */}
      <div aria-hidden className="pointer-events-none sticky top-0 z-20 -mb-4 flex h-4 justify-center pt-1.5 lg:hidden">
        <span className="h-1 w-10 rounded-pill bg-white/80 shadow-card" />
      </div>
      {children}
    </div>
  );
}
