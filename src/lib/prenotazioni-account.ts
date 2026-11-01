import type { BookingRequest } from "@/lib/booking";

// Prenotazioni sull'account ("Cliente di parola", passo 2, PROPOSTE.md 3): forma ammessa dal server.
// Puro (usato dal server e dal telefono): tiene solo i campi noti, con tipi e lunghezze controllati.
export type PrenotazioneAccount = BookingRequest;

const VIE = new Set(["whatsapp", "telefono", "sito", "copiato"]);
const ESITI = new Set(["bene", "male", "non-andato"]);
const s = (v: unknown, max: number): string | null => (typeof v === "string" && v.length > 0 && v.length <= max ? v : null);
const n = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
// Istanti (ms) solo in un intervallo plausibile: 2020–2100.
const t = (v: unknown): number | null => { const x = n(v); return x != null && x >= 1_577_836_800_000 && x <= 4_102_444_800_000 ? x : null; };
const b = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : undefined);

// "AAAA-MM-GG" di un giorno che esiste (niente 31 febbraio: il database lo rifiuterebbe).
function dataVera(d: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const [y, m, g] = d.split("-").map(Number);
  const x = new Date(Date.UTC(y, m - 1, g));
  return x.getUTCFullYear() === y && x.getUTCMonth() === m - 1 && x.getUTCDate() === g;
}

export function pulisciPrenotazione(v: unknown): PrenotazioneAccount | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const id = s(o.id, 40);
  const placeId = s(o.placeId, 200);
  const placeName = s(o.placeName, 200);
  const createdAt = t(o.createdAt);
  if (!id || id.length < 4 || !placeId || !placeName || createdAt == null || !VIE.has(o.via as string)) return null;
  const date = s(o.date, 10);
  const time = s(o.time, 5);
  const people = n(o.people);
  const lat = n(o.lat);
  const lng = n(o.lng);
  const out: PrenotazioneAccount = {
    id,
    placeId,
    placeName,
    via: o.via as BookingRequest["via"],
    createdAt,
    date: date && dataVera(date) ? date : null,
    time: time && /^\d{2}:\d{2}$/.test(time) ? time : null,
    people: people != null && people >= 1 && people <= 50 ? Math.round(people) : null,
    special: s(o.special, 200),
    lat: lat != null && Math.abs(lat) <= 90 ? lat : null,
    lng: lng != null && Math.abs(lng) <= 180 ? lng : null,
    outcome: ESITI.has(o.outcome as string) ? (o.outcome as BookingRequest["outcome"]) : null,
    phone: s(o.phone, 40),
    riapre: t(o.riapre),
    disdetta: t(o.disdetta),
    piattaforma: s(o.piattaforma, 40),
  };
  const ciVado = t(o.ciVado);
  if (ciVado != null) out.ciVado = ciVado;
  const mod = t(o.modificataAt);
  if (mod != null) out.modificataAt = mod;
  for (const k of ["dismissed", "confirmed", "dismissedEve", "dismissedRisposta"] as const) {
    const val = b(o[k]);
    if (val !== undefined) out[k] = val;
  }
  return out;
}

// Unione telefono + account, per id: vale la versione modificata più di recente (modificataAt, dal
// 31/10; a parità o senza data vale il telefono), l'altra riempie i vuoti (per esempio "Com'è andata?"
// risposto su un altro telefono). Le prenotazioni che il telefono non ha
// arrivano dall'account. Ordine per data di creazione, ultime 30.
// Le tolte (lapidi dell'account o tolte qui in attesa) non tornano.
export function unisciPrenotazioni(locali: BookingRequest[], remote: BookingRequest[], tolte: Iterable<string> = []): BookingRequest[] {
  const via = new Set(tolte);
  const byId = new Map<string, BookingRequest>();
  for (const r of remote) if (!via.has(r.id)) byId.set(r.id, r);
  for (const l of locali) {
    if (via.has(l.id)) continue;
    const r = byId.get(l.id);
    if (!r) { byId.set(l.id, l); continue; }
    const [base, sopra] = ultimaModifica(r) > ultimaModifica(l) ? [l, r] : [r, l];
    const m: Record<string, unknown> = { ...base };
    for (const [k, val] of Object.entries(sopra)) if (val !== null && val !== undefined) m[k] = val;
    byId.set(l.id, m as BookingRequest);
  }
  return [...byId.values()].sort((a, c) => a.createdAt - c.createdAt).slice(-30);
}

// Quando è stata toccata l'ultima volta (le prenotazioni di prima del 31/10 non hanno la data).
export function ultimaModifica(p: BookingRequest): number {
  return p.modificataAt ?? p.createdAt;
}
