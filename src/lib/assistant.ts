// Assistente Mapetite (piano 1.1): i seguiti che si possono fare sui risultati già avuti,
// SENZA una nuova ricerca Google (costo zero). "Più economici", "aperti ora", "più vicini",
// "meno conosciuti", "voto più alto". Tutto il resto ("solo con terrazza", "e un cocktail bar
// dopo?") è una ricerca nuova. Nessun import con alias: il giro automatico lo importa da Node.

export type LocalRefine = "economici" | "aperti" | "vicini" | "meno-noti" | "voto";

const RULES: [RegExp, LocalRefine][] = [
  [/\b(più|piu) economic|\bmeno car[oaie]\b|\beconomic[oaie]\b|\bspendere (meno|poco)\b|\bcosta(no)? meno\b|\blow cost\b/, "economici"],
  [/\bapert[oi]\b.*\b(ora|adesso|subito)\b|\bsolo (quelli )?apert[oi]\b|\bapert[oi]$/, "aperti"],
  [/\b(più|piu) vicin|\bvicino a me\b|\bqui vicino\b|\bvicini\b/, "vicini"],
  [/\bmeno (conosciut|turistic|famos|noti)|\bpoco (conosciut|noti)|\bgemm|\bnon turistic|\bsconosciut/, "meno-noti"],
  [/\b(voto|voti) (più|piu) alt|\b(più|piu) votat|\b(i )?migliori\b/, "voto"],
];

// Solo frasi brevi: "più economici ma a Monti" o "un economico vicino al Colosseo" sono ricerche.
export function localRefineOf(text: string): LocalRefine | null {
  const t = text.toLowerCase().replace(/[!?.,]+/g, " ").replace(/\s+/g, " ").trim();
  if (t.split(" ").length > 5) return null;
  if (/\b(a|ad|in zona|zona|verso) [A-Za-zÀ-ÿ]{4,}/i.test(t) && !/\bvicino a me\b/.test(t)) return null;
  for (const [re, kind] of RULES) if (re.test(t)) return kind;
  return null;
}

export type RefinablePlace = {
  id: string;
  lat: number;
  lng: number;
  priceLevel: number | null;
  openNow: boolean | null;
  rating: number | null;
  userRatingCount: number | null;
};

function meters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// null = non si può fare con i dati che abbiamo: serve una ricerca nuova.
// places vuoto = si può dire con onestà che nessuno dei posti di prima va bene.
export function applyLocalRefine<T extends RefinablePlace>(
  kind: LocalRefine,
  places: T[],
  pos?: { lat: number; lng: number } | null,
): { places: T[]; note: string } | null {
  if (places.length === 0) return null;
  if (kind === "economici") {
    const prices = places.map((p) => p.priceLevel).filter((v): v is number => v != null && v > 0);
    if (prices.length === 0) return null; // Google non dà i prezzi: meglio cercare di nuovo
    const max = Math.max(...prices);
    const min = Math.min(...prices);
    if (max === min) return null;
    const kept = places.filter((p) => p.priceLevel != null && p.priceLevel > 0 && p.priceLevel < max);
    if (kept.length === 0) return null;
    return { places: [...kept].sort((a, b) => (a.priceLevel ?? 9) - (b.priceLevel ?? 9)), note: `Ho tenuto quelli fino a ${"€".repeat(max - 1)}, tra i posti di prima.` };
  }
  if (kind === "aperti") {
    const kept = places.filter((p) => p.openNow === true);
    return { places: kept, note: kept.length > 0 ? "Questi risultano aperti adesso secondo Google." : "Nessuno dei posti di prima risulta aperto adesso secondo Google." };
  }
  if (kind === "vicini") {
    if (!pos) return null;
    return { places: [...places].sort((a, b) => meters(pos, a) - meters(pos, b)), note: "Li ho messi in ordine dal più vicino a te." };
  }
  if (kind === "meno-noti") {
    // Il differenziatore (VISIONE.md): prima i posti che conoscono in pochi, purché amati.
    const good = places.filter((p) => (p.rating ?? 0) >= 4.2);
    const pool = good.length >= 2 ? good : places;
    return { places: [...pool].sort((a, b) => (a.userRatingCount ?? 0) - (b.userRatingCount ?? 0)), note: "Prima quelli che conoscono in pochi: meno recensioni su Google, voto comunque buono." };
  }
  // voto: solo il voto, non il numero di recensioni (che premierebbe i posti più turistici).
  return { places: [...places].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)), note: "In ordine di voto su Google (il numero di recensioni non conta)." };
}
