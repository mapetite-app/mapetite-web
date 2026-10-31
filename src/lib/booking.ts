// Prenotazione assistita (piano 1.3): capire giorno, ora e persone da una frase
// ("prenotami domani alle 21 per 2 con terrazza a Roma") SENZA AI, e scrivere il messaggio
// per il locale. Nessun dato inventato: Mapetite non vede i tavoli liberi, la conferma arriva
// sempre dal locale. Nessun import con alias: il giro automatico importa questo file da Node.

export type BookingDetails = {
  date: string | null;    // "AAAA-MM-GG" (giorno locale del telefono)
  time: string | null;    // "HH:MM"
  people: number | null;
  special: string | null; // richiesta speciale già in italiano: "in terrazza", "all'aperto"…
};

export type ParsedBooking = BookingDetails & {
  isBooking: boolean;     // la frase chiede di prenotare
  search: string | null;  // cosa cercare, senza giorno/ora/persone (null = solo dettagli)
};

const WEEKDAYS = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
// Niente \b dopo "ì": in JavaScript \b conosce solo le lettere senza accento.
const WEEKDAY_STEMS: [string, number][] = [
  ["domenica", 0], ["luned[iì]", 1], ["marted[iì]", 2], ["mercoled[iì]", 3],
  ["gioved[iì]", 4], ["venerd[iì]", 5], ["sabato", 6],
];
const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const NUMBER_WORDS: Record<string, number> = {
  uno: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10,
  undici: 11, dodici: 12,
};
const NUM = `(\\d{1,2}|${Object.keys(NUMBER_WORDS).join("|")})`;
// Per le persone niente "uno/una" ("prenota per una cena") e niente "sei" ("sei libero?").
const PEOPLE_NUM = `(\\d{1,2}|${Object.keys(NUMBER_WORDS).filter((w) => !["uno", "una", "sei"].includes(w)).join("|")})`;
const toNum = (s: string): number => (/^\d+$/.test(s) ? Number(s) : NUMBER_WORDS[s] ?? NaN);

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}
export function fromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Le parti riconosciute vengono tolte dal testo: quello che resta è cosa cercare.
type Cut = { re: RegExp };

