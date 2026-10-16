// Ha senso "Prenota" nella barra della scheda? (piano 6.2, come Places: Prenota / Percorso / Salva
// per i ristoranti, Chiama / Percorso / Salva per il resto.)
// Si prenota solo dove c'è un modo vero per farlo (telefono o sito) e il tipo di locale non è
// uno di quelli dove non si prenota mai: caffè al banco, forni, gelaterie, asporto.
// "bar" resta prenotabile: per Google è anche il cocktail bar o il rooftop, non solo il caffè.
// Nel dubbio (categoria sconosciuta o scritta a mano) si mostra Prenota: il foglio dice sempre
// che la conferma arriva dal locale.
const NEVER_BOOKED = new Set([
  "cafe",
  "coffee_shop",
  "cafeteria",
  "bakery",
  "pastry_shop",
  "cake_shop",
  "dessert_shop",
  "ice_cream_shop",
  "confectionery",
  "chocolate_shop",
  "juice_shop",
  "donut_shop",
  "bagel_shop",
  "deli",
  "food_court",
  "fast_food_restaurant",
  "sandwich_shop",
  "meal_takeaway",
  "meal_delivery",
]);

export function bookingMakesSense(place: { category: string | null; phone: string | null; websiteUri: string | null }): boolean {
  if (place.phone == null && place.websiteUri == null) return false;
  const c = place.category?.trim().toLowerCase() ?? "";
  return !NEVER_BOOKED.has(c);
}
