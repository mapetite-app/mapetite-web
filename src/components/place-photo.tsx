"use client";

import { useState, type ReactNode } from "react";

// Le foto Google si pagano a richiesta (quota 200/giorno, finita già a metà mattina del 15/10).
// Due sprechi evitati qui, senza salvare niente sui nostri server (i termini Google lo vietano):
// 1) una sola misura per tutte le viste: card, lista e scheda dello stesso locale erano 2-3
//    richieste diverse (200, 500, 700, 800 px); ora una, poi la serve la cache del browser/CDN;
// 2) Google dà un riferimento foto NUOVO a ogni ricerca: si ricorda nel telefono, per 7 giorni
//    (quanto dura la cache della risposta), il primo indirizzo visto per quel locale e si riusa.
const PHOTO_WIDTH = 720;
const KEY = "mapetite.foto";
const TTL = 7 * 24 * 3600 * 1000;
type Seen = Record<string, { u: string; t: number }>;

let memo: Seen | null = null;
function seen(): Seen {
  if (memo) return memo;
  memo = {};
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Seen;
    const now = Date.now();
    for (const [k, v] of Object.entries(raw)) if (v && typeof v.u === "string" && now - v.t < TTL) memo[k] = v;
  } catch { /* storage non disponibile: si ricorda solo in questa pagina */ }
  return memo;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(memo ?? {})); } catch { /* storage pieno o non disponibile */ }
}
function placeOf(ref: string): string | null {
  return /^places\/([^/]+)\/photos\//.exec(ref)?.[1] ?? null;
}
function urlFor(ref: string): string {
  return `/api/places/photo?ref=${encodeURIComponent(ref)}&w=${PHOTO_WIDTH}`;
}
// Indirizzo da usare per questo riferimento: quello già visto per lo stesso locale, se c'è.
export function photoUrl(ref: string): string {
  const place = placeOf(ref);
  if (!place) return urlFor(ref);
  const s = seen();
  const hit = s[place];
  if (hit) return hit.u;
  s[place] = { u: urlFor(ref), t: Date.now() };
  save();
  return s[place].u;
}
function forget(ref: string) {
  const place = placeOf(ref);
  if (!place || !memo?.[place]) return;
  delete memo[place];
  save();
}

// Foto Google tramite il nostro proxy in cache. Se manca o non carica
// (quota giornaliera, errore di rete) mostra il fallback (di solito l'emoji).
export default function PlacePhoto({
  photoRef,
  alt,
  className = "",
  fallback = null,
  priority = false,
  credit = null,
  creditClassName = "absolute bottom-2 right-3",
}: {
  photoRef: string | null | undefined;
  alt: string;
  className?: string;
  // Ignorata: una sola misura per tutte le viste (vedi sopra). Resta per non toccare i chiamanti.
  width?: number;
  fallback?: ReactNode;
  priority?: boolean;
  // Autore della foto (Google chiede di mostrarlo): solo se la foto c'è davvero. Prima il credito
  // restava sopra l'emoji anche quando la foto non arrivava (quota giornaliera finita).
  credit?: string | null;
  creditClassName?: string;
}) {
  // Primo tentativo: l'indirizzo già visto per il locale; se non carica (riferimento scaduto e
  // fuori dalla cache) si riprova una volta con il riferimento di questa ricerca.
  const [attempt, setAttempt] = useState<{ ref: string; n: number } | null>(null);
  if (!photoRef) return <>{fallback}</>;
  const n = attempt?.ref === photoRef ? attempt.n : 0;
  if (n >= 2) return <>{fallback}</>;
  // Le pagine disegnate dal server (priority) usano sempre il riferimento: il server non vede la
  // memoria del telefono e un indirizzo diverso darebbe un errore di idratazione.
  const src = n === 0 && !priority ? photoUrl(photoRef) : urlFor(photoRef);
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={src}
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onError={() => {
          // Al secondo tentativo solo se l'indirizzo ricordato era diverso da quello di oggi.
          const retry = n === 0 && src !== urlFor(photoRef);
          if (retry) forget(photoRef);
          setAttempt({ ref: photoRef, n: retry ? 1 : 2 });
        }}
        className={className}
      />
      {credit && (
        <span className={`${creditClassName} rounded-pill bg-black/45 px-2 py-0.5 text-[10px] font-sans text-white`}>Foto: {credit}</span>
      )}
    </>
  );
}
