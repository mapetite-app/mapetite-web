// "Le feste si prenotano adesso" (proposta 89, PROBLEMI.md 36): dal 1 al 20 dicembre, in cima a Salvati,
// 3 dei tuoi posti per la cena delle feste: prima quelli in una raccolta delle feste, poi quelli dove sei stato
// e ti sono piaciuti, poi i "Da provare" da tavolata. Dal più recente, mai per recensioni.
// Nessuna chiamata a Google o all'AI: solo i salvati già caricati. Funzioni pure (le prova il giro).
// Senza import (il giro la prova da sola): gli stessi valori di tags.ts.
const OPINION_LIKE = "Mi è piaciuto";
const OPINION_DISLIKE = "Non fa per me";
const STATE_TAGS = ["Da provare", "Già visitato"] as const;
const isStateTag = (t: string) => (STATE_TAGS as readonly string[]).includes(t);

export const MAX_FESTE = 3;
export const MIN_FESTE = 2; // con un posto solo non è una scelta: la card non compare
const ULTIMO_GIORNO = 20;

// Nomi di raccolta. Le feste dette in chiaro (Natale, Capodanno, cenone…) vengono prima di tutto: è
// l'intenzione esplicita della persona. Poi quelle da tavolata (amici, colleghi, compleanno…).
// Parole intere all'inizio: "Natalia", "Festival" e "Team" non contano (revisore 26/11).
const FESTE = /(^|[^\p{L}])(natal[ei](?!\p{L})|natalizi|capodann|cenon|vigilia|feste\b|festa\b|festivit|san silvestro)/iu;
const DA_TAVOLATA = /(^|[^\p{L}])(amic|collegh|compleann|grupp|famigli|tavolat|lavoro|ufficio|parenti|addio al)/iu;

export type PostoFeste = {
  id: string;
  tags: string[] | null;
  soloPerMe?: boolean;
  businessStatus?: string | null;
};

export type Motivo = { tipo: "piaciuto" } | { tipo: "raccolta"; nome: string };

/** "AAAA-MM-GG" (ora di Roma) è nella finestra delle feste: dal 1 al 20 dicembre. */
export function stagioneFeste(oggi: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(oggi);
  return !!m && m[2] === "12" && Number(m[3]) >= 1 && Number(m[3]) <= ULTIMO_GIORNO;
}

/** Chiave del "Non quest'anno": vale per le feste di quell'anno. */
export function chiaveChiusa(oggi: string): string {
  return `mapetite:feste-chiusa:${oggi.slice(0, 4)}`;
}

const raccolte = (tags: readonly string[] | null | undefined) => (tags ?? []).filter((t) => !isStateTag(t) && t !== OPINION_LIKE && t !== OPINION_DISLIKE);
export function raccoltaDelleFeste(tags: readonly string[] | null | undefined): string | null {
  return raccolte(tags).find((t) => FESTE.test(t)) ?? null;
}
export function raccoltaDaTavolata(tags: readonly string[] | null | undefined): string | null {
  return raccolte(tags).find((t) => DA_TAVOLATA.test(t)) ?? null;
}

/**
 * I posti per la card. `posti` arriva dal più vecchio al più nuovo (come i salvati): qui si guarda dal più
 * recente. Ordine: (1) quelli in una raccolta delle feste, (2) i 👍, (3) i "Da provare" da tavolata; se ci
 * sono posti da tavolata, almeno uno ha il suo posto. Tutti della stessa città (quella del primo scelto):
 * una tavolata non si vota tra Roma e Milano (revisore 26/11). Fuori: 👎, chiusi (anche per ora),
 * "Solo per me" (la card porta a "Manda al gruppo"), visitati senza 👍. Meno di MIN_FESTE: lista vuota.
 */
export function postiFeste<T extends PostoFeste>(posti: readonly T[], cittaDi: (p: T) => string | null = () => null): { posto: T; motivo: Motivo }[] {
  const ok = [...posti].reverse().filter((p) => !p.soloPerMe && !(p.tags ?? []).includes(OPINION_DISLIKE) && (p.businessStatus == null || p.businessStatus === "OPERATIONAL"));
  const tags = (p: T) => p.tags ?? [];
  const piace = (p: T) => tags(p).includes(STATE_TAGS[1]) && tags(p).includes(OPINION_LIKE);
  const daProvare = (p: T) => !tags(p).includes(STATE_TAGS[1]);
  const feste: { posto: T; motivo: Motivo }[] = [];
  for (const p of ok) {
    const nome = raccoltaDelleFeste(p.tags);
    if (nome && (piace(p) || daProvare(p))) feste.push({ posto: p, motivo: piace(p) ? { tipo: "piaciuto" } : { tipo: "raccolta", nome } });
  }
  const presi = new Set(feste.map((x) => x.posto.id));
  const piaciuti = ok.filter((p) => !presi.has(p.id) && piace(p)).map((posto) => ({ posto, motivo: { tipo: "piaciuto" } as Motivo }));
  const tavolata = ok.flatMap((p) => {
    const nome = !presi.has(p.id) && daProvare(p) ? raccoltaDaTavolata(p.tags) : null;
    return nome ? [{ posto: p, motivo: { tipo: "raccolta", nome } as Motivo }] : [];
  });
  const primo = feste[0] ?? piaciuti[0] ?? tavolata[0];
  if (!primo) return [];
  const citta = cittaDi(primo.posto);
  const qui = (x: { posto: T }) => citta === null || cittaDi(x.posto) === citta;
  const [f, l, t] = [feste.filter(qui), piaciuti.filter(qui), tavolata.filter(qui)];
  const scelti = f.slice(0, MAX_FESTE);
  const liberi = MAX_FESTE - scelti.length;
  const perTavolata = t.length > 0 && liberi > 0 ? 1 : 0;
  scelti.push(...l.slice(0, liberi - perTavolata));
  scelti.push(...t.slice(0, MAX_FESTE - scelti.length));
  if (scelti.length < MAX_FESTE) scelti.push(...l.filter((x) => !scelti.includes(x)).slice(0, MAX_FESTE - scelti.length));
  return scelti.length >= MIN_FESTE ? scelti : [];
}

export function etichettaFeste(m: Motivo): string {
  return m.tipo === "piaciuto" ? "Ci sei stato · 👍" : `Da provare · ${m.nome}`;
}