export function parseBooking(text: string, now: Date = new Date()): ParsedBooking {
  const t = ` ${text.toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, " ").trim()} `;
  const cuts: Cut[] = [];
  const take = (re: RegExp) => { cuts.push({ re }); };

  let isBooking = /\bprenot|\btavolo\b/.test(t);

  // Giorno
  let date: string | null = null;
  let evening = /\b(stasera|sera|cena|stanotte)\b/.test(t);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (/\bdopodomani\b/.test(t)) { date = dateKey(addDays(today, 2)); take(/\bdopodomani( sera| a cena| a pranzo)?\b/); }
  else if (/\bdomani\b/.test(t)) { date = dateKey(addDays(today, 1)); take(/\bdomani( sera| a cena| a pranzo)?\b/); }
  else if (/\b(stasera|stanotte|oggi)\b/.test(t)) { date = dateKey(today); take(/\b(stasera|stanotte|oggi( a pranzo| a cena)?)\b/); }
  if (!date) {
    // "il 18 ottobre", "18/10", "il 18"
    const dm = t.match(/\b(?:il |per il )?(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?\b/);
    const dn = t.match(new RegExp(`\\b(?:il |per il )?(\\d{1,2}) (${MONTHS.join("|")})\\b`));
    const dd = t.match(/\b(?:il|per il) (\d{1,2})\b(?! ?(?:persone|person|euro|€|km|:|\.\d))/);
    let day = NaN, month = NaN;
    if (dm) { day = Number(dm[1]); month = Number(dm[2]) - 1; take(/\b(?:il |per il )?\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/); }
    else if (dn) { day = Number(dn[1]); month = MONTHS.indexOf(dn[2]); take(new RegExp(`\\b(?:il |per il )?\\d{1,2} (${MONTHS.join("|")})\\b`)); }
    else if (dd && isBooking) { day = Number(dd[1]); month = today.getMonth(); if (day < today.getDate()) month++; take(/\b(?:il|per il) \d{1,2}\b/); }
    if (day >= 1 && day <= 31 && month >= 0 && month <= 12) {
      let d = new Date(today.getFullYear(), month, day);
      if (d < today) d = new Date(today.getFullYear() + 1, month, day);
      date = dateKey(d);
    }
  }
  if (!date) {
    for (const [stem, wd] of WEEKDAY_STEMS) {
      if (new RegExp(`\\b${stem}(?![a-z])`).test(t)) {
        const diff = (wd - today.getDay() + 7) % 7;
        date = dateKey(addDays(today, diff));
        take(new RegExp(`\\b(?:per |di )?${stem}( prossim[oa])?( sera| a cena| a pranzo)?(?![a-z])`));
        break;
      }
    }
  }

  // Ora: "alle 21", "alle 21:30", "alle 9 e mezza", "ore 20", "per le 20.30"
  let time: string | null = null;
  const tm = t.match(new RegExp(`\\b(?:alle|ore|per le|verso le|h)\\s?${NUM}(?:[:.](\\d{2}))?( e mezza| e un quarto| e trenta)?\\b`))
    ?? t.match(/\b(\d{1,2})[:.](\d{2})\b/);
  if (tm) {
    let h = toNum(tm[1]);
    let m = tm[2] ? Number(tm[2]) : 0;
    if (tm[3]?.includes("mezza") || tm[3]?.includes("trenta")) m = 30;
    if (tm[3]?.includes("quarto")) m = 15;
    // "alle 9 stasera", "alle 8 a cena": di sera.
    if (h >= 1 && h <= 11 && (evening || h <= 6)) h += 12;
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      take(new RegExp(`\\b(?:alle|ore|per le|verso le|h)\\s?${NUM}(?:[:.]\\d{2})?( e mezza| e un quarto| e trenta)?\\b`));
      take(/\b\d{1,2}[:.]\d{2}\b/);
    }
  }
  if (time) evening = evening || Number(time.slice(0, 2)) >= 18;

  // Persone: "per 2", "in 4", "per due", "2 persone", "siamo in 3", "per noi due"
  let people: number | null = null;
  const pm = t.match(new RegExp(`\\b(?:siamo in|tavolo per|per|in|x)\\s(?:noi\\s)?${PEOPLE_NUM}(?: persone| person[ae]| adulti)?\\b(?![:.\\/]\\d)`))
    ?? t.match(new RegExp(`\\b${PEOPLE_NUM} (?:persone|adulti|coperti)\\b`));
  if (pm) {
    const n = toNum(pm[1]);
    if (n >= 1 && n <= 30) {
      people = n;
      take(new RegExp(`\\b(?:siamo in|tavolo per|per|in|x)\\s(?:noi\\s)?${PEOPLE_NUM}(?: persone| person[ae]| adulti)?\\b(?![:.\\/]\\d)`));
      take(new RegExp(`\\b${PEOPLE_NUM} (?:persone|adulti|coperti)\\b`));
    }
  } else if (/\b(in due|per due|in coppia|io e (la mia|il mio)|anniversario)\b/.test(t)) {
    people = 2;
  }

  // "siamo in 5 venerdì sera": persone e giorno insieme sono già una prenotazione.
  if (!isBooking && people && people !== 2 && (date || time)) isBooking = true;
  if (!isBooking && people && /\b(siamo in|tavolo)\b/.test(t)) isBooking = true;

  // Richiesta speciale per il messaggio (solo ciò che è scritto).
  const wishes: string[] = [];
  if (/terrazz/.test(t)) wishes.push("in terrazza");
  else if (/all'aperto|all aperto|\bfuori\b|dehors|esterno|giardino/.test(t)) wishes.push("all'aperto");
  if (/\bvista\b/.test(t)) wishes.push("con vista");
  if (/tranquill|appartat|riservat/.test(t)) wishes.push("in un tavolo tranquillo");
  if (/seggiolon|passeggino|bambin/.test(t)) wishes.push("con un seggiolone per un bambino");
  if (/senza glutine|celiac/.test(t)) wishes.push("con attenzione al senza glutine");
  if (/\bcane\b|\bcani\b/.test(t)) wishes.push("con un cane");
  const special = wishes.length ? wishes.join(", ") : null;

  // Cosa cercare: la frase senza le parti di prenotazione.
  let rest = t;
  for (const c of cuts) rest = rest.replace(c.re, " ");
  rest = rest
    .replace(/\b(vorrei |voglio |puoi |mi |ci )?(prenotami|prenotaci|prenota|prenotare|prenotazione|prenoti)\b/g, " ")
    .replace(/\b(trovami|trovaci|cercami|cerca)\b/g, " ")
    .replace(/\bun tavolo\b|\btavolo\b/g, " ")
    .replace(/\b(per favore|grazie)\b/g, " ")
    .replace(/[,.!?]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:(?:e|per|a|da|un|una|di)\s+)+/, "")
    .replace(/(?:\s+(?:e|per|a|da|di))+$/, "")
    .trim();
  const meaningful = rest.replace(/\b(a|ad|in|per|con|e|un|una|il|la|lo|di|da|noi|sera|a cena|cena|a pranzo|pranzo)\b/g, "").trim();
  let search: string | null = meaningful.length >= 3 ? rest : null;
  // "prenotami … con terrazza a Roma": senza il tipo di locale si cerca un ristorante (si prenota lì).
  const hasType = /\b(ristorant|trattori|osteri|pizzeri|sushi|bar|pub|enotec|bistr|cocktail|aperitiv|brunch|colazion|cena|pranzo|rooftop|locale|posto|steak|braceri|giappones|cines|indian|messican|vegan|vegetarian|pesce|carne|gelat|pasticc|caff|forno|hamburger|burger|ramen|taverna|tapas|wine)/.test(rest);
  if (search && isBooking && !hasType) search = `ristorante ${search}`;
  if (!search && isBooking && (date || time || people) && special) search = `ristorante ${special}`;
  if (search && /\b(a cena|cena)\b/.test(t) && !/\bcena\b/.test(search) && isBooking && !hasType) search = search.replace(/^ristorante/, "ristorante per cena");

  return { isBooking, date, time, people, special, search: search ? search.slice(0, 200) : null };
}

