// "Grazie di essere tornato" (PROPOSTE.md 12): un piccolo omaggio deciso dal titolare verificato
// (un caffè, il dolce) per chi torna la 2ª o 3ª volta. Mai denaro né percentuali: quelli restano a Lorenzo.
// Funzioni pure, usate da server, scheda e pannello.

export type Omaggio = { testo: string; soglia: 2 | 3 };

export const OMAGGIO_MAX = 40;
export const OMAGGIO_OGNI_GIORNI = 30;

// Parole che trasformerebbero l'omaggio in uno sconto in denaro: non si accettano.
const DENARO = /[%€$]|\bsconto\b|\beuro\b|\bgratis il conto\b/i;

/** Testo e soglia puliti, o null (omaggio spento / non valido). */
export function pulisciOmaggio(testo: unknown, soglia: unknown): Omaggio | null {
  if (typeof testo !== "string") return null;
  const t = testo.replace(/\s+/g, " ").trim();
  if (t.length < 2 || t.length > OMAGGIO_MAX || DENARO.test(t)) return null;
  const s = Number(soglia);
  return { testo: t, soglia: s === 3 ? 3 : 2 };
}

/** Il giorno in Italia, "AAAA-MM-GG" (l'omaggio vale per il giorno del locale, non per l'ora UTC). */
export function giornoItalia(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Primo giorno in cui l'omaggio torna disponibile dopo quello usato il giorno `usato` ("AAAA-MM-GG"). */
export function prossimoOmaggio(usato: string): string {
  const [y, m, g] = usato.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, g + OMAGGIO_OGNI_GIORNI));
  return d.toISOString().slice(0, 10);
}

/** "30 ottobre" da "AAAA-MM-GG". */
export function giornoLeggibile(giorno: string): string {
  const [y, m, g] = giorno.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, g)).toLocaleDateString("it-IT", { day: "numeric", month: "long", timeZone: "UTC" });
}
