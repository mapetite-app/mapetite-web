// Scopritori (piano 5.6): un gioco leggero, non una classifica di popolarità.
// Conta solo i posti 💎 poco conosciuti (stessa regola del badge, src/lib/gem.ts) che una
// persona ha salvato; provarli vale doppio. Premia chi esce dai giri di massa (VISIONE.md),
// mai chi salva di più in assoluto. Dati: places.poco_conosciuto (migrazione 20261016_scopritori).

export type Gemme = { gemme: number; provate: number };

const LIVELLI = [
  { min: 1, nome: "Curioso" },
  { min: 3, nome: "Esploratore" },
  { min: 8, nome: "Esperto" },
  { min: 20, nome: "Cacciatore di gemme" },
] as const;

export type Livello = { livello: number; nome: string; punti: number; mancano: number | null };

export function punti(g: Gemme): number {
  return Math.max(0, g.gemme) + Math.max(0, Math.min(g.provate, g.gemme));
}

// livello 0 = nessuna gemma ancora; mancano = punti per il livello dopo (null all'ultimo).
export function livelloScopritore(g: Gemme): Livello {
  const p = punti(g);
  let i = -1;
  for (let k = 0; k < LIVELLI.length; k++) if (p >= LIVELLI[k].min) i = k;
  const next = LIVELLI[i + 1];
  return { livello: i + 1, nome: i >= 0 ? LIVELLI[i].nome : "Scopritore", punti: p, mancano: next ? next.min - p : null };
}

export function gemmeLabel(n: number): string {
  return `${n} ${n === 1 ? "posto poco conosciuto" : "posti poco conosciuti"}`;
}
