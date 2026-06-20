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

export function getCategoryEmoji(category: string | null): string {
  if (!category) return "🍴";
  const c = category.toLowerCase();
  for (const [keywords, emoji] of EMOJI_RULES) {
    if (keywords.some((kw) => c.includes(kw))) return emoji;
  }
  return "🍴";
}
