// "Manda al gruppo" (proposta 56): parti comuni a telefono e server, senza dipendenze.
// Il sondaggio ha 2 o 3 posti, si chiude a un'ora scelta e accetta al massimo MAX_VOTANTI telefoni.

export const MAX_VOTANTI = 30;
export const MAX_AL_GIORNO = 10;
export const NOME_MAX = 30;
export const CODICE_RE = /^[A-Za-z0-9]{16,32}$/;
export const VOTANTE_RE = /^[A-Za-z0-9_-]{16,64}$/;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Quando si chiude: "tra 2 ore" o entro un'ora di sera (di oggi, ora di Roma).
export type Scelta = "2h" | "18" | "20" | "21";
export const SCELTE: { id: Scelta; label: string }[] = [
  { id: "2h", label: "Tra 2 ore" },
  { id: "18", label: "Ore 18" },
  { id: "20", label: "Ore 20" },
  { id: "21", label: "Ore 21" },
];
// Un'ora di sera vale solo se mancano almeno 30 minuti (meno non basta a far votare il gruppo).
const MARGINE_MS = 30 * 60_000;

const romaFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
function romaParti(d: Date): { y: number; m: number; g: number; h: number; min: number } {
  const p = Object.fromEntries(romaFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), g: Number(p.day), h: Number(p.hour), min: Number(p.minute) };
}

/** Oggi alle `ora` in punto, ora di Roma (anche con l'ora legale). */
export function oggiAlle(ora: number, now: Date = new Date()): Date {
  const r = romaParti(now);
  let t = Date.UTC(r.y, r.m - 1, r.g, ora, 0);
  const q = romaParti(new Date(t));
  // Scarto tra l'ora letta a Roma e quella voluta: è il fuso (1 o 2 ore).
  t -= Date.UTC(q.y, q.m - 1, q.g, q.h, q.min) - Date.UTC(r.y, r.m - 1, r.g, ora, 0);
  return new Date(t);
}

/** Quando si chiude con questa scelta, oppure null se l'ora è già (quasi) passata. */
export function chiusura(scelta: Scelta, now: Date = new Date()): Date | null {
  if (scelta === "2h") return new Date(now.getTime() + 2 * 3_600_000);
  const d = oggiAlle(Number(scelta), now);
  return d.getTime() - now.getTime() >= MARGINE_MS ? d : null;
}

export function isScelta(v: unknown): v is Scelta {
  return v === "2h" || v === "18" || v === "20" || v === "21";
}

/** Le scelte che valgono adesso e quella proposta: le 20 se si fa in tempo, poi le 21, se no tra 2 ore. */
export function scelteOra(now: Date = new Date()): { scelte: typeof SCELTE; predefinita: Scelta } {
  const scelte = SCELTE.filter((s) => chiusura(s.id, now) != null);
  const predefinita: Scelta = scelte.some((s) => s.id === "20") ? "20" : scelte.some((s) => s.id === "21") ? "21" : "2h";
  return { scelte, predefinita };
}

/** "alle 20:00" (oggi), "domani alle 0:30" se passa la mezzanotte. */
export function oraChiusura(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const r = romaParti(d);
  const n = romaParti(now);
  const ora = `${r.h}:${String(r.min).padStart(2, "0")}`;
  return r.g === n.g && r.m === n.m ? `alle ${ora}` : `domani alle ${ora}`;
}

export function nomePulito(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const n = v.replace(/\s+/g, " ").trim();
  return n.length >= 1 && n.length <= NOME_MAX ? n : null;
}

export type VotoPosto = {
  id: string; // UUID del catalogo
  gid: string | null; // Google Place ID
  nome: string;
  categoria: string | null;
  zona: string | null;
  lat: number | null;
  lng: number | null;
  verdetto: string | null;
};
export type VotoStato = {
  codice: string;
  chiudeAlle: string;
  chiuso: boolean;
  sonoIo: boolean;
  posti: VotoPosto[];
  // Chi ha votato cosa: solo i nomi scritti, in ordine di voto.
  voti: { posto: string; nome: string }[];
  mioVoto: string | null;
  pieno: boolean;
  // "Chi viene?" (proposta 94): il tavolo prenotato da chi ha proposto, e chi ha risposto "Ci sei?".
  tavolo: Tavolo | null;
  presenze: { nome: string; ciSono: boolean }[];
  miaPresenza: boolean | null;
  // Telefoni che hanno votato ma non hanno ancora detto se ci sono.
  senzaRisposta: number;
};
export type Tavolo = { posto: string; alle: string; persone: number };

