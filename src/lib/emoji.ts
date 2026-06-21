const EMOJI_RULES: [string[], string][] = [
  // Specifiche prima — così "bakery" non viene catturato da "bar"
  [["forno", "panific", "panetteria", "bakery", "pasticc", "pastry"], "🥖"],
  [["pizza", "pizzeria"], "🍕"],
  [["sushi", "giappones", "japanese"], "🍣"],
  [["pesce", "fish", "seafood", "frutti di mare"], "🐟"],
  [["gelat", "ice cream", "ice_cream"], "🍦"],
  [["caff", "cafe", "coffee"], "☕️"],
  [["enotec", "wine"], "🍷"],
  [["burger", "hamburger", "panino", "paninote"], "🍔"],
  [["ramen", "noodle", "cines", "chinese", "thai", "asiatic", "asian"], "🍜"],
  [["steak", "grill", "brace", "carne", "macelleria"], "🥩"],
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
