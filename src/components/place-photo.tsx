"use client";

import { useState, type ReactNode } from "react";

// Foto Google tramite il nostro proxy in cache. Se manca o non carica
// (quota giornaliera, errore di rete) mostra il fallback (di solito l'emoji).
export default function PlacePhoto({
  photoRef,
  alt,
  className = "",
  width = 400,
  fallback = null,
  priority = false,
  credit = null,
  creditClassName = "absolute bottom-2 right-3",
}: {
  photoRef: string | null | undefined;
  alt: string;
  className?: string;
  width?: number;
  fallback?: ReactNode;
  priority?: boolean;
  // Autore della foto (Google chiede di mostrarlo): solo se la foto c'è davvero. Prima il credito
  // restava sopra l'emoji anche quando la foto non arrivava (quota giornaliera finita).
  credit?: string | null;
  creditClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!photoRef || failed) return <>{fallback}</>;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/places/photo?ref=${encodeURIComponent(photoRef)}&w=${width}`}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onError={() => setFailed(true)}
        className={className}
      />
      {credit && (
        <span className={`${creditClassName} rounded-pill bg-black/45 px-2 py-0.5 text-[10px] font-sans text-white`}>Foto: {credit}</span>
      )}
    </>
  );
}
