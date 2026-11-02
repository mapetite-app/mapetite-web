const EMOJI_RULES: [string[], string][] = [
  // Specifiche prima — così "bakery" non viene catturato da "bar"
  // Pasticcerie e cornetti (14/10): prima avevano la baguette 🥖 come i forni.
  [["pasticc", "pastry", "cornett", "croissant"], "🥐"],
  [["dessert", "cake", "cioccolat", "chocolate", "confectioner", "dolci"], "🍰"],
  [["forno", "panific", "panetteria", "bakery"], "🥖"],
  [["pizza", "pizzeria"], "🍕"],
  [["sushi", "giappones", "japanese"], "🍣"],
  [["pesce", "fish", "seafood", "frutti di mare"], "🐟"],
  [["gelat", "ice cream", "ice_cream"], "🍦"],
  [["caff", "cafe", "coffee"], "☕️"],
  [["enotec", "wine"], "🍷"],
  [["burger", "hamburger", "panino", "paninote"], "🍔"],
  [["ramen", "noodle", "cines", "chinese", "thai", "asiatic", "asian", "korean", "corean", "vietnam"], "🍜"],
  // Churrascaria e barbecue (1/11): prima "CASA ENCANTO ROMA" (brasiliana) aveva gli spaghetti 🍝.
  // Cambia solo i locali con queste parole nel tipo o nel nome (prima 🍝 o 🍺, ora 🥩).
  [["steak", "grill", "brace", "carne", "macelleria", "churrasc", "barbecue", "brazilian", "argentinian"], "🥩"],
  // Cucine (14/10): prima un ristorante indiano, messicano o vegano aveva gli spaghetti 🍝.
  [["indian", "indiano", "curry"], "🍛"],
  [["mexican", "messican", "taco", "burrito"], "🌮"],
  [["middle_eastern", "mediorient", "lebanese", "libanes", "turkish", "kebab", "falafel", "greek", "gyros"], "🥙"],
  [["spanish", "spagnol", "tapas", "paella"], "🥘"],
  [["vegan", "vegetarian"], "🥗"],
  [["brunch", "breakfast"], "🥞"],
  [["juice", "smoothie", "centrifug"], "🥤"],
  [["tea_house", "sala da tè"], "🫖"],
  // Prima di "restaurant" (spostata il 13/10 sera): "The Vista Rooftop | Pantheon Terrace Bar &
  // Restaurant", tipo Google cocktail_bar, aveva 🍝 perché "Restaurant" nel nome batteva il tipo.
  // Cambia solo i locali con "cocktail/speakeasy/mixolog" nel tipo o nel nome e una parola da
  // ristorante nell'altro (o in entrambi): prima avevano 🍝, ora 🍸.
  [["cocktail", "speakeasy", "mixolog"], "🍸"],
  [["italian_restaurant", "ristorante", "restaurant", "trattoria", "osteria"], "🍝"],
  // "bar" in ultima posizione: è substring di "bakery", "wine_bar", ecc.
  [["bar", "pub", "birrer", "brewery"], "🍺"],
];

function matchRule(text: string): { index: number; emoji: string } | null {
  const t = text.toLowerCase();
  for (let i = 0; i < EMOJI_RULES.length; i++) {
    const [keywords, emoji] = EMOJI_RULES[i];
    if (keywords.some((kw) => t.includes(kw))) return { index: i, emoji };
  }
  return null;
}

// Tipi principali che non dicono che cucina è: in Italia quasi ogni locale è "restaurant" o "bar".
const GENERIC_CATEGORIES = new Set(["restaurant", "bar", "food", "point_of_interest", "establishment", "meal_takeaway", "meal_delivery"]);
// Regole che non aggiungono niente a un tipo generico ("restaurant" → 🍝, "bar"/"pub" → 🍺).
const GENERIC_RULES = new Set(EMOJI_RULES.flatMap(([kw], i) => (kw.includes("restaurant") || kw.includes("bar") ? [i] : [])));

// `types`: tutti i tipi Google del locale (solo nei risultati di ricerca). Servono quando il tipo
// principale è generico: giro del 1/11, 12 risultati su 12 con 🍝, anche il sushi ("restaurant" con
// "sushi_restaurant" tra gli altri tipi) e il cocktail bar. Senza `types` (i salvati, che non li hanno)
// l'emoji resta quella di prima.
export function getCategoryEmoji(category: string | null, name?: string | null, types?: readonly string[] | null): string {
  let catMatch = category ? matchRule(category) : null;
  if (types?.length && (category == null || GENERIC_CATEGORIES.has(category))) {
    const hint = types
      .map((t) => matchRule(t))
      .filter((m): m is { index: number; emoji: string } => m != null && !GENERIC_RULES.has(m.index))
      .sort((a, b) => a.index - b.index)[0];
    if (hint && (catMatch == null || hint.index < catMatch.index)) catMatch = hint;
  }
  const nameMatch = name ? matchRule(name) : null;

  if (catMatch && nameMatch) {
    // Il match con indice più basso è la regola più specifica — vince.
    // In caso di parità, vince la category.
    return catMatch.index <= nameMatch.index ? catMatch.emoji : nameMatch.emoji;
  }
  return catMatch?.emoji ?? nameMatch?.emoji ?? "🍴";
}
