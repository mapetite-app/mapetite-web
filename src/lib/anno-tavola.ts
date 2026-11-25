import { categoryLabel } from "@/lib/category-label";
import { cityFromAddress } from "@/lib/city";
import { LIKE, VISITED, visiteDi } from "@/lib/diario";

// "Il tuo anno a tavola" (proposta 49): il riepilogo dell'anno SOLO dai "Ci sono stato" dell'utente.
// Niente AI, niente Google: numeri contati, sempre veri. Un posto entra nell'anno se la visita ha una data
// di quell'anno, oppure (visita senza data) se è stato salvato in quell'anno. Date future: fuori.

export type AnnoRow = {
  id: string; // UUID di places
  name: string;
  category: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  pocoConosciuto: boolean | null;
  tags: string[];
  visite: number | null;
  visitedAt: string | null; // AAAA-MM-GG
  createdAt: string; // ISO
};

export type Punto = { x: number; y: number; su: boolean };

export type Anno = {
  anno: number;
  provati: number;
  volte: number; // visite contate, con i "Ci sono tornato" (saved_places.visite conta da sempre, non per anno:
  // nel 2026 è lo stesso perché l'app è nuova; dal 2027 servirà il conteggio per anno)
  tornati: number; // posti dove sei tornato almeno una volta
  piaciuti: number; // posti con 👍
  preferiti: { id: string; name: string; category: string | null; volte: number }[]; // 👍, max 3
  tipo: { label: string; count: number } | null; // solo se almeno 2
  mese: { label: string; count: number } | null; // solo se almeno 2 visite datate nello stesso mese, primo netto
  mesi: number[]; // 12 conteggi delle visite con la data, per le barre dell'immagine
  citta: { nome: string; count: number } | null;
  cittaCount: number;
  chicche: number; // posti poco conosciuti provati
  daProvare: number; // "Da provare" ancora aperti, per l'anno dopo
  mappa: { punti: Punto[]; citta: string | null } | null; // punti tra 0 e 1, almeno 2
};

const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const WANT = "Da provare";

