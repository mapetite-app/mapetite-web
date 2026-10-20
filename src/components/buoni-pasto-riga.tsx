"use client";

import { useEffect, useState } from "react";
import { buoniPertinenti, fraseBuoni, leggiBuoni, type ConteggioBuoni } from "@/lib/buoni-pasto";

// Riga della scheda "🎫 Buoni pasto: sì · 3 persone" (testo corto dal 20/10) (PROPOSTE.md 19/10): compare solo con
// almeno 2 risposte concordi di chi c'è stato; altrimenti niente (nemmeno uno spazio vuoto).
export default function BuoniPastoRiga({ venueId, category = null }: { venueId: string; category?: string | null }) {
  const [c, setC] = useState<ConteggioBuoni | null>(null);
  const pertinente = buoniPertinenti(category);
  useEffect(() => {
    if (!pertinente) return;
    let vivo = true;
    void leggiBuoni(venueId).then((r) => { if (vivo) setC(r); });
    return () => { vivo = false; };
  }, [venueId, pertinente]);
  const f = pertinente ? fraseBuoni(c) : null;
  if (!f) return null;
  return (
    <p data-testid="buoni-pasto" className="inline-flex items-center gap-1 rounded-pill bg-brand/10 px-2.5 py-0.5 text-xs font-display font-semibold text-brand">
      🎫 {f.testo}
    </p>
  );
}
