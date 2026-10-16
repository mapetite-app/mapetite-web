// "Vicino a me, aperto adesso" (piano 2.1): cosa cercare in base all'ora del telefono.
// Una sola ricerca Google, come i Filtri: la frase cambia, il numero di chiamate no.
export type NearNow = { query: string; sub: string };

export function nearNowQuery(now: Date): NearNow {
  const h = now.getHours() + now.getMinutes() / 60;
  if (h >= 5 && h < 11) return { query: "colazione bar caffetteria pasticceria", sub: "Per la colazione, entro 1 km" };
  if (h >= 11 && h < 15) return { query: "pranzo ristorante trattoria", sub: "Per il pranzo, entro 1 km" };
  if (h >= 15 && h < 18) return { query: "bar caffè pasticceria gelateria", sub: "Per una pausa, entro 1 km" };
  if (h >= 18 && h < 20.5) return { query: "aperitivo cocktail bar wine bar", sub: "Per l'aperitivo, entro 1 km" };
  if (h >= 20.5 && h < 23) return { query: "ristorante cena", sub: "Per la cena, entro 1 km" };
  return { query: "cocktail bar pub locale aperto", sub: "Per un drink, entro 1 km" };
}

// Cerchio del raggio sulla mappa (GeoJSON): 64 punti bastano per un bordo liscio.
export function circlePolygon(center: { lat: number; lng: number }, meters: number) {
  const pts: [number, number][] = [];
  const dLat = meters / 111_320;
  const dLng = meters / (111_320 * Math.max(Math.cos((center.lat * Math.PI) / 180), 0.01));
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * 2 * Math.PI;
    pts.push([center.lng + dLng * Math.cos(a), center.lat + dLat * Math.sin(a)]);
  }
  return { type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, coordinates: [pts] } };
}

export function radiusLabel(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${String(km).replace(".", ",")} km`;
}