// "oggi", "domani", "sabato 18/10"
export function dayLabel(date: string, now: Date = new Date()): string {
  const d = fromKey(date);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  const dm = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  if (diff === 0) return `oggi ${dm}`;
  if (diff === 1) return `domani ${dm}`;
  return `${WEEKDAYS[d.getDay()]} ${dm}`;
}

// Cosa manca per poter scrivere al locale.
export function missingDetails(b: BookingDetails): ("persone" | "giorno" | "ora")[] {
  const out: ("persone" | "giorno" | "ora")[] = [];
  if (!b.people) out.push("persone");
  if (!b.date) out.push("giorno");
  if (!b.time) out.push("ora");
  return out;
}

// Il messaggio per il locale: cortese, breve, modificabile. Solo dati scelti dall'utente.
// volta: "Sarà la mia 3ª volta da voi" (PROPOSTE.md 11), solo se l'utente lo accende nel foglio Prenota.
export function bookingMessage(b: BookingDetails, name: string | null, now: Date = new Date(), volta: number | null = null, parola: number | null = null): string {
  const greeting = now.getHours() < 13 ? "Buongiorno" : "Buonasera";
  const parts = [`${greeting}, vorrei prenotare un tavolo`];
  if (b.people) parts.push(` per ${b.people} ${b.people === 1 ? "persona" : "persone"}`);
  if (b.date) parts.push(` ${dayLabel(b.date, now)}`);
  if (b.time) parts.push(` alle ${b.time}`);
  if (b.special) parts.push(`, ${b.special} se possibile`);
  parts.push(". È disponibile?");
  if (volta && volta >= 2) parts.push(` Sarà la mia ${volta}ª volta da voi.`);
  if (parola && parola >= PAROLA_MIN) parts.push(` Con Mapetite ho già prenotato ${parola} tavoli, anche altrove: sempre presente o disdetto in tempo.`);
  const sign = name?.trim() ? `Grazie, ${name.trim()}` : "Grazie";
  return `${parts.join("")} ${sign}`;
}

