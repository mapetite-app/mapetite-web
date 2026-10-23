// "Poco conosciuto" (beta gemme): molto amato ma fuori dai giri di massa.
// Solo dati Google già arrivati (voto e numero di recensioni), nessun costo.
export const GEM_MIN_RATING = 4.5;
export const GEM_MAX_REVIEWS = 400;
// Sotto il pavimento qualità (FLOOR_REVIEWS=20) il voto non è affidabile.
const GEM_MIN_REVIEWS = 20;

// Nel dubbio niente 💎 (collaudo 23/10: "Poco conosciuto" su un rooftop d'albergo con 259 recensioni).
// Rooftop, roof garden e locali d'albergo sono mete da cartolina, non chicche di quartiere: pochi voti
// lì vogliono dire "aperto da poco" o "frequentato da ospiti di passaggio", non "segreto ben custodito".
// Solo dal nome del locale (dato Google), nessuna ipotesi.
const META_DA_CARTOLINA = /\b(?:hotel|albergo|resort|rooftop|roof(?:\s?(?:garden|terrace|top|bar))?|sky\s?bar|terrazza panoramica)\b/i;

export function isGem(rating: number | null | undefined, reviews: number | null | undefined, name?: string | null): boolean {
  if (name && META_DA_CARTOLINA.test(name)) return false;
  return rating != null && reviews != null && rating >= GEM_MIN_RATING && reviews >= GEM_MIN_REVIEWS && reviews <= GEM_MAX_REVIEWS;
}
