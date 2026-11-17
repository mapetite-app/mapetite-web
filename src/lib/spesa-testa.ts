// "Quanto si spende davvero (detto da chi c'è stato)" (PROPOSTE.md, proposta 64; migrazione 20261117b_spesa_testa.sql).
// Chi c'è stato dice in quale fascia ha speso a testa (saved_places.spesa_testa, 1..4, privata). La scheda mostra
// la fascia più scelta solo da 5 risposte vere in su: mai inventata, mai mescolata con i € di Google né con il
// prezzo detto dal locale (proposta 65, prezzo-locale.ts). Funzioni pure e nessun import: il giro automatico le prova.

export type FasciaSpesa = 1 | 2 | 3 | 4;
export type SpesaVissuta = { fascia: FasciaSpesa; risposte: number };

export const MIN_RISPOSTE_SPESA = 5; // come la funzione del database (revisore 17/11: privacy)

/** Etichette dei 4 tasti del foglio "Com'è andata?" e nome per chi usa il lettore di schermo. */
export const FASCE_SPESA: ReadonlyArray<{ v: FasciaSpesa; label: string; nome: string }> = [
  { v: 1, label: "< 15 €", nome: "meno di 15 €" },
  { v: 2, label: "15–30", nome: "15–30 €" },
  { v: 3, label: "30–50", nome: "30–50 €" },
  { v: 4, label: "> 50 €", nome: "oltre 50 €" },
];

/** Valore valido 1..4 (anche dal database come stringa), altrimenti null. */
export function pulisciFascia(v: unknown): FasciaSpesa | null {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return n === 1 || n === 2 || n === 3 || n === 4 ? n : null;
}

/** Riga della funzione del database → dato per la scheda, solo con almeno 5 risposte. */
export function pulisciSpesa(row: { fascia?: unknown; risposte?: unknown } | null | undefined): SpesaVissuta | null {
  const fascia = pulisciFascia(row?.fascia);
  const risposte = Number(row?.risposte);
  if (fascia == null || !Number.isInteger(risposte) || risposte < MIN_RISPOSTE_SPESA) return null;
  return { fascia, risposte };
}

/** "15–30 € a testa · chi c'è stato", o null sotto le 5 risposte. */
export function fraseSpesa(s: { fascia?: unknown; risposte?: unknown } | null | undefined, breve = false): string | null {
  const v = pulisciSpesa(s);
  const f = v ? FASCE_SPESA.find((x) => x.v === v.fascia) : null;
  if (!f) return null;
  return breve ? `${f.nome} a testa` : `${f.nome} a testa · chi c'è stato`;
}