/** Giorno di oggi a Roma, AAAA-MM-GG (il server gira in UTC). */
export function oggiRoma(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** L'anno da raccontare: fino al 15 gennaio quello appena finito, poi quello in corso. */
export function annoDa(now = new Date()): number {
  const [y, m, d] = oggiRoma(now).split("-").map(Number);
  return m === 1 && d <= 15 ? y - 1 : y;
}

/** Quando mostrare l'invito nel profilo: a dicembre. */
export function stagioneAnno(now = new Date()): boolean {
  return oggiRoma(now).slice(5, 7) === "12";
}

/** Anno della visita: la data scelta; senza data, l'anno (a Roma) in cui il posto è stato salvato. */
function annoVisita(r: AnnoRow, oggi: string): number | null {
  if (r.visitedAt) return r.visitedAt > oggi ? null : Number(r.visitedAt.slice(0, 4));
  const t = Date.parse(r.createdAt);
  return Number.isFinite(t) ? Number(oggiRoma(new Date(t)).slice(0, 4)) : null;
}

export function visitatiNellAnno(rows: AnnoRow[], anno: number, now = new Date()): AnnoRow[] {
  const oggi = oggiRoma(now);
  return rows.filter((r) => r.tags.includes(VISITED) && annoVisita(r, oggi) === anno);
}

// Il primo, solo se netto (revisore 25/11): a pari merito non si sceglie a caso ("La mia città: Roma" con
// cinque città da un posto ciascuna era un dato inventato).
function top(items: string[]): { key: string; count: number } | null {
  const m = new Map<string, number>();
  for (const it of items) m.set(it, (m.get(it) ?? 0) + 1);
  const ord = [...m.entries()].sort((a, b) => b[1] - a[1]);
  if (ord.length === 0 || (ord.length > 1 && ord[1][1] === ord[0][1])) return null;
  return { key: ord[0][0], count: ord[0][1] };
}

// Punti della mappa senza sfondo (niente mappe di Google): proiezione semplice nel riquadro 0–1,
// con la stessa scala sui due lati. Solo la città più girata, così i punti non finiscono in un angolo.
function mappaDi(rows: AnnoRow[], citta: string | null): Anno["mappa"] {
  const conPos = rows.filter((r) => typeof r.lat === "number" && typeof r.lng === "number" && Number.isFinite(r.lat) && Number.isFinite(r.lng));
  const stessa = citta ? conPos.filter((r) => cityFromAddress(r.address) === citta) : [];
  if (stessa.length < 2) return null;
  const scelti = stessa;
  const lat0 = scelti.reduce((s, r) => s + r.lat!, 0) / scelti.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const xs = scelti.map((r) => r.lng! * k);
  const ys = scelti.map((r) => -r.lat!);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const span = Math.max(maxX - minX, maxY - minY, 0.004); // almeno ~400 m: due posti vicini non si toccano ai bordi
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const punti = scelti.map((r, i) => ({ x: 0.5 + (xs[i] - cx) / span, y: 0.5 + (ys[i] - cy) / span, su: r.tags.includes(LIKE) }));
  // Senza una città con almeno 2 posti i punti sarebbero sparsi su mezza Italia: niente costellazione.
  return stessa.length >= 2 ? { punti, citta } : null;
}

export function buildAnno(rows: AnnoRow[], anno: number, now = new Date()): Anno {
  const visti = visitatiNellAnno(rows, anno, now);
  const volteDi = (r: AnnoRow) => visiteDi(r.tags, r.visite);
  const preferiti = visti
    .filter((r) => r.tags.includes(LIKE))
    .sort((a, b) => volteDi(b) - volteDi(a) || (b.visitedAt ?? "").localeCompare(a.visitedAt ?? "") || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3)
    .map((r) => ({ id: r.id, name: r.name, category: r.category, volte: volteDi(r) }));
  const tipoTop = top(visti.flatMap((r) => { const l = categoryLabel(r.category); return l ? [l] : []; }));
  const mesi = Array.from({ length: 12 }, () => 0);
  for (const r of visti) if (r.visitedAt && Number(r.visitedAt.slice(0, 4)) === anno) mesi[Number(r.visitedAt.slice(5, 7)) - 1]++;
  const meseTop = top(visti.flatMap((r) => (r.visitedAt && Number(r.visitedAt.slice(0, 4)) === anno ? [r.visitedAt.slice(5, 7)] : [])));
  const cittaNomi = visti.flatMap((r) => { const c = cityFromAddress(r.address); return c ? [c] : []; });
  const cittaTop = top(cittaNomi);
  return {
    anno,
    provati: visti.length,
    volte: visti.reduce((s, r) => s + volteDi(r), 0),
    tornati: visti.filter((r) => volteDi(r) >= 2).length,
    piaciuti: visti.filter((r) => r.tags.includes(LIKE)).length,
    preferiti,
    tipo: tipoTop && tipoTop.count >= 2 ? { label: tipoTop.key, count: tipoTop.count } : null,
    mese: meseTop && meseTop.count >= 2 ? { label: MESI[Number(meseTop.key) - 1], count: meseTop.count } : null,
    mesi,
    citta: cittaTop && cittaTop.count >= 2 ? { nome: cittaTop.key, count: cittaTop.count } : null,
    cittaCount: new Set(cittaNomi).size,
    chicche: visti.filter((r) => r.pocoConosciuto === true).length,
    daProvare: rows.filter((r) => r.tags.includes(WANT) && !r.tags.includes(VISITED)).length,
    mappa: mappaDi(visti, cittaTop?.key ?? null),
  };
}

export type Numero = { value: string; label: string };
/** Fino a 3 numeri, mai a zero (revisore 25/11: "0 posti fissi" sull'immagine era triste): prima le volte,
 *  poi i posti fissi, i poco conosciuti (il differenziatore), le città, i 👍. */
export function numeriAnno(a: Anno): Numero[] {
  const n = (v: number, uno: string, tanti: string): Numero | null => (v > 0 ? { value: String(v), label: v === 1 ? uno : tanti } : null);
  return [
    a.volte > a.provati ? n(a.volte, "volta a tavola", "volte a tavola") : null,
    n(a.tornati, "posto fisso", "posti fissi"),
    n(a.chicche, "poco conosciuto", "poco conosciuti"),
    a.cittaCount >= 2 ? n(a.cittaCount, "città", "città") : null,
    n(a.piaciuti, "ti è piaciuto", "ti sono piaciuti"),
  ].filter((x): x is Numero => x !== null).slice(0, 3);
}

/** Iniziali dei mesi per le barre dell'immagine. */
export const MESI_CORTI = MESI.map((m) => m.slice(0, 1).toUpperCase());
