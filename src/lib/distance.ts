// Distanze in linea d'aria (haversine, nessuna chiamata a servizi esterni) ed etichette per card e scheda.

type Point = { lat: number; lng: number };

export function distanceMeters(from: Point, to: Point): number {
  const R = 6371000;
  const rad = (x: number) => (x * Math.PI) / 180;
  const a =
    Math.sin(rad(to.lat - from.lat) / 2) ** 2 +
    Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(rad(to.lng - from.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function distanceLabel(from: Point, to: Point): string {
  const m = distanceMeters(from, to);
  if (m < 950) return `${Math.max(50, Math.round(m / 50) * 50)} m`;
  return `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}

// Minuti a piedi stimati: le strade sono ~30% più lunghe della linea d'aria, passo 80 m/min.
// null oltre i 40 minuti: a quel punto "a piedi" non è un'informazione utile.
export function walkMinutes(from: Point, to: Point): number | null {
  const min = Math.max(1, Math.round((distanceMeters(from, to) * 1.3) / 80));
  return min <= 40 ? min : null;
}
