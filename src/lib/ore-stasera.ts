// Senza import con "@/": il giro automatico lo importa direttamente con Node.
import type { WeekTime } from "./filter-options";

// Proposta 84 ("Fra 2 ore"): a che ora ci vai? "Adesso" più le due prossime ore dei pasti di oggi
// (13, 20, 21:30) ad almeno 30 minuti da adesso. Ora di Roma; il giorno 0 è la domenica, come Google.
// "riepilogo" è neutro ("alle 20", non "aperti alle 20"): i posti con orari non noti restano in lista (revisore 24/11).
export type OraStasera = { id: string; label: string; riepilogo: string; t: WeekTime };
const romeParts = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Rome", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const PASTI = [
  { id: "13", label: "Alle 13", riepilogo: "alle 13", hour: 13, minute: 0 },
  { id: "20", label: "Alle 20", riepilogo: "alle 20", hour: 20, minute: 0 },
  { id: "2130", label: "Alle 21:30", riepilogo: "alle 21:30", hour: 21, minute: 30 },
];
export function oreStasera(now = new Date()): OraStasera[] {
  const parts = Object.fromEntries(romeParts.formatToParts(now).map((p) => [p.type, p.value]));
  const day = DOW[parts.weekday] ?? now.getDay();
  const hour = Number(parts.hour) % 24;
  const minute = Number(parts.minute);
  const adesso = hour * 60 + minute;
  const dopo = PASTI.filter((p) => p.hour * 60 + p.minute >= adesso + 30).slice(0, 2);
  const lista: OraStasera[] = [
    { id: "adesso", label: "Adesso", riepilogo: "adesso", t: { day, hour, minute } },
    ...dopo.map((p) => ({ id: p.id, label: p.label, riepilogo: p.riepilogo, t: { day, hour: p.hour, minute: p.minute } })),
  ];
  // Dopo le 21: "Fra un'ora" (revisore 24/11: la sola "Adesso" era spoglia), finché resta nello stesso giorno.
  const fra = adesso + 60;
  if (dopo.length === 0 && fra < 24 * 60) lista.push({ id: "1h", label: "Fra un'ora", riepilogo: "fra un'ora", t: { day, hour: Math.floor(fra / 60), minute: fra % 60 } });
  return lista;
}

