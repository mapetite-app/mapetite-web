import { cityFromAddress } from "@/lib/city";
import { distanceMeters } from "@/lib/distance";

// Zone dei salvati (revisore 2/11): con salvati a Roma e a Milano la mappa inquadrava tutta l'Italia
// con un solo gruppo. Qui i salvati si dividono per vicinanza (entro 30 km dal primo posto della zona),
// col nome della città più frequente; la mappa parte dalla zona giusta e le altre sono a un tocco.
// Nessuna chiamata esterna: solo coordinate e indirizzi già salvati.
export const ZONA_METERS = 30_000;

type Punto = { lat: number; lng: number };
type Posto = Punto & { address?: string | null };
export type Zona<T extends Posto> = { nome: string; posti: T[]; centro: Punto };

export function zoneDeiSalvati<T extends Posto>(list: readonly T[], raggio = ZONA_METERS): Zona<T>[] {
  const zone: { posti: T[]; centro: Punto }[] = [];
  for (const p of list) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
    const z = zone.find((x) => distanceMeters(x.centro, p) <= raggio);
    if (z) z.posti.push(p);
    else zone.push({ posti: [p], centro: { lat: p.lat, lng: p.lng } });
  }
  const ordinate = zone.sort((a, b) => b.posti.length - a.posti.length);
  const usati = new Set<string>();
  return ordinate.map((z, i) => {
    const conta = new Map<string, number>();
    for (const p of z.posti) {
      const c = cityFromAddress(p.address);
      if (c) conta.set(c, (conta.get(c) ?? 0) + 1);
    }
    const migliore = [...conta.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    // Due zone con la stessa città (o senza città): un nome che le distingue.
    const nome = migliore && !usati.has(migliore) ? migliore : `Zona ${i + 1}`;
    usati.add(nome);
    return { nome, posti: z.posti, centro: z.centro };
  });
}

// Da dove partire: la zona vicina a chi guarda (se c'è un salvato entro il raggio), altrimenti la più piena.
export function zonaIniziale<T extends Posto>(zone: readonly Zona<T>[], qui: Punto | null, raggio = ZONA_METERS): Zona<T> | null {
  if (qui) {
    const vicina = zone.find((z) => z.posti.some((p) => distanceMeters(qui, p) <= raggio));
    if (vicina) return vicina;
  }
  return zone[0] ?? null;
}
