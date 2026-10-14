// Parole inglesi che Haiku a volte copia dalle recensioni nei verdetti e nei chip ("vibe lounge",
// "food pairings", "vista breathtaking": visti il 14/10 su 15 dei 404 verdetti in memoria).
// Non ci sono i prestiti entrati nell'italiano (drink, staff, location, cocktail, brunch, rooftop, lounge).
const ENGLISH = /\b(vibes?|food|view|views|handmade|breathtaking|pairings?|chill|soft|cozy|cosy|nice|great|amazing|awesome|friendly|delicious|tasty|cheap|welcome|the|and|with)\b/i;

export function hasEnglish(text: string): boolean {
  return ENGLISH.test(text);
}
