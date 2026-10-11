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
}: {
  photoRef: string | null | undefined;
  alt: string;
  className?: string;
  width?: number;
  fallback?: ReactNode;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (!photoRef || failed) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/places/photo?ref=${encodeURIComponent(photoRef)}&w=${width}`}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
