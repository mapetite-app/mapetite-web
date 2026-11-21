// Modulo senza dipendenze: lo importa anche scripts/e2e/giro.mjs per i controlli.
// Proposta 74 (L. 34/2026): la recensione si scrive entro 30 giorni dalla visita, come controlla il trigger
// reviews_da_visita (giorno di Roma). Senza data non si sa: si lascia decidere al database.
export function visitaOltre30(visitedAt: string | null, oggi = new Date()): boolean {
  if (typeof visitedAt !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(visitedAt)) return false;
  const giorno = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(oggi);
  const ms = Date.parse(`${giorno}T00:00:00Z`) - Date.parse(`${visitedAt.slice(0, 10)}T00:00:00Z`);
  return ms > 30 * 86_400_000;
}
