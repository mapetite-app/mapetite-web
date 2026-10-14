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
  [["steak", "grill", "brace", "carne", "macelleria"], "🥩"],
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

export function getCategoryEmoji(category: string | null, name?: string | null): string {
  const catMatch = category ? matchRule(category) : null;
  const nameMatch = name ? matchRule(name) : null;

  if (catMatch && nameMatch) {
    // Il match con indice più basso è la regola più specifica — vince.
    // In caso di parità, vince la category.
    return catMatch.index <= nameMatch.index ? catMatch.emoji : nameMatch.emoji;
  }
  return catMatch?.emoji ?? nameMatch?.emoji ?? "🍴";
}
