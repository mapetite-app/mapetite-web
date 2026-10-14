// Selezione delle recensioni "leggibili" da mostrare nella scheda editoriale.
// Soglie centralizzate: nessun magic number sparso nel corpo.
const MIN_LENGTH = 60;          // sotto → troppo povera
const MAX_LENGTH = 700;         // sopra → troppo lunga da leggere
const MAX_UPPERCASE_RATIO = 0.3; // sopra → rant/spam in maiuscolo
const IDEAL_LENGTH = 250;       // lunghezza "sweet spot" per la scheda
const MAX_RESULTS = 3;
const TRUNCATE_AT = 400;        // taglio finale del testo mostrato

// rating: stelle date dall'autore della recensione (Google), se note.
export type SelectedReview = { text: string; rating?: number | null };

function uppercaseRatio(text: string): number {
  let letters = 0;
  let uppercase = 0;
  for (const ch of text) {
    if (/\p{L}/u.test(ch)) {
      letters++;
      if (ch !== ch.toLowerCase() && ch === ch.toUpperCase()) uppercase++;
    }
  }
  return letters === 0 ? 0 : uppercase / letters;
}

function truncate(text: string): string {
  if (text.length <= TRUNCATE_AT) return text;
  const slice = text.slice(0, TRUNCATE_AT);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > 0 ? slice.slice(0, lastSpace) : slice;
  return cut + "…";
}

export function selectQualityReviews(
  input: string[] | { text: string; rating: number | null }[] | null,
): SelectedReview[] {
  if (!input) return [];

  return input
    .map((r) => (typeof r === "string" ? { text: r, rating: null } : r))
    .filter((r) => typeof r.text === "string")
    .map((r) => ({ text: r.text.trim(), rating: r.rating }))
    .filter((r) => r.text.length >= MIN_LENGTH)
    .filter((r) => r.text.length <= MAX_LENGTH)
    .filter((r) => uppercaseRatio(r.text) <= MAX_UPPERCASE_RATIO)
    .sort((a, b) => Math.abs(a.text.length - IDEAL_LENGTH) - Math.abs(b.text.length - IDEAL_LENGTH))
    .slice(0, MAX_RESULTS)
    .map((r) => ({ text: truncate(r.text), rating: r.rating }));
}