/** Il più votato; a pari voti vince il primo in ordine (quello più in tema). null senza voti. */
export function vincitore(stato: Pick<VotoStato, "posti" | "voti">): { id: string; pari: boolean } | null {
  const conta = new Map<string, number>();
  for (const v of stato.voti) conta.set(v.posto, (conta.get(v.posto) ?? 0) + 1);
  let best: string | null = null;
  let max = 0;
  let pari = false;
  for (const p of stato.posti) {
    const n = conta.get(p.id) ?? 0;
    if (n > max) { best = p.id; max = n; pari = false; } else if (n === max && n > 0) pari = true;
  }
  return best ? { id: best, pari } : null;
}

// ── "Chi viene?" (proposta 94) ─────────────────────────────────────────────────────────────────────────
export const PERSONE_MIN = 2;
export const PERSONE_MAX = 30;
// Il tavolo si può fissare fino a 21 giorni dopo il voto (il voto si cancella dopo 30).
export const TAVOLO_GIORNI = 21;
// Dopo 3 ore dall'ora del tavolo non si risponde più.
export const RISPOSTE_FINO_MS = 3 * 3_600_000;

/** Il giorno `key` ("AAAA-MM-GG") alle `ora` ("HH:MM"), ora di Roma. null se non valido. */
export function romaAlle(key: string, ora: string): Date | null {
  const k = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  const o = /^(\d{1,2}):(\d{2})$/.exec(ora);
  if (!k || !o) return null;
  const [y, m, g, h, min] = [Number(k[1]), Number(k[2]), Number(k[3]), Number(o[1]), Number(o[2])];
  if (m < 1 || m > 12 || g < 1 || g > 31 || h > 23 || min > 59) return null;
  let t = Date.UTC(y, m - 1, g, h, min);
  const q = romaParti(new Date(t));
  t -= Date.UTC(q.y, q.m - 1, q.g, q.h, q.min) - Date.UTC(y, m - 1, g, h, min);
  const d = new Date(t);
  const r = romaParti(d);
  return r.g === g && r.m === m && r.h === h && r.min === min ? d : null;
}

/** Il giorno di Roma ("AAAA-MM-GG") di una data, spostato di `piu` giorni. */
export function giornoRoma(d: Date, piu = 0): string {
  const r = romaParti(d);
  const x = new Date(Date.UTC(r.y, r.m - 1, r.g + piu));
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}-${String(x.getUTCDate()).padStart(2, "0")}`;
}

const GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

/** "stasera alle 20:30", "oggi alle 13:00", "domani alle 20:30", "venerdì 19 dicembre alle 20:30". */
export function quandoTavolo(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const r = romaParti(d);
  const ora = `${r.h}:${String(r.min).padStart(2, "0")}`;
  const giorno = giornoRoma(d);
  if (giorno === giornoRoma(now)) return `${r.h >= 17 ? "stasera" : "oggi"} alle ${ora}`;
  if (giorno === giornoRoma(now, 1)) return `domani alle ${ora}`;
  const dow = new Date(Date.UTC(r.y, r.m - 1, r.g)).getUTCDay();
  return `${GIORNI[dow]} ${r.g} ${MESI[r.m - 1]} alle ${ora}`;
}

/** Si risponde ancora a "Ci sei?" (fino a 3 ore dopo l'ora del tavolo). */
export function risposteAperte(t: Tavolo | null, now: Date = new Date()): boolean {
  return !!t && new Date(t.alle).getTime() + RISPOSTE_FINO_MS > now.getTime();
}

/**
 * Quanti ci sono, se conviene avvisare il locale (revisore 28/11: mai un numero tirato a indovinare).
 * Solo per chi organizza e dopo che ha risposto anche lui (se no il suo posto non è contato); i "sì" sono
 * almeno 2 e diversi dal numero prenotato; e hanno risposto tutti quelli che hanno votato, oppure mancano
 * meno di 3 ore (chi non ha risposto a quel punto non viene). Mai dopo l'ora del tavolo.
 */
export function daAvvisare(stato: Pick<VotoStato, "tavolo" | "presenze" | "senzaRisposta" | "sonoIo" | "miaPresenza">, now: Date = new Date()): number | null {
  const t = stato.tavolo;
  if (!t || !stato.sonoIo || stato.miaPresenza == null) return null;
  const mancaMs = new Date(t.alle).getTime() - now.getTime();
  if (mancaMs <= 0) return null;
  const si = stato.presenze.filter((p) => p.ciSono).length;
  if (si < PERSONE_MIN || si === t.persone) return null;
  if (stato.senzaRisposta > 0 && mancaMs > 3 * 3_600_000) return null;
  return si;
}

/** Il messaggio pronto per il locale quando il numero cambia. */
export function messaggioNumero(persone: number, nuovo: number, quando: string, nome: string | null, now: Date = new Date()): string {
  const saluto = romaParti(now).h < 13 ? "Buongiorno" : "Buonasera";
  const firma = nome?.trim() ? ` a nome ${nome.trim()}` : "";
  return `${saluto}, ho prenotato per ${persone} persone ${quando}${firma}: saremo in ${nuovo}. Grazie!`;
}