// Disdetta (contro i tavoli prenotati e vuoti: 12,8% in media, docs/autonomia/POSIZIONAMENTO.md):
// il messaggio per il locale, già scritto, così avvisare costa un tocco.
export function cancelMessage(b: BookingDetails, name: string | null, now: Date = new Date()): string {
  const greeting = now.getHours() < 13 ? "Buongiorno" : "Buonasera";
  const parts = [`${greeting}, purtroppo non riesco a venire: disdico la prenotazione`];
  if (b.people) parts.push(` per ${b.people} ${b.people === 1 ? "persona" : "persone"}`);
  if (b.date) parts.push(` di ${dayLabel(b.date, now)}`);
  if (b.time) parts.push(` alle ${b.time}`);
  parts.push(". Mi scuso, così potete dare il tavolo a qualcun altro.");
  const sign = name?.trim() ? `Grazie, ${name.trim()}` : "Grazie";
  return `${parts.join("")} ${sign}`;
}

// Numero per WhatsApp: solo i cellulari italiani (3xx) o numeri già internazionali.
// Un fisso di solito non ha WhatsApp: meglio non proporre una via che non funziona.
export function whatsappNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const clean = phone.replace(/[^\d+]/g, "");
  if (clean.startsWith("+39")) return /^\+393\d{8,9}$/.test(clean) ? clean.slice(1) : null;
  if (clean.startsWith("0039")) return /^00393\d{8,9}$/.test(clean) ? clean.slice(2) : null;
  if (clean.startsWith("+")) return null; // estero: non sappiamo se è un cellulare
  return /^3\d{8,9}$/.test(clean) ? `39${clean}` : null;
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

// ── Prenotazioni richieste, salvate nel telefono (localStorage) ──
export type BookingRequest = BookingDetails & {
  id: string;
  placeId: string;
  placeName: string;
  lat: number | null;
  lng: number | null;
  via: "whatsapp" | "telefono" | "sito" | "copiato";
  createdAt: number;
  outcome?: "bene" | "male" | "non-andato" | null;
  dismissed?: boolean;
  confirmed?: boolean;    // l'utente ha segnato "Il locale ha confermato" (assente nelle richieste vecchie)
  phone?: string | null;  // numero del locale, per avvisare se non si va più (assente nelle richieste vecchie)
  dismissedEve?: boolean; // promemoria del giorno prima nascosto (quello del giorno stesso resta)
  riapre?: number | null;  // richiesta mandata a locale chiuso: quando riapre (ms), per "ti hanno risposto?"
  dismissedRisposta?: boolean;
  disdetta?: number | null; // "Non vado più" toccato (ms): distingue la disdetta dal "Non ci sono andato" (dal 29/10)
  piattaforma?: string | null; // "Prenota su TheFork" (via "sito"): il nome della piattaforma (dal 30/10)
  modificataAt?: number;   // ultima modifica fatta sul telefono (ms): tra due telefoni vince la più recente (dal 31/10)
};

const KEY = "mapetite.prenotazioni";
const listeners = new Set<() => void>();
let cacheRaw: string | null = null;
let cacheList: BookingRequest[] = [];

export function loadBookings(): BookingRequest[] {
  try {
    const raw = window.localStorage.getItem(KEY) ?? "[]";
    if (raw === cacheRaw) return cacheList;
    const list = JSON.parse(raw);
    cacheRaw = raw;
    cacheList = Array.isArray(list) ? list.filter((b) => b && typeof b.placeName === "string") : [];
    return cacheList;
  } catch {
    return cacheList;
  }
}
function storeBookings(list: BookingRequest[]) {
  try { window.localStorage.setItem(KEY, JSON.stringify(list.slice(-30))); } catch { /* storage pieno o non disponibile */ }
  listeners.forEach((l) => l());
}
export function subscribeBookings(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) cb(); };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(cb); window.removeEventListener("storage", onStorage); };
}
export function addBooking(b: Omit<BookingRequest, "id" | "createdAt">): BookingRequest {
  const now = Date.now();
  const full: BookingRequest = { ...b, id: `${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`, createdAt: now, modificataAt: now };
  storeBookings([...loadBookings(), full]);
  inviaAccount("POST", { prenotazione: full });
  return full;
}
export function updateBooking(id: string, patch: Partial<BookingRequest>) {
  const list = loadBookings().map((b) => (b.id === id ? { ...b, ...patch, modificataAt: Date.now() } : b));
  storeBookings(list);
  const agg = list.find((b) => b.id === id);
  if (agg) inviaAccount("POST", { prenotazione: agg });
}
export function removeBooking(id: string) {
  storeBookings(loadBookings().filter((b) => b.id !== id));
  inviaAccount("DELETE", { id });
}

