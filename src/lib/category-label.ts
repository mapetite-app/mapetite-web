// Tipo Google (primaryType, in inglese) → etichetta italiana per l'interfaccia.
// Le categorie salvate a mano (es. "Trattoria") restano come sono.
const LABELS: Record<string, string> = {
  restaurant: "Ristorante",
  italian_restaurant: "Ristorante italiano",
  pizza_restaurant: "Pizzeria",
  seafood_restaurant: "Ristorante di pesce",
  sushi_restaurant: "Sushi",
  japanese_restaurant: "Ristorante giapponese",
  chinese_restaurant: "Ristorante cinese",
  indian_restaurant: "Ristorante indiano",
  mexican_restaurant: "Ristorante messicano",
  thai_restaurant: "Ristorante thai",
  greek_restaurant: "Ristorante greco",
  french_restaurant: "Ristorante francese",
  spanish_restaurant: "Ristorante spagnolo",
  mediterranean_restaurant: "Cucina mediterranea",
  middle_eastern_restaurant: "Cucina mediorientale",
  ramen_restaurant: "Ramen",
  steak_house: "Steakhouse",
  hamburger_restaurant: "Hamburgeria",
  fast_food_restaurant: "Fast food",
  breakfast_restaurant: "Colazioni",
  brunch_restaurant: "Brunch",
  fine_dining_restaurant: "Alta cucina",
  vegetarian_restaurant: "Vegetariano",
  vegan_restaurant: "Vegano",
  sandwich_shop: "Panini",
  bar: "Bar",
  cocktail_bar: "Cocktail bar",
  wine_bar: "Wine bar",
  pub: "Pub",
  night_club: "Discoteca",
  bar_and_grill: "Bar e griglieria",
  cafe: "Caffè",
  coffee_shop: "Caffetteria",
  bakery: "Forno",
  pastry_shop: "Pasticceria",
  ice_cream_shop: "Gelateria",
  dessert_shop: "Dolci",
  confectionery: "Pasticceria",
  deli: "Gastronomia",
  food_court: "Mercato del cibo",
  meal_takeaway: "Da asporto",
  tea_house: "Sala da tè",
};

export function categoryLabel(c: string | null | undefined): string | null {
  if (!c) return null;
  const known = LABELS[c.toLowerCase()];
  if (known) return known;
  // Tipo Google non in elenco: niente trattini bassi, prima lettera maiuscola.
  const t = c.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}
