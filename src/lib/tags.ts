// I due tag di stato restano salvati come "Da provare" / "Già visitato" (dati esistenti),
// ma si mostrano con le parole dei pulsanti della scheda, come in Places.
const STATUS_LABEL: Record<string, string> = {
  "Da provare": "📌 Voglio andarci",
  "Già visitato": "✓ Ci sono stato",
  // "Com'era?" dopo "Ci sono stato" (segnale per i suggerimenti): anche questi non sono raccolte.
  "Mi è piaciuto": "👍 Mi è piaciuto",
  "Non fa per me": "👎 Non fa per me",
};

export const OPINION_LIKE = "Mi è piaciuto";
export const OPINION_DISLIKE = "Non fa per me";

export function tagLabel(tag: string): string {
  // hasOwn: un tag scritto a mano come "constructor" non deve leggere le proprietà dell'oggetto.
  return Object.hasOwn(STATUS_LABEL, tag) ? STATUS_LABEL[tag] : tag;
}

// Stato prima, poi gli altri tag nell'ordine in cui sono stati scelti.
export function sortTags(tags: string[]): string[] {
  return [...tags].sort((a, b) => Number(Object.hasOwn(STATUS_LABEL, b)) - Number(Object.hasOwn(STATUS_LABEL, a)));
}

// I due tag di stato: non sono raccolte e la gestione delle raccolte non li tocca mai.
export const STATE_TAGS = ["Da provare", "Già visitato"] as const;
export function isStateTag(tag: string): boolean {
  return Object.hasOwn(STATUS_LABEL, tag);
}

// Normalizza un nome di tag scritto a mano, come "+ Nuovo tag" nella scheda (map-view):
// spazi compattati, massimo 24 caratteri, prima lettera maiuscola; se coincide (senza
// maiuscole) con un tag già usato o con l'etichetta di uno stato, restituisce quello.
export function normalizeTagName(text: string | null, existing: string[]): string | null {
  const raw = (text ?? "").trim().replace(/\s+/g, " ").slice(0, 24);
  if (raw === "") return null;
  const same = (t: string) =>
    t.toLowerCase() === raw.toLowerCase() || tagLabel(t).replace(/^[^\p{L}]+/u, "").toLowerCase() === raw.toLowerCase();
  return [...existing, ...STATE_TAGS].find(same) ?? raw.charAt(0).toUpperCase() + raw.slice(1);
}

// Rinomina (o unisce) "from" in "to" nei tag di un salvato, senza doppioni e mantenendo l'ordine.
export function replaceTag(tags: string[], from: string, to: string): string[] {
  const out: string[] = [];
  for (const t of tags) {
    const next = t === from ? to : t;
    if (!out.includes(next)) out.push(next);
  }
  return out;
}
