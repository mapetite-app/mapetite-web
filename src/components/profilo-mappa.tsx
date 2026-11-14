"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Maximize2 } from "lucide-react";
import { mappaStatica, nucleo } from "@/lib/mappa-statica";

// Mappa statica dei posti di una persona (revisore 14/11: "la mappa dell'amico sta in fondo"): è l'immagine
// principale del profilo, subito sotto Segui/Condividi, come la copertina degli scaffali nei Salvati. Immagine
// Mapbox (nessun costo Google) e puntini disegnati da noi: corallo i provati, teal i da provare. Se l'immagine
// non arriva (rete, token) restano i puntini su fondo carta: la forma della sua città si capisce lo stesso.

export type PuntoPersona = { lat: number; lng: number; visited?: boolean };

const PAPER = "bg-[#eef1f0]";

export function MappaPunti({
  punti,
  w,
  h,
  dot = "h-[7px] w-[7px] border-[1.5px]",
  testId,
  dotTestId,
  eager = false,
  margine = 16,
  raggio,
}: {
  punti: readonly PuntoPersona[];
  w: number;
  h: number;
  dot?: string;
  testId?: string;
  dotTestId?: string;
  eager?: boolean; // la mappa del profilo è sopra la piega: si carica subito
  margine?: number; // spazio attorno ai puntini (px), perché nessuno finisca sotto un badge
  raggio?: number; // quanto può essere largo il gruppo (m); la mappa grande ne tiene di più delle copertine
}) {
  const [rotta, setRotta] = useState(false);
  const [pronta, setPronta] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // Arrivata prima che la pagina diventi interattiva: onLoad non scatta più, si controlla qui.
  useEffect(() => {
    const el = img.current;
    if (el?.complete) { if (el.naturalWidth > 0) setPronta(true); else setRotta(true); }
  }, []);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  // Le posizioni dei puntini non dipendono dal token: si calcolano sempre, l'immagine solo se c'è il token.
  const geo = useMemo(() => mappaStatica(punti, w, h, token || "-", margine, raggio), [punti, w, h, token, margine, raggio]);
  const vista = useMemo(() => nucleo(punti, raggio).slice(0, 12), [punti, raggio]); // geo.punti[].i punta qui
  if (!geo) return null;
  return (
    <span data-testid={testId} className={`absolute inset-0 overflow-hidden ${PAPER}`}>
      {token && !rotta && (
        // eslint-disable-next-line @next/next/no-img-element -- immagine statica Mapbox, già alla dimensione giusta
        <img ref={img} src={geo.url} alt="" loading={eager ? "eager" : "lazy"} onLoad={() => setPronta(true)} onError={() => setRotta(true)} className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${pronta ? "opacity-100" : "opacity-0"}`} />
      )}
      {geo.punti.map((pt, i) => (
        <span
          key={i}
          data-testid={dotTestId}
          className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-white shadow-[0_0_0_0.5px_rgba(0,0,0,0.15)] ${dot} ${vista[pt.i]?.visited === false ? "bg-brand" : "bg-accent"}`}
          style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
        />
      ))}
    </span>
  );
}

const W = 358;
const H = 140;

export default function ProfiloMappa({ spots, href, name }: { spots: PuntoPersona[]; href: string; name: string }) {
  if (spots.length === 0) return null;
  const provati = spots.some((s) => s.visited);
  const daProvare = spots.some((s) => !s.visited);
  return (
    <section className="mt-4" aria-label={`La mappa di ${name}`}>
      <Link
        href={href}
        data-testid="apri-mappa-persona"
        aria-label={`Apri la mappa di ${name}`}
        className="relative block overflow-hidden rounded-card border border-border shadow-card active:scale-[0.99] transition-transform duration-150"
        style={{ aspectRatio: `${W} / ${H}` }}
      >
        <MappaPunti punti={spots} w={W} h={H} dot="h-[11px] w-[11px] border-2" eager testId="profilo-mappa" dotTestId="profilo-mappa-puntino" raggio={5_000} />
        <span className="absolute bottom-2 right-2 inline-flex min-h-8 items-center gap-1.5 rounded-pill bg-white/95 px-3 text-[13px] font-display font-semibold text-brand shadow-[0_1px_4px_rgba(0,0,0,0.15)]">
          <Maximize2 size={13} aria-hidden /> Mappa
        </span>
      </Link>
      <p className="mt-1.5 flex items-center gap-3 text-[11px] font-sans text-text-muted">
        {provati && <span className="inline-flex items-center gap-1"><span aria-hidden className="h-2 w-2 rounded-full bg-accent" /> Provati</span>}
        {daProvare && <span className="inline-flex items-center gap-1"><span aria-hidden className="h-2 w-2 rounded-full bg-brand" /> Da provare</span>}
        {process.env.NEXT_PUBLIC_MAPBOX_TOKEN && <span data-testid="profilo-mappa-attribuzione" className="ml-auto text-[10px] text-text-muted/80">© Mapbox © OpenStreetMap</span>}
      </p>
    </section>
  );
}
