// "Serate tranquille" (docs/autonomia/POSIZIONAMENTO.md, proposta 1): il titolare di un locale
// VERIFICATO dice in quali giorni della settimana ha posto. Nella scheda compare una riga sola
// ("Stasera c'è posto", "Martedì e mercoledì c'è posto"), sempre come parola del locale.
// Non cambia mai l'ordine dei risultati (VISIONE: niente premi a chi paga o a chi è più noto).
// L'informazione scade dopo VALIDITA_GIORNI senza conferma: meglio niente che un "c'è posto" vecchio.
// Funzioni pure e nessun import, così il giro automatico le prova anche senza server.

// 0 = domenica … 6 = sabato, come Date.getDay().
export const GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"] as const;
// Ordine della settimana italiana, per i pulsanti del pannello e per le frasi.
export const SETTIMANA = [1, 2, 3, 4, 5, 6, 0] as const;
export const VALIDITA_GIORNI = 60;

const romeWeekday = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Rome", weekday: "short" });
const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Giorno della settimana a Roma (0 = domenica). */
export function oggiARoma(now: number = Date.now()): number {
  return WD[romeWeekday.format(new Date(now))] ?? new Date(now).getDay();
}

/** Giorni validi, senza doppioni, nell'ordine della settimana italiana. */
export function pulisciGiorni(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  const set = new Set(v.filter((x): x is number => Number.isInteger(x) && x >= 0 && x <= 6));
  return SETTIMANA.filter((g) => set.has(g));
}

/** Ancora valida? (aggiornata negli ultimi VALIDITA_GIORNI giorni) */
export function seraValida(at: string | null | undefined, now: number = Date.now()): boolean {
  if (!at) return false;
  const t = Date.parse(at);
  return Number.isFinite(t) && now - t <= VALIDITA_GIORNI * 86_400_000 && t <= now + 86_400_000;
}

const elenco = (nomi: string[]) => (nomi.length <= 1 ? nomi.join("") : `${nomi.slice(0, -1).join(", ")} e ${nomi.at(-1)}`);
const maiuscola = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * La riga della scheda, o null. Solo per locali verificati con giorni scelti e ancora validi.
 * Oggi tra i giorni → "Stasera c'è posto" (gli altri giorni dopo, se ci sono).
 * Tutti i giorni → "C'è posto tutte le sere" (scelta strana ma possibile: si dice com'è).
 */
export function frasePosto(
  info: { verificato: boolean; giorni: number[]; at: string | null } | null | undefined,
  now: number = Date.now(),
): string | null {
  if (!info?.verificato || !seraValida(info.at, now)) return null;
  const giorni = pulisciGiorni(info.giorni);
  if (giorni.length === 0) return null;
  if (giorni.length === 7) return "C'è posto tutte le sere";
  const oggi = oggiARoma(now);
  if (giorni.includes(oggi)) {
    const altri = giorni.filter((g) => g !== oggi).map((g) => GIORNI[g]);
    return altri.length ? `Stasera c'è posto (anche ${elenco(altri)})` : "Stasera c'è posto";
  }
  // Dal prossimo giorno in avanti: "Martedì e mercoledì", partendo da quello più vicino.
  const ordinati = [...giorni].sort((a, b) => ((a - oggi + 7) % 7) - ((b - oggi + 7) % 7));
  return `${maiuscola(elenco(ordinati.map((g) => GIORNI[g])))} c'è posto`;
}