// Prenotazioni anche sull'account ("Cliente di parola", passo 2, PROPOSTE.md 3): solo se la persona
// l'ha acceso in /prenotazioni (src/lib/prenotazioni-sync.ts). La chiave tiene l'id dell'account a
// cui sono legate: se sul telefono entra un altro account il server rifiuta (409). Senza consenso
// nessuna chiamata. Le tolte aspettano in TOLTE_KEY finché l'account non le ha segnate.
export const ACCOUNT_KEY = "mapetite.prenotazioni.account";
export const TOLTE_KEY = "mapetite.prenotazioni.tolte";
export function accountPrenotazioni(): string | null {
  try {
    const v = window.localStorage.getItem(ACCOUNT_KEY);
    return v && v !== "1" ? v : null;
  } catch {
    return null;
  }
}
export function tolteInAttesa(): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(TOLTE_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(-100) : [];
  } catch {
    return [];
  }
}
export function segnaTolte(ids: string[]) {
  try {
    if (ids.length === 0) window.localStorage.removeItem(TOLTE_KEY);
    else window.localStorage.setItem(TOLTE_KEY, JSON.stringify(ids.slice(-100)));
  } catch { /* storage non disponibile */ }
}
export function sostituisciPrenotazioni(list: BookingRequest[]) {
  storeBookings(list);
}
function inviaAccount(method: "POST" | "DELETE", body: { prenotazione?: BookingRequest; id?: string }) {
  const utente = accountPrenotazioni();
  if (!utente) return;
  if (method === "DELETE" && body.id) segnaTolte([...tolteInAttesa().filter((x) => x !== body.id), body.id]);
  const payload = method === "POST" ? { prenotazioni: [body.prenotazione], utente } : { id: body.id, utente };
  void fetch("/api/prenotazioni", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), keepalive: true })
    .then((r) => { if (r.ok && method === "DELETE") segnaTolte(tolteInAttesa().filter((x) => x !== body.id)); })
    .catch(() => {});
}

// "Cliente di parola" (PROPOSTE.md 3, primo passo, 29/10): quante prenotazioni fatte da Mapetite si sono
// concluse bene, cioè presente ("Com'è andata?" con 👍/👎) o disdetta prima dell'ora del tavolo con
// "Non vado più". Solo da PAROLA_MIN prenotazioni concluse e con ZERO mancate: la riga nel messaggio
// la sceglie l'utente ed è una sua frase, mai un voto di Mapetite. Restano i dati del telefono
// (ultime 30): la conferma vera arriverà dal locale (pannello o gestionale), non da qui.
export const PAROLA_MIN = 3;
function inizioTavolo(b: BookingRequest): number | null {
  if (!b.date) return null;
  const [y, m, d] = b.date.split("-").map(Number);
  const [hh, mm] = (b.time ?? "12:00").split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm).getTime();
}
export function clienteDiParola(list: BookingRequest[]): number | null {
  let concluse = 0;
  for (const b of list) {
    if (b.outcome === "bene" || b.outcome === "male") { concluse++; continue; }
    if (b.outcome !== "non-andato") continue;
    const inizio = inizioTavolo(b);
    if (b.disdetta != null && inizio != null && b.disdetta < inizio) { concluse++; continue; }
    return null; // una mancata (o una disdetta arrivata dopo l'ora del tavolo): niente riga
  }
  return concluse >= PAROLA_MIN ? concluse : null;
}

