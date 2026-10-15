// Classifica personale (piano 4.3, come Beli): dopo "Ci sono stato" si chiede "Ti è piaciuto più o
// meno di X?" confrontando il locale con 1–3 altri visitati della stessa città (ricerca binaria
// sulla classifica). Più alto rank_score = piaciuto di più. Funzioni pure, senza dipendenze (le
// usa anche scripts/e2e/giro.mjs).

export const MAX_QUESTIONS = 3;

export type Search = { lo: number; hi: number; asked: number };

/** Inizio della ricerca su una classifica di n locali (ordinata dal più amato). */
export const startSearch = (n: number): Search => ({ lo: 0, hi: n, asked: 0 });

/** Indice del locale con cui confrontare adesso, o null se la posizione è decisa. */
export function nextCompare(s: Search, max = MAX_QUESTIONS): number | null {
  if (s.lo >= s.hi || s.asked >= max) return null;
  return Math.floor((s.lo + s.hi) / 2);
}

/** Risposta: better = il nuovo locale è piaciuto di più di quello all'indice mid. */
export function answer(s: Search, mid: number, better: boolean): Search {
  return better ? { lo: s.lo, hi: mid, asked: s.asked + 1 } : { lo: mid + 1, hi: s.hi, asked: s.asked + 1 };
}

/** Posizione finale (0 = primo). Con meno di 3 domande è esatta; oltre ~7 locali è approssimata. */
export const finalPosition = (s: Search) => s.lo;

/** Punteggio per inserire un locale alla posizione pos di una classifica ordinata dal più amato. */
export function scoreAt(sortedDesc: { score: number }[], pos: number): number {
  const above = sortedDesc[pos - 1]?.score;
  const below = sortedDesc[pos]?.score;
  if (above != null && below != null) return (above + below) / 2;
  if (above != null) return above - 1;
  if (below != null) return below + 1;
  return 0;
}

export function sortByScore<T extends { score: number }>(list: T[]): T[] {
  return [...list].sort((a, b) => b.score - a.score);
}

/** Classifiche per città (le città con più locali prima), al massimo perCity locali ciascuna. */
export function topByCity<T extends { city: string | null; score: number }>(rows: T[], perCity = 10): [string, T[]][] {
  const byCity = new Map<string, T[]>();
  for (const r of rows) {
    if (!r.city) continue;
    byCity.set(r.city, [...(byCity.get(r.city) ?? []), r]);
  }
  return [...byCity.entries()]
    .map(([city, list]) => [city, sortByScore(list)] as [string, T[]])
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "it"))
    .map(([city, list]) => [city, list.slice(0, perCity)]);
}

/** Errore di Supabase/PostgREST quando la colonna rank_score non esiste ancora (migrazione da applicare). */
export function isMissingColumn(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "42703" || error.code === "PGRST204" || /rank_score/.test(error.message ?? "");
}
