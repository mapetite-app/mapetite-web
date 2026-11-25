// "Il vostro anno su Mapetite" (proposta 87): il riepilogo dell'anno per il ristoratore, a dicembre.
// Solo conteggi di persone, sempre da SOGLIA (3) in su: sotto, il numero non si scrive (1 o 2 persone si
// riconoscono). Nessun nome, nessun singolo utente, nessun contenuto Google. Righe col lucchetto ("Solo per
// me" o raccolta privata): non contano, come in tutto il pannello. Solo funzioni pure, senza import di server,
// così il giro automatico le prova anche senza database.
import { SOGLIA, STATO_VISITATO, type RistReel, type RistSalvataggio } from "./ristoratore";

const PIACIUTO = "Mi è piaciuto";
const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const GIORNO_MS = 86_400_000;
const romeYm = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit" });
// [anno, mese 0-11] dell'istante a Roma.
function annoMese(t: string): [number, number] | null {
  const ms = Date.parse(t.length === 10 ? `${t}T12:00:00Z` : t);
  if (!Number.isFinite(ms)) return null;
  const [y, m] = romeYm.format(new Date(ms)).split("-").map(Number);
  return [y, m - 1];
}

export type AnnoLocale = {
  anno: number;
  salvati: number; // persone che lo hanno salvato nell'anno (riga ancora presente, senza lucchetto)
  venuti: number; // persone con "Ci sono stato" nell'anno (data della visita, o del salvataggio se manca)
  piaciuto: number; // tra i venuti, quelli con 👍
  tornati: number; // tra i venuti, quelli tornati 2 o più volte
  mese: { label: string; persone: number } | null; // il mese con più salvataggi, solo se primo netto e da SOGLIA
  mesi: number[]; // 12 conteggi dei salvataggi, per le barre
  barre: boolean; // barre mese per mese solo se OGNI mese è 0 o da SOGLIA (revisore 25/11: 1 e 2 si leggevano dalle altezze)
  daReel: number; // salvato da un reel o video collegato entro un giorno dal salvataggio (proposta 76)
  daAmico: number; // salvato su consiglio di un amico (proposta 58)
  inAttesa: number; // oggi: chi lo ha salvato (anche prima dell'anno) e non è ancora venuto
  pochi: boolean; // meno di SOGLIA persone in tutto: niente numeri, niente immagine
};

/** Solo il numero da SOGLIA in su, altrimenti 0 (la pagina non scrive le voci a 0). */
const sopra = (n: number) => (n >= SOGLIA ? n : 0);

