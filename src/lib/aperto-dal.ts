// "Aperto da poco" (PROPOSTE.md, proposta 7; migrazione 20261020_aperto_dal.sql): il titolare di un
// locale VERIFICATO indica il mese di apertura; nei primi 12 mesi la scheda lo dice ("🆕 Aperto da
// 3 mesi"). Solo parola del titolare, mai dedotta. Non cambia l'ordine dei risultati.
// Funzioni pure e nessun import, così il giro automatico le prova anche senza server.

export const MESI_NUOVO = 12;

// Mese corrente a Roma: il server (UTC) e il telefono (ora italiana) devono dire lo stesso mese
// anche il primo del mese tra mezzanotte e le 2.
const meseRoma = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit" });
const ora = (now: Date) => { const [y, m] = meseRoma.format(now).split("-").map(Number); return y * 12 + m; };

/** "AAAA-MM" valido (anche dal database: "2026-07-01"), non nel futuro; altrimenti null. */
export function pulisciApertoDal(v: unknown, now: Date = new Date()): string | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{4})-(\d{2})(-\d{2})?$/.exec(v.trim());
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]);
  if (y < 1900 || mo < 1 || mo > 12) return null;
  if (y * 12 + mo > ora(now)) return null;
  return `${m[1]}-${m[2]}`;
}

/** Mesi interi passati dal mese di apertura (0 = aperto questo mese). */
export function mesiDaApertura(apertoDal: string, now: Date = new Date()): number {
  const [y, mo] = apertoDal.split("-").map(Number);
  return ora(now) - (y * 12 + mo);
}

/** La pillola della scheda, o null (oltre 12 mesi, dato assente o non valido). */
export function fraseApertura(apertoDal: unknown, now: Date = new Date()): string | null {
  const v = pulisciApertoDal(apertoDal, now);
  if (!v) return null;
  const n = mesiDaApertura(v, now);
  if (n >= MESI_NUOVO) return null;
  if (n === 0) return "Appena aperto";
  return n === 1 ? "Aperto da 1 mese" : `Aperto da ${n} mesi`;
}
