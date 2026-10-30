"use client";

import { useEffect, useState } from "react";
import { frasePosto } from "@/lib/serate";
import { fraseApertura } from "@/lib/aperto-dal";

// Parola del titolare nella scheda (POSIZIONAMENTO.md: "al massimo un badge e una riga"):
// se il titolare l'ha detto, "🌙 Martedì c'è posto". Solo locali verificati; per tutti gli altri
// non compare niente (nemmeno uno spazio vuoto). Dati da /api/ristoratore/serate.
// Il badge "Verificato" non sta qui: la scheda lo mette come spunta accanto al nome (Semplificare,
// 20/10), la pagina pubblica del locale ha il suo.
export type InfoLocale = { verificato: boolean; giorni: number[]; at: string | null; apertoDal?: string | null; omaggio?: { testo?: unknown; soglia?: unknown } | null };

// Una sola richiesta per locale anche se la scheda la chiede da più punti (pillole e omaggio):
// la risposta resta in memoria 60 secondi, poi si rilegge (il titolare può averla cambiata).
const cache = new Map<string, { at: number; p: Promise<InfoLocale | null> }>();

export function leggiInfoLocale(venueId: string): Promise<InfoLocale | null> {
  const c = cache.get(venueId);
  if (c && Date.now() - c.at < 60_000) return c.p;
  const p = fetch(`/api/ristoratore/serate?id=${encodeURIComponent(venueId)}`)
    .then((r) => (r.ok ? (r.json() as Promise<InfoLocale>) : null))
    .then((j) => (j?.verificato ? j : null))
    .catch(() => { cache.delete(venueId); return null; /* senza rete: niente riga */ });
  cache.set(venueId, { at: Date.now(), p });
  return p;
}

/** Info del titolare per un locale (UUID o Place ID Google); null finché non arriva o se non è verificato. */
export function useInfoLocale(venueId: string): InfoLocale | null {
  const [info, setInfo] = useState<{ id: string; info: InfoLocale | null } | null>(null);

  useEffect(() => {
    let vivo = true;
    leggiInfoLocale(venueId).then((j) => { if (vivo) setInfo({ id: venueId, info: j }); });
    return () => { vivo = false; };
  }, [venueId]);

  // Scheda passata a un altro locale: niente dati del precedente.
  return info?.id === venueId ? info.info : null;
}

/** Pillola "🌙 … c'è posto · dice il locale", o niente. */
export function PostoPillola({ info }: { info: InfoLocale | null }) {
  const posto = frasePosto(info);
  if (!posto) return null;
  return (
    <span data-testid="posto-stasera" className="inline-flex items-center gap-1 rounded-pill bg-accent-light px-2.5 py-0.5 text-xs font-display font-semibold text-accent">
      🌙 {posto}
      <span className="font-sans font-normal text-text-muted">· dice il locale</span>
    </span>
  );
}

/** Pillola "🆕 Aperto da 3 mesi" (parola del titolare verificato, primo anno), o niente. */
export function AperturaPillola({ info }: { info: InfoLocale | null }) {
  const f = info?.verificato ? fraseApertura(info.apertoDal) : null;
  if (!f) return null;
  return (
    <span data-testid="aperto-da-poco" className="inline-flex items-center gap-1 rounded-pill bg-brand/10 px-2.5 py-0.5 text-xs font-display font-semibold text-brand">
      <span aria-hidden>🆕</span> {f}
    </span>
  );
}

export default function PostoLocale({ venueId }: { venueId: string }) {
  const info = useInfoLocale(venueId);
  if (!frasePosto(info)) return null;
  return (
    <p data-testid="posto-locale" className="mt-2 flex flex-wrap items-center gap-1.5">
      <PostoPillola info={info} />
    </p>
  );
}
