export const CUISINES: { value: string; label: string; emoji: string }[] = [
  { value: "romana_laziale", label: "Romana", emoji: "🍝" },
  { value: "italiana",       label: "Italiana", emoji: "🇮🇹" },
  { value: "pizza",          label: "Pizza", emoji: "🍕" },
  { value: "pesce",          label: "Pesce", emoji: "🐟" },
  { value: "giapponese",     label: "Giapponese", emoji: "🍣" },
  { value: "cinese",         label: "Cinese", emoji: "🥡" },
  { value: "indiana",        label: "Indiana", emoji: "🍛" },
  { value: "messicana",      label: "Messicana", emoji: "🌮" },
  { value: "mediorientale",  label: "Mediorientale", emoji: "🧆" },
  { value: "vegetariana",    label: "Veg", emoji: "🥗" },
  { value: "street_food",    label: "Street food", emoji: "🍢" },
];

export const OCCASIONS: { value: string; label: string; emoji: string }[] = [
  { value: "cena_romantica",     label: "Cena romantica", emoji: "❤️" },
  { value: "pranzo_veloce",      label: "Pranzo veloce", emoji: "⚡" },
  { value: "aperitivo",          label: "Aperitivo", emoji: "🍹" },
  { value: "cena_amici",         label: "Cena con amici", emoji: "👯" },
  { value: "pranzo_lavoro",      label: "Pranzo di lavoro", emoji: "💼" },
  { value: "colazione_brunch",   label: "Colazione / Brunch", emoji: "🥐" },
  { value: "dopocena",           label: "Dopocena", emoji: "🌙" },
  { value: "occasione_speciale", label: "Occasione speciale", emoji: "🎉" },
];

export const ATMOSPHERES: { value: string; label: string; emoji: string }[] = [
  { value: "intima",      label: "Intima", emoji: "🕯️" },
  { value: "vivace",      label: "Vivace", emoji: "🎶" },
  { value: "aperto",      label: "All'aperto", emoji: "🌿" },
  { value: "raffinata",   label: "Raffinata", emoji: "✨" },
  { value: "informale",   label: "Informale", emoji: "👕" },
  { value: "storica",     label: "Storica", emoji: "🏛️" },
  { value: "panoramica",  label: "Vista panoramica", emoji: "🌅" },
  { value: "tranquilla",  label: "Tranquilla", emoji: "🤫" },
];

export const PRICE_RANGES: { value: string; description: string }[] = [
  { value: "€",    description: "Economico" },
  { value: "€€",   description: "Nella media" },
  { value: "€€€",  description: "Sopra la media" },
  { value: "€€€€", description: "Alta cucina" },
];

// "Momento magia" a fine onboarding: una prima ricerca costruita sui gusti appena
// scelti (occasione, cucina, atmosfera, spesa), così la mappa mostra subito locali adatti.
// Es. "Cena romantica, cucina romana, atmosfera intima". null se non c'è nulla da usare.
export function tasteQuery(p: { cuisines: string[]; occasions: string[]; atmospheres: string[]; priceRange: string | null }): string | null {
  const occasion = OCCASIONS.find((o) => p.occasions.includes(o.value))?.label;
  const cuisineValue = CUISINES.find((c) => p.cuisines.includes(c.value))?.value;
  const atmosphereValue = ATMOSPHERES.find((a) => p.atmospheres.includes(a.value))?.value;
  // Frasi naturali: "pizzeria", "con vista panoramica" invece di "cucina pizza", "atmosfera vista panoramica".
  const CUISINE_TEXT: Record<string, string> = {
    pizza: "pizzeria", street_food: "street food", vegetariana: "cucina vegetariana",
    romana_laziale: "cucina romana", pesce: "di pesce",
  };
  const ATMOSPHERE_TEXT: Record<string, string> = {
    aperto: "all'aperto", panoramica: "con vista panoramica", storica: "in un locale storico",
  };
  const cuisine = cuisineValue
    ? CUISINE_TEXT[cuisineValue] ?? `cucina ${CUISINES.find((c) => c.value === cuisineValue)!.label.toLowerCase()}`
    : null;
  const atmosphere = atmosphereValue
    ? ATMOSPHERE_TEXT[atmosphereValue] ?? `atmosfera ${ATMOSPHERES.find((a) => a.value === atmosphereValue)!.label.toLowerCase()}`
    : null;
  const price = p.priceRange === "€" ? "economico" : p.priceRange === "€€€€" ? "di alto livello" : null;
  // "Pizzeria" e "street food" sono già un tipo di locale: niente "Ristorante" davanti.
  const subject = occasion ?? (cuisineValue === "pizza" || cuisineValue === "street_food" ? null : cuisine ? "Ristorante" : "Locale");
  const parts = [subject, cuisine, atmosphere, price].filter(Boolean) as string[];
  if (parts.length > 0) parts[0] = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  if (!subject) return parts.join(", "); // es. "Pizzeria" basta da solo
  // Serve almeno un gusto oltre al soggetto generico.
  return parts.length >= 2 ? parts.join(", ") : null;
}
