// "Menu delle feste" detto dal locale (PROPOSTE.md, proposta 90; migrazione 20261126_menu_feste.sql):
// il titolare di un locale VERIFICATO dice in quali giorni delle feste fa il menu (24, 25, 26, 31 dicembre,
// 1 gennaio), quanto costa a persona, se le bevande sono incluse e fino a quante persone prende i gruppi.
// Sulla scheda, nel riquadro del titolare: "🎄 Menu feste 65 €, bevande incluse · 24 e 25 dic · dice il locale".
// Niente testo libero, niente recensioni: solo parola del titolare. La riga vale solo nella stagione in cui è
// stata scritta (1 novembre – 6 gennaio) e sparisce da sola quando i giorni indicati sono passati.
// Funzioni pure e nessun import, così il giro automatico le prova anche senza server.

export const GIORNI_FESTE = [
  { k: "12-24", n: 24, mese: "dic", nome: "Vigilia" },
  { k: "12-25", n: 25, mese: "dic", nome: "Natale" },
  { k: "12-26", n: 26, mese: "dic", nome: "S. Stefano" },
  { k: "12-31", n: 31, mese: "dic", nome: "S. Silvestro" },
  { k: "01-01", n: 1, mese: "gen", nome: "Capodanno" },
] as const;
export type GiornoFeste = (typeof GIORNI_FESTE)[number]["k"];
export type MenuFeste = { prezzo: number; bevande: boolean; giorni: GiornoFeste[]; gruppi: number | null; at: string };

export const FESTE_PREZZO_MAX = 500;
export const FESTE_GRUPPI_MAX = 99;
const CHIAVI = GIORNI_FESTE.map((g) => g.k) as string[];

/** Giorno di oggi a Roma, AAAA-MM-GG (il server gira in UTC). */
export function oggiRomaFeste(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** La stagione delle feste di un giorno AAAA-MM-GG: l'anno del Natale (dal 1/11 al 6/1), altrimenti null. */
export function stagioneMenu(giorno: string | null | undefined): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(giorno ?? "");
  if (!m) return null;
  const y = Number(m[1]), mese = Number(m[2]), d = Number(m[3]);
  if (mese === 11 || mese === 12) return y;
  if (mese === 1 && d <= 6) return y - 1;
  return null;
}

/** La data vera (AAAA-MM-GG) di un giorno delle feste nella stagione: "01-01" è dell'anno dopo. */
export function dataFeste(k: GiornoFeste, stagione: number): string {
  return `${k === "01-01" ? stagione + 1 : stagione}-${k}`;
}

const intero = (v: unknown): number | null => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v.trim()) : typeof v === "number" ? v : NaN;
  return Number.isInteger(n) ? n : null;
};

/** Menu valido (prezzo 1..500, almeno un giorno noto, gruppi 2..99 o null), giorni nell'ordine del calendario; altrimenti null. */
export function pulisciMenuFeste(prezzo: unknown, bevande: unknown, giorni: unknown, gruppi: unknown, at: unknown): MenuFeste | null {
  const p = intero(prezzo);
  if (p == null || p < 1 || p > FESTE_PREZZO_MAX) return null;
  if (!Array.isArray(giorni)) return null;
  const g = CHIAVI.filter((k) => giorni.includes(k)) as GiornoFeste[];
  if (!g.length) return null;
  let gr: number | null = null;
  if (gruppi != null && gruppi !== "") {
    gr = intero(gruppi);
    if (gr == null || gr < 2 || gr > FESTE_GRUPPI_MAX) return null;
  }
  const quando = typeof at === "string" && !Number.isNaN(Date.parse(at)) ? at : "";
  return { prezzo: p, bevande: bevande === true, giorni: g, gruppi: gr, at: quando };
}

/** I giorni del menu ancora da venire (oggi compreso), solo se il menu è stato scritto in questa stagione. */
export function giorniValidi(menu: MenuFeste | null | undefined, oggi: string): GiornoFeste[] {
  if (!menu) return [];
  const s = stagioneMenu(oggi);
  if (s == null || stagioneMenu(oggiRomaFeste(new Date(menu.at || 0))) !== s) return [];
  return menu.giorni.filter((k) => dataFeste(k, s) >= oggi);
}

/** "24 e 25 dic", "24, 25, 31 dic e 1 gen", "1 gen". */
export function fraseGiorni(giorni: GiornoFeste[]): string {
  // Spazi che non vanno a capo tra numero e mese: mai "31" da una parte e "dic" dall'altra.
  const dic = GIORNI_FESTE.filter((g) => g.mese === "dic" && giorni.includes(g.k)).map((g) => String(g.n));
  const gen = giorni.includes("01-01");
  if (!dic.length) return gen ? "1\u00a0gen" : "";
  if (gen) return `${dic.join(", ")}\u00a0dic e 1\u00a0gen`;
  return `${dic.length > 1 ? `${dic.slice(0, -1).join(", ")} e ${dic[dic.length - 1]}` : dic[0]}\u00a0dic`;
}

/** Le parti della riga della scheda, o null se oggi non c'è niente da dire. */
export function rigaMenuFeste(menu: MenuFeste | null | undefined, oggi: string): { prezzo: string; dettagli: string[] } | null {
  const g = giorniValidi(menu, oggi);
  if (!menu || !g.length) return null;
  return {
    prezzo: `Menu feste ${menu.prezzo} €`,
    // Revisore 26/11: riga corta (i gruppi restano nel dato, non sulla scheda).
    dettagli: [`bevande ${menu.bevande ? "incluse" : "escluse"}`, fraseGiorni(g)],
  };
}
