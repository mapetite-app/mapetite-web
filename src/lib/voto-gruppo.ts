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
};

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
