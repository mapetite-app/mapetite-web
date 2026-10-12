// "Stasera dove andiamo?": sceglie 3 posti tra i salvati dell'utente.
// Funzioni pure, nessuna chiamata esterna. Solo dati dell'utente (tag, note, posizione):
// il voto Google NON entra nella scelta, così non vincono i posti più popolari (VISIONE.md).
import { distanceMeters } from "@/lib/distance";
import { getCategoryEmoji } from "@/lib/emoji";
import { cityFromAddress } from "@/lib/city";

export const STATE_WANT = "Da provare"; // si legge "📌 Voglio andarci"
export const STATE_DONE = "Già visitato"; // si legge "✓ Ci sono stato"

// "Vicino a me": entro 10 km in linea d'aria (una città, anche grande come Roma).
export const NEAR_RADIUS_M = 10_000;

export type SavedSpot = {
  id: string; // UUID Supabase (places.id)
  name: string;
  category: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  googlePlaceId: string | null;
  tags: string[];
  note: string | null;
};

export type Choices = {
  occasion: string | null; // una raccolta dell'utente, null = Qualsiasi
  near: { lat: number; lng: number } | null; // null = Ovunque
  city: string | null; // città ricavata dall'indirizzo (es. "Roma"), null = tutte
  onlyNew: boolean; // true = Mai provati (esclusi i "Ci sono stato")
};

// Raccolte = tag dell'utente esclusi i due di stato, dalla più ricca.
export function collectionsOf(spots: SavedSpot[]): string[] {
  const count = new Map<string, number>();
  for (const s of spots) {
    for (const t of new Set(s.tags)) {
      if (t === STATE_WANT || t === STATE_DONE || !t.trim()) continue;
      count.set(t, (count.get(t) ?? 0) + 1);
    }
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "it")).map(([t]) => t);
}

// Città dei salvati (dall'indirizzo), dalla più ricca: servono solo se sono almeno due.
export function citiesOf(spots: SavedSpot[]): string[] {
  const count = new Map<string, number>();
  for (const s of spots) {
    const c = cityFromAddress(s.address);
    if (c) count.set(c, (count.get(c) ?? 0) + 1);
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "it")).map(([c]) => c);
}

export function matches(s: SavedSpot, c: Choices): boolean {
  if (c.city && cityFromAddress(s.address) !== c.city) return false;
  if (c.occasion && !s.tags.includes(c.occasion)) return false;
  if (c.onlyNew && s.tags.includes(STATE_DONE)) return false;
  if (c.near) {
    if (s.lat == null || s.lng == null) return false;
    if (distanceMeters(c.near, { lat: s.lat, lng: s.lng }) > NEAR_RADIUS_M) return false;
  }
  return true;
}

// Livello: prima i "Voglio andarci", poi i salvati senza stato, poi i già visitati.
function tier(s: SavedSpot): number {
  if (s.tags.includes(STATE_WANT)) return 2;
  if (s.tags.includes(STATE_DONE)) return 0;
  return 1;
}

// Sceglie fino a `n` posti tra quelli che rispettano le scelte, saltando quelli in `skip`
// (già proposti con "Altri 3"). Il livello pesa più di tutto; a parità contano vicinanza,
// un po' di caso (così "Altri 3" non ripropone sempre lo stesso ordine) e la varietà di tipo.
export function pickThree(
  spots: SavedSpot[],
  c: Choices,
  skip: Set<string> = new Set(),
  n = 3,
  random: () => number = Math.random,
): SavedSpot[] {
  const pool = spots
    .filter((s) => matches(s, c) && !skip.has(s.id))
    .map((s) => {
      const near = c.near && s.lat != null && s.lng != null
        ? 1 - Math.min(1, distanceMeters(c.near, { lat: s.lat, lng: s.lng }) / NEAR_RADIUS_M)
        : 0;
      return { s, base: tier(s) * 10 + near * 3 + random() * 2, kind: getCategoryEmoji(s.category, s.name) };
    });
  const picked: SavedSpot[] = [];
  const kinds = new Set<string>();
  while (picked.length < n && pool.length > 0) {
    let best = 0;
    let bestScore = -Infinity;
    pool.forEach((x, i) => {
      const score = x.base - (kinds.has(x.kind) ? 4 : 0);
      if (score > bestScore) { bestScore = score; best = i; }
    });
    const [x] = pool.splice(best, 1);
    picked.push(x.s);
    kinds.add(x.kind);
  }
  return picked;
}

// Link al percorso su Google Maps (nessuna chiamata dall'app: lo apre il telefono).
export function directionsUrl(s: SavedSpot): string {
  if (s.lat != null && s.lng != null) return `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`;
  const q = [s.name, s.address].filter(Boolean).join(", ");
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}${s.googlePlaceId ? `&destination_place_id=${encodeURIComponent(s.googlePlaceId)}` : ""}`;
}
