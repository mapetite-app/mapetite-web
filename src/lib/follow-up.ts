// "Fai un'altra domanda": una domanda breve che affina ("più economico", "con giardino",
// "ma a Monti") continua la ricerca precedente; una frase nuova riparte da zero.
// Parole intere (?=\s|$): "consigliami" o "mangiare" non devono contare come "con" / "ma".
const REFINE_START = /^(?:(?:più|piu|meno|con|senza|anche|ma|però|pero|e|solo|non|a|ad|in zona|vicino|aperto|aperti|elegante)(?=\s|$)|economic|tranquill)/i;
const NEW_AREA = /^(?:a|ad|in zona|vicino)(?=\s)/i;
// Ultima zona della ricerca precedente ("… a Trastevere"), da sostituire se se ne chiede un'altra.
const LAST_AREA = /\s+(?:a|ad|in|in zona|vicino a)\s+[^,]+$/i;

export function followUpQuery(previous: string, followUp: string): string {
  const q = followUp.trim().replace(/^(?:ma|però|pero|e)\s+/i, "");
  const words = followUp.trim().split(/\s+/).filter(Boolean);
  if (words.length > 4 || !REFINE_START.test(followUp.trim())) return followUp.trim();
  const prev = previous.trim();
  // Già chiesto: non si ripete ("più economico" due volte).
  if (prev.toLowerCase().includes(q.toLowerCase())) return prev;
  const base = NEW_AREA.test(q) ? prev.replace(LAST_AREA, "") : prev;
  return `${base} ${q}`.slice(0, 200);
}
