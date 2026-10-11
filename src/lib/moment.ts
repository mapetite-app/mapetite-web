// Suggerimento di ricerca adatto al momento della giornata (ora del telefono).
// Nessun costo: è solo una frase in più tra gli esempi della card iniziale.
export function momentSuggestion(now: Date): string {
  const h = now.getHours();
  const weekend = now.getDay() === 0 || now.getDay() === 6;
  if (h >= 6 && h < 11) return weekend ? "☕ Brunch buono per stamattina" : "☕ Colazione con cornetti buoni qui vicino";
  if (h >= 11 && h < 15) return "🍝 Pranzo buono e non turistico qui vicino";
  if (h >= 15 && h < 18) return "🍦 Gelato artigianale qui vicino";
  if (h >= 18 && h < 21) return "🍹 Aperitivo con vista stasera";
  if (h >= 21) return "🍷 Wine bar tranquillo per stasera";
  return "🌙 Locale aperto adesso qui vicino";
}
