"use client";

import { useEffect, useState } from "react";
import { fraseBuoni, leggiBuoni, type ConteggioBuoni } from "@/lib/buoni-pasto";

// Riga della scheda "🎫 Buoni pasto: sì · lo dicono 3 persone" (PROPOSTE.md 19/10): compare solo con
// almeno 2 risposte concordi di chi c'è stato; altrimenti niente (nemmeno uno spazio vuoto).
export default function BuoniPastoRiga({ venueId }: { venueId: string }) {
  const [c, setC] = useState<ConteggioBuoni | null>(null);
  useEffect(() => {
    let vivo = true;
    void leggiBuoni(venueId).then((r) => { if (vivo) setC(r); });
    return () => { vivo = false; };
  }, [venueId]);
  const f = fraseBuoni(c);
  if (!f) return null;
  return (
    <p data-testid="buoni-pasto" className="inline-flex items-center gap-1 rounded-pill bg-brand/10 px-2.5 py-0.5 text-xs font-display font-semibold text-brand">
      🎫 {f.testo}
    </p>
  );
}