// "Cliente di parola", passo 3 (PROPOSTE.md 3): per il pannello del locale, quanti tavoli sono stati
// chiesti da Mapetite e quanti da clienti di parola. Solo dalle prenotazioni che le persone hanno
// scelto di tenere sull'account; mai nomi: il pannello mostra il numero solo da SOGLIA persone in su.
// `tutte` = tutte le prenotazioni (di ogni locale) delle persone che hanno prenotato qui, per sapere
// se sono di parola; contano i tavoli con giorno tra `da` e `a` (compresi), disdette escluse.
export function prenotazioniAlLocale(tutte: { utente: string; p: BookingRequest }[], placeIds: string[], da: string, a: string): { tavoli: number; diParola: number; persone: number } {
  const ids = new Set(placeIds);
  const perUtente = new Map<string, BookingRequest[]>();
  for (const { utente, p } of tutte) perUtente.set(utente, [...(perUtente.get(utente) ?? []), p]);
  const qui = tutte.filter(({ p }) => ids.has(p.placeId) && p.date && p.date >= da && p.date <= a && p.disdetta == null);
  const diParola = new Map([...new Set(qui.map((x) => x.utente))].map((u) => [u, clienteDiParola(perUtente.get(u) ?? []) != null]));
  return { tavoli: qui.length, diParola: qui.filter((x) => diParola.get(x.utente)).length, persone: diParola.size };
}

// "Prenota come l'ultima volta" (PROPOSTE.md 10): persone e ora dell'ultima richiesta fatta da Mapetite
// per quel locale (stesso id del foglio Prenota). Solo i dati che c'erano davvero, mai il giorno.
export function lastBookingFor(list: BookingRequest[], placeId: string): { people: number | null; time: string | null } | null {
  const prev = list.filter((b) => b.placeId === placeId && (b.people != null || b.time != null)).sort((a, b) => b.createdAt - a.createdAt)[0];
  return prev ? { people: prev.people ?? null, time: prev.time ?? null } : null;
}

// Cosa ricordare oggi: la prenotazione di oggi (promemoria) e, dal giorno dopo e per 3 giorni,
// "Com'è andata?" su quelle passate ancora senza risposta.
export function bookingReminders(list: BookingRequest[], now: Date = new Date()): { today: BookingRequest[]; tomorrow: BookingRequest[]; howWasIt: BookingRequest[]; risposta: BookingRequest[] } {
  const todayKey = dateKey(now);
  const tomorrowKey = dateKey(addDays(now, 1));
  const oldest = dateKey(addDays(now, -3));
  const live = list.filter((b) => b.date && !b.dismissed);
  return {
    today: live.filter((b) => b.date === todayKey).sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "")),
    // Il giorno prima (contro i tavoli vuoti): se non si può più andare, è il momento giusto per avvisare.
    tomorrow: live.filter((b) => b.date === tomorrowKey && !b.dismissedEve).sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "")),
    howWasIt: live.filter((b) => b.date! < todayKey && b.date! >= oldest && !b.outcome),
    // Richiesta mandata a locale chiuso: dopo la riapertura, "ti hanno risposto?" (finché non si conferma
    // o si nasconde, e solo per prenotazioni ancora da fare).
    risposta: live.filter((b) => b.riapre != null && b.riapre <= now.getTime() && !b.confirmed && !b.dismissedRisposta && !b.outcome && b.date! >= todayKey),
  };
}

// Due tavoli per lo stesso pasto (proposta CEO 19/10, docs/autonomia/PROPOSTE.md): chi prenota in due posti
// per la stessa sera spesso non avvisa quello che scarta. Stesso giorno e stessa fascia (pranzo prima
// delle 16, sera dopo); senza ora vale per entrambe. Solo prenotazioni ancora aperte.
function mealSlot(time: string | null): "pranzo" | "sera" | null {
  if (!time) return null;
  return Number(time.slice(0, 2)) < 16 ? "pranzo" : "sera";
}
export function doubleBookings(list: BookingRequest[], now: Date = new Date()): BookingRequest[][] {
  const todayKey = dateKey(now);
  const open = list
    .filter((b) => b.date && b.date >= todayKey && !b.dismissed && !b.outcome)
    .sort((a, b) => `${a.date} ${a.time ?? ""}`.localeCompare(`${b.date} ${b.time ?? ""}`));
  const groups: BookingRequest[][] = [];
  const used = new Set<string>();
  for (const b of open) {
    if (used.has(b.id)) continue;
    const slot = mealSlot(b.time);
    // Stesso locale due volte = la stessa richiesta ripetuta, non due tavoli.
    const others = open.filter((o) => o.id !== b.id && !used.has(o.id) && o.date === b.date && o.placeId !== b.placeId
      && (slot === null || mealSlot(o.time) === null || mealSlot(o.time) === slot));
    const same = [b, ...others];
    if (same.length >= 2) {
      same.forEach((o) => used.add(o.id));
      groups.push(same);
    }
  }
  return groups;
}

