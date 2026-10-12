// I due tag di stato restano salvati come "Da provare" / "Già visitato" (dati esistenti),
// ma si mostrano con le parole dei pulsanti della scheda, come in Places.
const STATUS_LABEL: Record<string, string> = {
  "Da provare": "📌 Voglio andarci",
  "Già visitato": "✓ Ci sono stato",
};

export function tagLabel(tag: string): string {
  // hasOwn: un tag scritto a mano come "constructor" non deve leggere le proprietà dell'oggetto.
  return Object.hasOwn(STATUS_LABEL, tag) ? STATUS_LABEL[tag] : tag;
}

// Stato prima, poi gli altri tag nell'ordine in cui sono stati scelti.
export function sortTags(tags: string[]): string[] {
  return [...tags].sort((a, b) => Number(Object.hasOwn(STATUS_LABEL, b)) - Number(Object.hasOwn(STATUS_LABEL, a)));
}
