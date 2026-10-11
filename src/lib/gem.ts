// "Poco conosciuto" (beta gemme): molto amato ma fuori dai giri di massa.
// Solo dati Google già arrivati (voto e numero di recensioni), nessun costo.
export const GEM_MIN_RATING = 4.5;
export const GEM_MAX_REVIEWS = 400;
// Sotto il pavimento qualità (FLOOR_REVIEWS=20) il voto non è affidabile.
const GEM_MIN_REVIEWS = 20;

export function isGem(rating: number | null | undefined, reviews: number | null | undefined): boolean {
  return rating != null && reviews != null && rating >= GEM_MIN_RATING && reviews >= GEM_MIN_REVIEWS && reviews <= GEM_MAX_REVIEWS;
}
