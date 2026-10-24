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
// Gli alberghi mai; i rooftop solo se davvero piccoli: un rooftop di quartiere con 105 recensioni
// gestito dalla titolare resta una chicca (secondo collaudo del 24/10, VISIONE).
const ALBERGO = /\b(?:hotel|albergo|resort)\b/i;
const META_DA_CARTOLINA = /\b(?:rooftop|roof(?:\s?(?:garden|terrace|top|bar))?|sky\s?bar|terrazza panoramica)\b/i;
const ROOFTOP_MAX_REVIEWS = 150;

export function isGem(rating: number | null | undefined, reviews: number | null | undefined, name?: string | null): boolean {
  if (name && ALBERGO.test(name)) return false;
  if (name && META_DA_CARTOLINA.test(name) && (reviews ?? 0) > ROOFTOP_MAX_REVIEWS) return false;
  return rating != null && reviews != null && rating >= GEM_MIN_RATING && reviews >= GEM_MIN_REVIEWS && reviews <= GEM_MAX_REVIEWS;
}
