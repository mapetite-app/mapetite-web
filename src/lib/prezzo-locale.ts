// "Fascia di prezzo confermata dal locale" (PROPOSTE.md, proposta 65; migrazione 20261117_prezzo_medio.sql):
// il titolare di un locale VERIFICATO dice quanto si spende a testa (da/a, in euro) e se le bevande sono
// incluse. Solo parola del titolare, mai dedotta né mescolata con la fascia € di Google.
// Funzioni pure e nessun import, così il giro automatico le prova anche senza server.

export type Prezzo = { min: number; max: number; bevande: boolean };

export const PREZZO_MIN = 1;
export const PREZZO_MAX = 500;

const euro = (v: unknown): number | null => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v.trim().replace(",", ".")) : typeof v === "number" ? v : NaN;
  return Number.isInteger(n) && n >= PREZZO_MIN && n <= PREZZO_MAX ? n : null;
};

/** { min, max, bevande } valido (euro interi 1..500, min ≤ max); altrimenti null. */
export function pulisciPrezzo(min: unknown, max: unknown, bevande: unknown): Prezzo | null {
  const a = euro(min), b = euro(max);
  if (a == null || b == null || a > b) return null;
  return { min: a, max: b, bevande: bevande === true };
}

/** "25–35 € a testa, bevande escluse" (o "30 € a testa, bevande incluse"), o null.
 *  Con breve (pillola della scheda e anteprima del pannello): "25–35 € a testa", con le bevande sempre dette (revisore 4: "30 € a testa" da solo sembrava tutto compreso). */
export function frasePrezzo(p: { min?: unknown; max?: unknown; bevande?: unknown } | null | undefined, breve = false): string | null {
  const v = p ? pulisciPrezzo(p.min, p.max, p.bevande) : null;
  if (!v) return null;
  const base = `${v.min === v.max ? v.min : `${v.min}–${v.max}`} € a testa`;
  // Pillola corta (revisore 17/11: quella lunga occupava una riga da sola), ma le bevande incluse si vedono (revisore 2).
  if (breve) return `${base}, bevande ${v.bevande ? "incluse" : "escluse"}`;
  return `${base}, bevande ${v.bevande ? "incluse" : "escluse"}`;
}
