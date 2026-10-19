"use client";

import { useEffect, useState } from "react";
import { BadgeCheck } from "lucide-react";
import { frasePosto } from "@/lib/serate";

// Riga del titolare nella scheda (POSIZIONAMENTO.md: "al massimo un badge e una riga"):
// "✓ Verificato" e, se il titolare l'ha detto, "🌙 Martedì c'è posto". Solo locali verificati;
// per tutti gli altri non compare niente (nemmeno uno spazio vuoto). Dati da /api/ristoratore/serate.
// soloPosto: solo la riga del posto (la pagina pubblica del locale ha già il suo badge).
type Info = { verificato: boolean; giorni: number[]; at: string | null };

export default function PostoLocale({ venueId, soloPosto = false }: { venueId: string; soloPosto?: boolean }) {
  const [info, setInfo] = useState<Info | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/ristoratore/serate?id=${encodeURIComponent(venueId)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Info | null) => setInfo(j?.verificato ? j : null))
      .catch(() => { /* senza rete: niente riga */ });
    return () => ctrl.abort();
  }, [venueId]);

  if (!info) return null;
  const posto = frasePosto(info);
  if (soloPosto && !posto) return null;
  return (
    <p data-testid="posto-locale" className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-display font-semibold">
      {!soloPosto && (
        // Con "c'è posto" accanto basta la spunta (Semplificare, 20/10): una pillola in meno sotto il nome.
        <span className="inline-flex items-center gap-1 rounded-pill bg-brand/10 px-2.5 py-0.5 text-brand" title="Verificato dal titolare">
          <BadgeCheck size={13} aria-hidden />
          {posto ? <span className="sr-only">Verificato</span> : "Verificato"}
        </span>
      )}
      {posto && (
        <span data-testid="posto-stasera" className="inline-flex items-center gap-1 rounded-pill bg-accent-light px-2.5 py-0.5 text-accent">
          🌙 {posto}
          <span className="font-sans font-normal text-text-muted">· dice il locale</span>
        </span>
      )}
    </p>
  );
}
