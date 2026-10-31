import type { BookingRequest } from "@/lib/booking";

// Prenotazioni sull'account ("Cliente di parola", passo 2, PROPOSTE.md 3): forma ammessa dal server.
// Puro (usato dal server e dal telefono): tiene solo i campi noti, con tipi e lunghezze controllati.
export type PrenotazioneAccount = BookingRequest;

const VIE = new Set(["whatsapp", "telefono", "sito", "copiato"]);
const ESITI = new Set(["bene", "male", "non-andato"]);
const s = (v: unknown, max: number): string | null => (typeof v === "string" && v.length > 0 && v.length <= max ? v : null);
const n = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const b = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : undefined);

export function pulisciPrenotazione(v: unknown): PrenotazioneAccount | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const id = s(o.id, 40);
  const placeId = s(o.placeId, 200);
  const placeName = s(o.placeName, 200);
  const createdAt = n(o.createdAt);
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
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    time: time && /^\d{2}:\d{2}$/.test(time) ? time : null,
    people: people != null && people >= 1 && people <= 50 ? Math.round(people) : null,
    special: s(o.special, 200),
    lat: lat != null && Math.abs(lat) <= 90 ? lat : null,
    lng: lng != null && Math.abs(lng) <= 180 ? lng : null,
    outcome: ESITI.has(o.outcome as string) ? (o.outcome as BookingRequest["outcome"]) : null,
    phone: s(o.phone, 40),
    riapre: n(o.riapre),
    disdetta: n(o.disdetta),
    piattaforma: s(o.piattaforma, 40),
  };
  for (const k of ["dismissed", "confirmed", "dismissedEve", "dismissedRisposta"] as const) {
    const val = b(o[k]);
    if (val !== undefined) out[k] = val;
  }
  return out;
}

// Unione telefono + account, per id: vale il dato del telefono, quello dell'account riempie i vuoti
// (per esempio "Com'è andata?" risposto su un altro telefono). Le prenotazioni che il telefono non ha
// arrivano dall'account. Ordine per data di creazione, ultime 30.
export function unisciPrenotazioni(locali: BookingRequest[], remote: BookingRequest[]): BookingRequest[] {
  const byId = new Map<string, BookingRequest>();
  for (const r of remote) byId.set(r.id, r);
  for (const l of locali) {
    const r = byId.get(l.id);
    if (!r) { byId.set(l.id, l); continue; }
    const m: Record<string, unknown> = { ...r };
    for (const [k, val] of Object.entries(l)) if (val !== null && val !== undefined) m[k] = val;
    byId.set(l.id, m as BookingRequest);
  }
  return [...byId.values()].sort((a, c) => a.createdAt - c.createdAt).slice(-30);
}
