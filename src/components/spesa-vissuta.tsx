"use client";

import { useEffect, useState } from "react";
import { fraseSpesa, type SpesaVissuta as Dato } from "@/lib/spesa-testa";
import { leggiSpesa } from "@/lib/spesa-testa-write";

// Pillola della scheda "👥 15–30 € a testa · chi c'è stato" (PROPOSTE.md, proposta 64): la fascia più scelta da
// chi c'è stato, solo da 3 risposte in su; altrimenti niente. Separata dai € di Google e da "💶 … · dice il locale".
export default function SpesaVissuta({ venueId }: { venueId: string }) {
  const [d, setD] = useState<Dato | null>(null);
  useEffect(() => {
    let vivo = true;
    void leggiSpesa(venueId).then((r) => { if (vivo) setD(r); });
    return () => { vivo = false; };
  }, [venueId]);
  const f = fraseSpesa(d);
  if (!f) return null;
  return (
    <p data-testid="spesa-vissuta" className="inline-flex items-center gap-1 rounded-pill bg-brand/10 px-2.5 py-0.5 text-xs font-display font-semibold text-brand">
      👥 {f}
    </p>
  );
}