// ── Pagina "Le mie prenotazioni" ──
// In arrivo: da oggi in poi (oggi compreso), dalla più vicina. Passate: dalla più recente.
// Senza giorno (non dovrebbe succedere: il foglio lo chiede) restano in arrivo, in fondo.
export function splitBookings(list: BookingRequest[], now: Date = new Date()): { upcoming: BookingRequest[]; past: BookingRequest[] } {
  const todayKey = dateKey(now);
  const when = (b: BookingRequest) => `${b.date ?? "9999-99-99"} ${b.time ?? "99:99"}`;
  const upcoming = list.filter((b) => !b.date || b.date >= todayKey).sort((a, b) => when(a).localeCompare(when(b)));
  const past = list.filter((b) => !!b.date && b.date < todayKey).sort((a, b) => when(b).localeCompare(when(a)));
  return { upcoming, past };
}

// Richiesta inviata → Confermata (lo segna l'utente) → Fatta / Non andata. "da-dire": passata, senza esito.
export type BookingStatus = "inviata" | "confermata" | "fatta" | "non-andata" | "da-dire";
export function bookingStatus(b: BookingRequest, now: Date = new Date()): BookingStatus {
  if (b.outcome === "non-andato") return "non-andata";
  if (b.outcome === "bene" || b.outcome === "male") return "fatta";
  if (b.date && b.date < dateKey(now)) return "da-dire";
  return b.confirmed ? "confermata" : "inviata";
}

// File .ics per il calendario del telefono, generato nel browser (nessun servizio esterno).
// Orario "fluttuante" (senza fuso): il calendario lo legge nell'ora del telefono, come l'ha scelto l'utente.
function icsText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
}
function icsLocal(d: Date): string {
  return `${dateKey(d).replace(/-/g, "")}T${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}00`;
}
export function bookingIcs(b: BookingRequest, now: Date = new Date()): string | null {
  if (!b.date) return null;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Mapetite//Prenotazioni//IT",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${b.id}@mapetite`,
    `DTSTAMP:${now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
  ];
  if (b.time && /^\d{1,2}:\d{2}$/.test(b.time)) {
    const [h, m] = b.time.split(":").map(Number);
    const start = fromKey(b.date);
    start.setHours(h, m, 0, 0);
    const end = new Date(start.getTime() + 2 * 3_600_000); // durata indicativa: 2 ore
    lines.push(`DTSTART:${icsLocal(start)}`, `DTEND:${icsLocal(end)}`);
  } else {
    const next = fromKey(b.date);
    next.setDate(next.getDate() + 1);
    lines.push(`DTSTART;VALUE=DATE:${b.date.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${dateKey(next).replace(/-/g, "")}`);
  }
  const details = [
    b.people ? `${b.people} ${b.people === 1 ? "persona" : "persone"}` : null,
    b.special ? `Richiesta: ${b.special}` : null,
    b.confirmed ? "Confermata dal locale." : "Richiesta inviata: la conferma arriva dal locale.",
  ].filter(Boolean).join("\n");
  const title = icsText(`Tavolo da ${b.placeName}`);
  lines.push(`SUMMARY:${title}`, `DESCRIPTION:${icsText(details)}`);
  if (b.lat != null && b.lng != null) {
    lines.push(`GEO:${b.lat};${b.lng}`, `URL:https://www.google.com/maps/dir/?api=1&destination=${b.lat}%2C${b.lng}`);
  }
  lines.push("BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", `DESCRIPTION:${title}`, "END:VALARM", "END:VEVENT", "END:VCALENDAR");
  // Righe lunghe piegate (RFC 5545: massimo 75 byte; 60 caratteri lasciano margine agli accenti).
  const fold = (l: string) => (l.length <= 60 ? l : (l.match(/[\s\S]{1,60}/gu) ?? [l]).join("\r\n "));
  return lines.map(fold).join("\r\n") + "\r\n";
}
