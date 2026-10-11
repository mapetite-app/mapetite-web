// Distanza in linea d'aria (haversine) e sua etichetta breve per le card.
export function distanceM(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const R = 6371000;
  const rad = (x: number) => (x * Math.PI) / 180;
  const a =
    Math.sin(rad(to.lat - from.lat) / 2) ** 2 +
    Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(rad(to.lng - from.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function distanceLabel(from: { lat: number; lng: number }, to: { lat: number; lng: number }): string {
  const m = distanceM(from, to);
  if (m < 950) return `${Math.max(50, Math.round(m / 50) * 50)} m`;
  return `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}
