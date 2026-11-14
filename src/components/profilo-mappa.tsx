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

// Mappa senza nomi (revisore 14/11, sesto giro: "Colosseum", "Vatican City" in inglese). Tre immagini uguali tranne
// un livello di nomi spento in ciascuna (src/lib/mappa-statica.ts, SENZA_NOMI). Per ogni punto un nome scuro è più
// scuro della mappa e il suo alone bianco più chiaro: si tiene il valore della mappa con
// max(min delle tre, min(max delle tre, colore della terra)). Così sparisce sia il testo (c'è un'immagine senza)
// sia l'alone; solo dove un nome tagliava una strada resta un'ombra leggerissima del colore della terra.
// Solo darken/lighten: le fusioni più vecchie, che anche Safari su iPhone fa bene.
const TERRA = "bg-[#f8f8f8]"; // colore della terra nello stile light-v11 (misurato: 247-248)
const STRATO = "absolute inset-0 isolate";
function ImmagineSenzaNomi({ urls, onLoad, onError, eager, className }: { urls: string[]; onLoad: () => void; onError: () => void; eager: boolean; className: string }) {
  const img = (u: string, k: string, blend = "") => (
    // eslint-disable-next-line @next/next/no-img-element -- immagine statica Mapbox, già alla dimensione giusta
    <img key={k} src={u} alt="" loading={eager ? "eager" : "lazy"} onLoad={onLoad} onError={onError} className={`absolute inset-0 h-full w-full object-cover ${blend}`} />
  );
  return (
    <span data-testid="mappa-senza-nomi" className={`${STRATO} ${className}`}>
      <span className={STRATO}>{urls.map((u, i) => img(u, `min${i}`, i ? "mix-blend-darken" : ""))}</span>
      <span className={`${STRATO} mix-blend-lighten`}>
        <span className={STRATO}>{urls.map((u, i) => img(u, `max${i}`, i ? "mix-blend-lighten" : ""))}</span>
        <span className={`absolute inset-0 ${TERRA} mix-blend-darken`} />
      </span>
    </span>
  );
}

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
  minPunti = 1,
  children = null,
  max = 12,
  senzaNomi = false,
  evita,
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
  minPunti?: number; // sotto questo numero di puntini niente mappa (copertine delle raccolte: 3, revisore 14/11)
  children?: React.ReactNode; // sopra la mappa, solo se la mappa c'è (il tondo con l'emoji della raccolta)
  max?: number; // quanti puntini al massimo (copertine 12, mappa del profilo 30)
  senzaNomi?: boolean; // tre immagini composte per togliere i nomi in inglese (solo la mappa grande del profilo)
  evita?: { x: number; y: number }; // angolo in basso a destra (in %) coperto da un pulsante: lì niente puntini
}) {
  const [rotta, setRotta] = useState(false);
  const [pronta, setPronta] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  // Le posizioni dei puntini non dipendono dal token: si calcolano sempre, l'immagine solo se c'è il token.
  const geo = useMemo(() => mappaStatica(punti, w, h, token || "-", margine, raggio, false, "citta", { max, senzaNomi }), [punti, w, h, token, margine, raggio, max, senzaNomi]);
  const vista = useMemo(() => nucleo(punti, raggio).slice(0, max), [punti, raggio, max]); // geo.punti[].i punta qui
  // Revisore 14/11 (sesto giro): niente puntini sotto la pillola "Mappa" (come le copertine dei Salvati).
  const visibili = useMemo(() => geo?.punti.filter((pt) => !evita || pt.x < evita.x || pt.y < evita.y) ?? [], [geo, evita]);
  // Pronta quando tutte le immagini sono arrivate (una, o le sei della mappa senza nomi).
  const verifica = () => {
    const imgs = [...(box.current?.querySelectorAll("img") ?? [])];
    if (imgs.some((el) => el.complete && el.naturalWidth === 0)) setRotta(true);
    else if (imgs.length > 0 && imgs.every((el) => el.complete)) setPronta(true);
  };
  // Arrivate prima che la pagina diventi interattiva: onLoad non scatta più, si controlla qui.
  useEffect(verifica, []);
  if (!geo || visibili.length < minPunti) return null;
  const fade = `transition-opacity duration-200 ${pronta ? "opacity-100" : "opacity-0"}`;
  return (
    <span ref={box} data-testid={testId} className={`absolute inset-0 overflow-hidden ${PAPER}`}>
      {token && !rotta && (geo.senzaNomi ? (
        <ImmagineSenzaNomi urls={geo.senzaNomi} eager={eager} onLoad={verifica} onError={() => setRotta(true)} className={fade} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- immagine statica Mapbox, già alla dimensione giusta
        <img src={geo.url} alt="" loading={eager ? "eager" : "lazy"} onLoad={() => setPronta(true)} onError={() => setRotta(true)} className={`absolute inset-0 h-full w-full object-cover ${fade}`} />
      ))}
      {visibili.map((pt, i) => (
        <span
          key={i}
          data-testid={dotTestId}
          className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-white shadow-[0_0_0_0.5px_rgba(0,0,0,0.15)] ${dot} ${vista[pt.i]?.visited === false ? "bg-brand" : "bg-accent"}`}
          style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
        />
      ))}
      {children}
    </span>
  );
}

const W = 358;
const H = 140;
// La pillola "↗ Mappa" in basso a destra (circa 92×32 px a 8 px dal bordo): a 328 px di larghezza (telefono da 360)
// copre da x ≈ 69% e y ≈ 62% in giù; con un po' di margine per il puntino.
const EVITA_PILLOLA = { x: 66, y: 58 };

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
        <MappaPunti punti={spots} w={W} h={H} dot="h-[11px] w-[11px] border-2" eager testId="profilo-mappa" dotTestId="profilo-mappa-puntino" raggio={5_000} max={30} senzaNomi evita={EVITA_PILLOLA} />
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
