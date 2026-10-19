// Orari di apertura (dati Google della ricerca, solo da mostrare: niente di salvato sui nostri server).
// Forma compatta: [apertura, chiusura] in minuti dall'inizio della settimana (domenica 00:00),
// come i periodi di Google. Senza chiusura (h24) la chiusura è null. Nessun import con alias:
// il giro automatico importa questo file da Node.
export type Orari = [number, number | null][];
type Period = { open?: { day?: number; hour?: number; minute?: number }; close?: { day?: number; hour?: number; minute?: number } };

const WEEK = 7 * 24 * 60;
const DAYS = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];

export function compattaOrari(periods: Period[] | null | undefined): Orari | null {
  if (!periods || periods.length === 0) return null;
  const out: Orari = [];
  for (const p of periods) {
    if (!p.open || p.open.day == null) continue;
    const o = p.open.day * 1440 + (p.open.hour ?? 0) * 60 + (p.open.minute ?? 0);
    const c = p.close && p.close.day != null ? p.close.day * 1440 + (p.close.hour ?? 0) * 60 + (p.close.minute ?? 0) : null;
    out.push([o, c]);
  }
  return out.length ? out.slice(0, 21) : null;
}

const minutoSettimana = (d: Date) => d.getDay() * 1440 + d.getHours() * 60 + d.getMinutes();

// Aperto in quel momento? null = non si sa (orari mancanti).
export function apertoIl(orari: Orari | null | undefined, quando: Date): boolean | null {
  if (!orari || orari.length === 0) return null;
  const t = minutoSettimana(quando);
  for (const [o, c0] of orari) {
    if (c0 == null) return true;
    const c = c0 <= o ? c0 + WEEK : c0;
    if ((t >= o && t < c) || (t + WEEK >= o && t + WEEK < c)) return true;
  }
  return false;
}

const hhmm = (m: number) => `${String(Math.floor((m % 1440) / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

// "oggi alle 19:00", "domani alle 12:30", "lunedì alle 12:00": la prossima apertura dopo `da`.
export function prossimaApertura(orari: Orari | null | undefined, da: Date): string | null {
  if (!orari || orari.length === 0) return null;
  const t = minutoSettimana(da);
  let best: number | null = null;
  for (const [o] of orari) {
    const diff = (o - t + WEEK) % WEEK;
    if (diff > 0 && (best == null || diff < best)) best = diff;
  }
  if (best == null) return null;
  const at = t + best;
  const giorni = Math.floor(at / 1440) - Math.floor(t / 1440);
  const giorno = giorni === 0 ? "oggi" : giorni === 1 ? "domani" : DAYS[Math.floor(at / 1440) % 7];
  return `${giorno} alle ${hhmm(at)}`;
}

// "AAAA-MM-GG" + "HH:MM" → Date locale.
export function dataOra(date: string, time: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m || !t) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(t[1]), Number(t[2]));
}