export function annoLocale(
  input: { placeId: string; righe: RistSalvataggio[]; reel: RistReel[]; consigliati: Iterable<string> },
  anno: number,
): AnnoLocale {
  const righe = input.righe.filter((r) => r.place_id === input.placeId && !r.privato);
  const nellAnno = (t: string | null | undefined) => !!t && annoMese(t)?.[0] === anno;

  const salvatiChi = new Map<string, number>(); // persona -> mese del salvataggio
  const salvatoIl = new Map<string, number>();
  const venuti = new Set<string>();
  const piaciuto = new Set<string>();
  const tornati = new Set<string>();
  const attesa = new Set<string>();
  for (const r of righe) {
    const tags = r.tags ?? [];
    const am = annoMese(r.created_at);
    if (am && am[0] === anno) { salvatiChi.set(r.user_id, am[1]); salvatoIl.set(r.user_id, Date.parse(r.created_at)); }
    const visitato = tags.includes(STATO_VISITATO);
    // "Vi aspettano": solo chi ha salvato nell'anno e non è ancora venuto (revisore 25/11: niente periodi mescolati).
    if (!visitato && am && am[0] === anno) attesa.add(r.user_id);
    // Visite con una data futura: fuori, come in "Il tuo anno a tavola" (revisore 25/11).
    const quando = r.visited_at ?? r.created_at;
    if (visitato && nellAnno(quando) && Date.parse(quando.length === 10 ? `${quando}T00:00:00Z` : quando) <= Date.now()) {
      venuti.add(r.user_id);
      if (tags.includes(PIACIUTO)) piaciuto.add(r.user_id);
      if ((r.visite ?? 0) >= 2) tornati.add(r.user_id);
    }
  }

  const mesi = Array<number>(12).fill(0);
  for (const m of salvatiChi.values()) mesi[m]++;
  const max = Math.max(...mesi);
  const primo = mesi.indexOf(max);
  const netto = max >= SOGLIA && mesi.filter((n) => n === max).length === 1;

  // Reel: come daiReel nel pannello, ma sull'anno: il primo video della persona, entro un giorno dal salvataggio.
  const reel = new Set<string>();
  for (const c of input.reel) {
    const s = salvatoIl.get(c.user_id);
    const t = Date.parse(c.created_at);
    if (c.place_id !== input.placeId || s == null || !Number.isFinite(t) || Math.abs(t - s) > GIORNO_MS) continue;
    if (["Instagram", "TikTok", "YouTube"].includes(c.fonte)) reel.add(c.user_id);
  }
  const amici = new Set([...input.consigliati].filter((u) => salvatiChi.has(u)));

  const tutte = new Set([...salvatiChi.keys(), ...venuti]).size;
  return {
    anno,
    salvati: sopra(salvatiChi.size),
    venuti: sopra(venuti.size),
    // 👍 solo se anche chi non l'ha messo è almeno SOGLIA (come "di parola" nel pannello): con 3 su 3, o 3 su 4,
    // si saprebbe il voto di ognuno o di chi non l'ha dato.
    piaciuto: piaciuto.size >= SOGLIA && venuti.size - piaciuto.size >= SOGLIA ? piaciuto.size : 0,
    tornati: sopra(tornati.size),
    mese: netto ? { label: MESI[primo], persone: max } : null,
    mesi,
    barre: salvatiChi.size >= SOGLIA && mesi.every((n) => n === 0 || n >= SOGLIA),
    daReel: sopra(reel.size),
    daAmico: sopra(amici.size),
    inAttesa: sopra(attesa.size),
    pochi: tutte < SOGLIA,
  };
}

/** Il titolo grande: "salvato da N persone", oppure (salvati sotto soglia) "N persone sono venute". */
export function titoloAnno(a: AnnoLocale): { numero: number; testo: string } | null {
  if (a.salvati) return { numero: a.salvati, testo: "persone vi hanno salvato" };
  if (a.venuti) return { numero: a.venuti, testo: "persone sono venute da voi" };
  return null;
}

/** Fino a 3 numeri sotto il titolo, mai a zero. */
export function numeriAnnoLocale(a: AnnoLocale): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const it = (n: number) => n.toLocaleString("it-IT");
  if (a.salvati && a.venuti) out.push({ value: it(a.venuti), label: "sono venute" });
  if (a.piaciuto) out.push({ value: `👍 ${it(a.piaciuto)}`, label: "a cui è piaciuto" });
  if (a.tornati) out.push({ value: it(a.tornati), label: "tornate più volte" });
  if (out.length < 3 && a.inAttesa && a.inAttesa !== a.salvati) out.push({ value: it(a.inAttesa), label: "vi aspettano" });
  return out.slice(0, 3);
}

/** Righe "come vi hanno trovato" e "il mese", solo con numeri da SOGLIA. */
export function righeAnnoLocale(a: AnnoLocale): { k: string; label: string; value: string }[] {
  const it = (n: number) => n.toLocaleString("it-IT");
  const out: { k: string; label: string; value: string }[] = [];
  if (a.mese) out.push({ k: "mese", label: "Il mese con più salvataggi", value: `${a.mese.label.charAt(0).toUpperCase()}${a.mese.label.slice(1)} · ${it(a.mese.persone)}` });
  if (a.daReel) out.push({ k: "reel", label: "Da un reel o un video", value: `${it(a.daReel)} persone` });
  if (a.daAmico) out.push({ k: "amico", label: "Su consiglio di un amico", value: `${it(a.daAmico)} persone` });
  return out;
}

/** Fino al 15 gennaio si racconta l'anno appena finito; l'ingresso dal pannello si vede dal 1/12 al 15/1. */
export function stagioneAnnoLocale(now = new Date()): boolean {
  const [, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(now).split("-").map(Number);
  return m === 12 || (m === 1 && d <= 15);
}
