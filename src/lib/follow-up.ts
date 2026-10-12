// "Fai un'altra domanda": una domanda breve che affina ("più economico", "con giardino",
// "ma a Monti") continua la ricerca precedente; una frase nuova riparte da zero.
const REFINE_START = /^(più|meno|con|senza|anche|ma|però|e |solo|non|in zona|a |ad |vicino|aperto|aperti|economic|elegante|tranquill)/i;

export function followUpQuery(previous: string, followUp: string): string {
  const q = followUp.trim();
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length <= 4 && REFINE_START.test(q)) {
    return `${previous.trim()} ${q.replace(/^(ma|però|e)\s+/i, "")}`.slice(0, 200);
  }
  return q;
}
