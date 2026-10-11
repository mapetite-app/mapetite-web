// Tipo Google (primaryType, in inglese) → etichetta italiana per card e scheda.
// Solo presentazione: il valore salvato resta quello di Google; le categorie salvate
// a mano (es. "Trattoria") restano come sono.
const LABELS: Record<string, string> = {
  restaurant: "Ristorante",
  italian_restaurant: "Ristorante italiano",
  mediterranean_restaurant: "Ristorante mediterraneo",
  fine_dining_restaurant: "Alta cucina",
  seafood_restaurant: "Pesce",
  pizza_restaurant: "Pizzeria",
  japanese_restaurant: "Giapponese",
  sushi_restaurant: "Sushi",
  ramen_restaurant: "Ramen",
  chinese_restaurant: "Cinese",
  indian_restaurant: "Indiano",
  thai_restaurant: "Thailandese",
  mexican_restaurant: "Messicano",
  greek_restaurant: "Greco",
  spanish_restaurant: "Spagnolo",
  french_restaurant: "Francese",
  american_restaurant: "Americano",
  middle_eastern_restaurant: "Mediorientale",
  vegan_restaurant: "Vegano",
  vegetarian_restaurant: "Vegetariano",
  steak_house: "Steakhouse",
  hamburger_restaurant: "Hamburgeria",
  brunch_restaurant: "Brunch",
  breakfast_restaurant: "Colazione",
  fast_food_restaurant: "Fast food",
  sandwich_shop: "Panini",
  bistro: "Bistrot",
  diner: "Diner",
  bar: "Bar",
  cocktail_bar: "Cocktail bar",
  lounge_bar: "Lounge bar",
  wine_bar: "Wine bar",
  pub: "Pub",
  bar_and_grill: "Bar e griglia",
  night_club: "Discoteca",
  cafe: "Caffè",
  coffee_shop: "Caffetteria",
  cafeteria: "Tavola calda",
  bakery: "Forno",
  pastry_shop: "Pasticceria",
  cake_shop: "Pasticceria",
  dessert_shop: "Dolci",
  ice_cream_shop: "Gelateria",
  confectionery: "Dolciumi",
  deli: "Gastronomia",
  food_court: "Area food",
  tea_house: "Sala da tè",
  juice_shop: "Succhi e centrifughe",
  chocolate_shop: "Cioccolateria",
  meal_takeaway: "Da asporto",
};

export function categoryLabel(category: string | null | undefined): string | null {
  if (!category) return null;
  const known = LABELS[category.toLowerCase()];
  if (known) return known;
  // Tipo non in elenco: niente trattini bassi, prima lettera maiuscola.
  const t = category.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}
