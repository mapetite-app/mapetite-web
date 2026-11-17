"use client";

import { useEffect, useState } from "react";
import { fraseSpesa, type SpesaVissuta } from "@/lib/spesa-testa";
import { leggiSpesa } from "@/lib/spesa-testa-write";

// "👍 4 su 5 · chi c'è stato" (PROBLEMI.md 3): persone vere che hanno segnato "Ci sono
// stato" e detto com'era. Solo da 5 voti in su (lo decide il server); altrimenti niente.
type Visite = { persone: number; piaciuto: number };

// Proposta 64 (revisore 17/11): una sola pillola "chi c'è stato" con voti e spesa a testa insieme
// ("👍 5 su 6 · 15–30 € a testa · chi c'è stato"); la spesa sparisce se il locale dichiara il suo prezzo (niente due "€ a testa").
export default function VisiteMapetite({ venueId, spesaId, senzaSpesa = false }: { venueId: string; spesaId?: string; senzaSpesa?: boolean }) {
  const [v, setV] = useState<Visite | null>(null);
  const [sp, setSp] = useState<{ id: string; d: SpesaVissuta | null } | null>(null);
  const idSpesa = spesaId ?? venueId;
  useEffect(() => {
    let vivo = true;
    void leggiSpesa(idSpesa).then((d) => { if (vivo) setSp({ id: idSpesa, d }); });
    return () => { vivo = false; };
  }, [idSpesa]);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/places/visite?id=${encodeURIComponent(venueId)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Visite | null) => setV(j && j.persone >= 5 ? j : null))
      .catch(() => { /* senza rete: niente riga */ });
    return () => ctrl.abort();
  }, [venueId]);
  const spesa = !senzaSpesa && sp?.id === idSpesa ? fraseSpesa(sp.d, true) : null;
  if (!v && !spesa) return null;
  return (
    <p data-testid={v ? "visite-mapetite" : "spesa-chi-ce-stato"} className={`inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-xs font-display font-semibold ${v ? "bg-accent-light text-accent" : "bg-brand/10 text-brand"}`}>
      {v ? `👍 ${v.piaciuto} su ${v.persone} · ` : "👥 "}
      {spesa && <><span data-testid="spesa-vissuta">{spesa}</span>{" · "}</>}
      chi c&apos;è stato
    </p>
  );
}
