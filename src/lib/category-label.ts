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
  dessert_restaurant: "Dolci",
  ice_cream_shop: "Gelateria",
  confectionery: "Dolciumi",
  deli: "Gastronomia",
  food_court: "Area food",
  tea_house: "Sala da tè",
  juice_shop: "Succhi e centrifughe",
  chocolate_shop: "Cioccolateria",
  meal_takeaway: "Da asporto",
  brewery: "Birrificio",
  brewpub: "Birreria",
  beer_garden: "Birreria",
  winery: "Cantina",
  korean_restaurant: "Coreano",
  vietnamese_restaurant: "Vietnamita",
  turkish_restaurant: "Turco",
  lebanese_restaurant: "Libanese",
  brazilian_restaurant: "Brasiliano",
  peruvian_restaurant: "Peruviano",
  african_restaurant: "Africano",
  asian_restaurant: "Asiatico",
  barbecue_restaurant: "Griglia",
  buffet_restaurant: "Buffet",
  food_store: "Gastronomia",
};

// Il nome del locale dice già che cos'è ("Trattoria da Lucia", che Google segna come seafood_restaurant):
// sopra il nome "PESCE" si leggeva come un errore (collaudo 23/10). Vale solo contro un tipo Google
// generico o di cucina (ristorante di qualcosa); mai contro bar, caffè o pasticceria. Solo dal nome, dato Google.
const DAL_NOME: [RegExp, string][] = [
  [/\btrattoria\b/i, "Trattoria"],
  [/\b(?:osteria|hostaria|ostaria)\b/i, "Osteria"],
  [/\bpizzeria\b/i, "Pizzeria"],
  [/\btaverna\b/i, "Taverna"],
  [/\bbraceria\b/i, "Braceria"],
];

// Tipo Google in inglese senza etichetta italiana ("karaoke", "farm"): non va mai in una frase scritta
// per l'utente ("brewery fuori dai soliti giri", collaudo del 31/10). Le categorie scritte a mano
// ("Trattoria") hanno maiuscole o spazi e restano valide.
export function tipoGoogleSconosciuto(category: string | null | undefined): boolean {
  if (!category || !/^[a-z_]+$/.test(category)) return false;
  return !LABELS[category] && !/_(?:restaurant|bar)$/.test(category);
}

export function categoryLabel(category: string | null | undefined, name?: string | null): string | null {
  if (!category) return null;
  if (name && /(?:^|_)restaurant$/.test(category.toLowerCase())) {
    const dalNome = DAL_NOME.find(([re]) => re.test(name));
    if (dalNome) return dalNome[1];
  }
  const known = LABELS[category.toLowerCase()];
  if (known) return known;
  // Tipo di Google non in elenco: mai in inglese sulla card ("Dessert restaurant").
  if (/_restaurant$/.test(category)) return "Ristorante";
  if (/_bar$/.test(category)) return "Bar";
  if (/_(?:shop|store)$/.test(category)) return "Negozio";
  // Categoria scritta a mano ("Trattoria"): niente trattini bassi, prima lettera maiuscola.
  const t = category.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}
