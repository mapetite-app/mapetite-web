"use client";

import { useState, type ReactNode } from "react";
import PlacePhoto from "@/components/place-photo";

// Carosello in cima alla scheda del locale (piano 6.2, come Places).
// Foto Google: SOLO quelle che la scheda ha già (oggi una per locale, la stessa della card),
// mai richieste in più: la quota foto è 200/giorno e nessuna foto si salva sui nostri server.
// Seconda pagina: "dove si trova", una mappa statica Mapbox (nessun costo Google), caricata solo
// quando ci si arriva scorrendo; se non carica, la pagina sparisce.

const MAP_W = 600;
const MAP_H = 400;

function staticMapUrl(lat: number, lng: number): string | null {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const at = `${lng.toFixed(5)},${lat.toFixed(5)}`;
  return `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/pin-l+ff6b4a(${at})/${at},15,0/${MAP_W}x${MAP_H}@2x?access_token=${token}`;
}

export default function SchedaCarosello({
  photoRefs,
  name,
  credit,
  lat,
  lng,
  directionsUrl,
  onDirections,
  fallback,
  overlay,
}: {
  photoRefs: string[];
  name: string;
  credit: string | null | undefined;
  lat: number;
  lng: number;
  directionsUrl: string;
  onDirections: () => void;
  fallback: ReactNode;
  overlay?: ReactNode; // chiudi / condividi sopra la foto
}) {
  const [index, setIndex] = useState(0);
  const [mapBroken, setMapBroken] = useState(false);
  // Anche la mappa parte solo quando la pagina diventa visibile (un tocco sui puntini o lo scorrimento).
  const [mapWanted, setMapWanted] = useState(false);
  const mapUrl = mapBroken ? null : staticMapUrl(lat, lng);
  const photos = photoRefs.length > 0 ? photoRefs : [null];
  const slides = photos.length + (mapUrl ? 1 : 0);
  const mapIndex = mapUrl ? photos.length : -1;

  return (
    <div className="relative" data-testid="scheda-carosello">
      <div
        className="flex h-56 snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-t-card [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
          if (i !== index) setIndex(i);
          if (i === mapIndex || el.scrollLeft > 8) setMapWanted(true);
        }}
        aria-roledescription="carosello"
        aria-label={`Foto e posizione di ${name}`}
      >
        {photos.map((ref, i) => (
          <div key={ref ?? `vuota-${i}`} className="relative h-full w-full shrink-0 snap-center" aria-roledescription="pagina" aria-label={`${i + 1} di ${slides}`}>
            {ref ? (
              <PlacePhoto
                photoRef={ref}
                alt={name}
                width={700}
                priority={i === 0}
                className="h-full w-full object-cover"
                fallback={fallback}
                credit={i === 0 ? credit : null}
                creditClassName="absolute bottom-7 right-3"
              />
            ) : (
              fallback
            )}
          </div>
        ))}
        {mapUrl && (
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onDirections}
            data-testid="carosello-mappa"
            className="relative block h-full w-full shrink-0 snap-center bg-brand/10"
            aria-label={`Dove si trova ${name}: apri il percorso`}
          >
            {mapWanted && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mapUrl}
                alt=""
                loading="lazy"
                decoding="async"
                onError={() => setMapBroken(true)}
                className="h-full w-full object-cover"
              />
            )}
            <span className="absolute left-3 bottom-7 rounded-pill bg-white/90 px-3 py-1 text-xs font-display font-semibold text-brand shadow-card">
              Dove si trova · Percorso →
            </span>
          </a>
        )}
      </div>
      {slides > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-0.5 rounded-pill bg-black/35 px-1.5 backdrop-blur" data-testid="carosello-puntini">
            {Array.from({ length: slides }, (_, i) => (
              <button
                key={i}
                type="button"
                aria-label={i === mapIndex ? "Mostra dove si trova" : `Foto ${i + 1}`}
                aria-current={i === index}
                onClick={(e) => {
                  const strip = e.currentTarget.closest("[data-testid=scheda-carosello]")?.firstElementChild as HTMLElement | null;
                  if (i === mapIndex) setMapWanted(true);
                  strip?.scrollTo({ left: i * strip.clientWidth, behavior: "smooth" });
                }}
                className="flex h-6 items-center px-0.5"
              >
                <span aria-hidden className={`block h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-white" : "w-1.5 bg-white/60"}`} />
              </button>
            ))}
          </div>
        </div>
      )}
      {overlay}
    </div>
  );
}
