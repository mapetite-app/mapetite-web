// Richieste con un tipo di locale chiaro ("colazione", "cocktail bar",
// "ristorante"): Google a volte mette in lista locali di tutt'altro tipo
// (un pub irlandese per "colazione buona vicino a me"). Quando Haiku non c'è
// o non li scarta, questi locali si spostano IN FONDO (mai esclusi), guardando
// solo il tipo principale dato da Google. Solo ordine: nessuna chiamata in più.

type Rule = {
  name: string;
  // La richiesta chiede questo tipo di locale...
  asks: RegExp;
  // ...a meno che nomini anche qualcosa che rende quei tipi adatti.
  unless?: RegExp;
  // Tipi principali Google chiaramente fuori tema per la richiesta.
  offTypes: string[];
  // Il nome dice che è proprio quello che si cerca (Google a volte sbaglia il
  // tipo: "Flumen cocktail house" risulta pub): resta dov'è.
  nameOk: RegExp;
};

const RULES: Rule[] = [
  {
    name: "colazione",
    asks: /\b(?:colazion|cornett|brioche|cappuccin|maritozz|brunch)/i,
    unless: /\b(?:birr|pub\b|cocktail|vin[oi]\b|aperitiv|pizz|cena\b|sera\b)/i,
    offTypes: ["pub", "irish_pub", "sports_bar", "night_club", "bar_and_grill", "cocktail_bar", "wine_bar", "beer_hall", "brewery", "steak_house"],
    nameOk: /caff|caf[eéè]|bar\b|pasticc|forno|colazion|bakery|bistro/i,
  },
  {
    name: "cocktail",
    asks: /\bcocktail|\bmixolog|\bspeakeasy/i,
    unless: /\b(?:birr|pub\b|sport|partit|pizz|cena\b|mangiar|ristorant)/i,
    offTypes: ["pub", "irish_pub", "sports_bar", "beer_hall", "brewery", "bakery", "ice_cream_shop", "coffee_shop", "pizza_restaurant", "fast_food_restaurant", "hamburger_restaurant"],
    nameOk: /cocktail|mixolog|speakeasy|lounge|drink/i,
  },
  {
    name: "ristorante",
    asks: /\bristorant|\btrattori|\bosteri|\bcena\b|\bcenare\b/i,
    unless: /\b(?:bar|pub)\b|\b(?:aperitiv|cocktail|drink|vin[oi]\b|caff|dolc|gelat|dopocena|dopo\s+cena)/i,
    // Niente "bar"/"cocktail_bar": molti ristoranti su terrazza risultano così.
    offTypes: ["pub", "irish_pub", "sports_bar", "night_club", "coffee_shop", "cafe", "bakery", "ice_cream_shop", "beer_hall"],
    nameOk: /ristorant|restaurant|trattori|osteri|cucina|bistro|terrazz|roof/i,
  },
];

export function demoteOffType<T extends { name: string; category: string | null }>(
  query: string,
  places: T[],
): { places: T[]; demoted: string[]; rule: string | null } {
  const rule = RULES.find((r) => r.asks.test(query) && !(r.unless?.test(query) ?? false));
  if (!rule || places.length < 4) return { places, demoted: [], rule: null };
  const isOff = (p: T) => p.category != null && rule.offTypes.includes(p.category) && !rule.nameOk.test(p.name);
  const kept = places.filter((p) => !isOff(p));
  // Se sono quasi tutti "fuori tema" forse il tipo lo abbiamo capito male: non si tocca nulla.
  if (kept.length === places.length || kept.length < places.length / 2) return { places, demoted: [], rule: null };
  const off = places.filter(isOff);
  return { places: [...kept, ...off], demoted: off.map((p) => `${p.name} (${p.category})`), rule: rule.name };
}
