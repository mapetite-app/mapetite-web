"use client";

import { useEffect, useState } from "react";

// "👍 4 su 5 che ci sono stati, su Mapetite" (PROBLEMI.md 3): persone vere che hanno segnato "Ci sono
// stato" e detto com'era. Solo da 3 persone in su (lo decide il server); altrimenti niente.
type Visite = { persone: number; piaciuto: number };

export default function VisiteMapetite({ venueId }: { venueId: string }) {
  const [v, setV] = useState<Visite | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/places/visite?id=${encodeURIComponent(venueId)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Visite | null) => setV(j && j.persone >= 3 ? j : null))
      .catch(() => { /* senza rete: niente riga */ });
    return () => ctrl.abort();
  }, [venueId]);
  if (!v) return null;
  return (
    <p data-testid="visite-mapetite" className="mt-2 inline-flex items-center gap-1 rounded-pill bg-accent-light px-2.5 py-0.5 text-xs font-display font-semibold text-accent">
      👍 {v.piaciuto} su {v.persone} che ci sono stati, su Mapetite
    </p>
  );
}
