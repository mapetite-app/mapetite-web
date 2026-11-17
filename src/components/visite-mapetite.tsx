"use client";

import { useEffect, useState } from "react";
import { fraseSpesa } from "@/lib/spesa-testa";
import { leggiInfoLocale } from "@/components/posto-locale";
import { leggiSpesa } from "@/lib/spesa-testa-write";

// "👍 4 su 5 · chi c'è stato" (PROBLEMI.md 3): persone vere che hanno segnato "Ci sono
// stato" e detto com'era. Solo da 5 voti in su (lo decide il server); altrimenti niente.
type Visite = { persone: number; piaciuto: number };

// Proposta 64 (revisori 17/11): una sola pillola "chi c'è stato" con voti e spesa a testa insieme
// ("👍 5 su 6 · 15–30 € a testa · chi c'è stato"). Revisore 4 (17/11): la spesa di chi c'è stato resta ANCHE quando il
// locale dichiara il suo prezzo: la parola di parte non deve mai nascondere quella indipendente (VISIONE.md).
// Si disegna solo quando sono arrivate tutte e tre le risposte (voti, spesa, info del locale): niente lampi né cambi di colore.
export default function VisiteMapetite({ venueId, spesaId }: { venueId: string; spesaId?: string }) {
  const idSpesa = spesaId ?? venueId;
  const chiave = `${venueId}|${idSpesa}`;
  const [dati, setDati] = useState<{ k: string; v: Visite | null; spesa: string | null } | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    let vivo = true;
    const visite = fetch(`/api/places/visite?id=${encodeURIComponent(venueId)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<Visite | null>) : null))
      .then((j) => (j && j.persone >= 5 ? j : null))
      .catch(() => null /* senza rete: niente riga */);
    const spesa = leggiSpesa(idSpesa).catch(() => null);
    const info = leggiInfoLocale(idSpesa).catch(() => null);
    void Promise.all([visite, spesa, info]).then(([v, sp, inf]) => {
      if (!vivo) return;
      void inf; // si aspetta anche l'info del locale: la pillola arriva insieme al riquadro del titolare, senza lampi
      setDati({ k: chiave, v, spesa: fraseSpesa(sp, true) });
    });
    return () => { vivo = false; ctrl.abort(); };
  }, [venueId, idSpesa, chiave]);
  if (!dati || dati.k !== chiave) return null;
  const { v, spesa } = dati;
  if (!v && !spesa) return null;
  return (
    <p data-testid={v ? "visite-mapetite" : "spesa-chi-ce-stato"} className={`inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-xs font-display font-semibold ${v ? "bg-accent-light text-accent" : "bg-brand/10 text-brand"}`}>
      {v ? `👍 ${v.piaciuto} su ${v.persone} · ` : "👥 "}
      {spesa && <><span data-testid="spesa-vissuta">{spesa}</span>{" · "}</>}
      chi c&apos;è stato
    </p>
  );
}
