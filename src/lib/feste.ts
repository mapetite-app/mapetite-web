// "Le feste si prenotano adesso" (proposta 89, PROBLEMI.md 36): dal 1 al 20 dicembre, in cima a Salvati,
// 3 dei tuoi posti per la cena delle feste. Prima quelli dove sei stato e ti sono piaciuti, poi i "Da provare"
// messi in una raccolta da tavolata (amici, colleghi, compleanno…). Ordine: il tuo, mai le recensioni.
// Nessuna chiamata a Google o all'AI: solo i salvati già caricati. Funzioni pure (le prova il giro).
import { OPINION_DISLIKE, OPINION_LIKE, STATE_TAGS, isStateTag } from "./tags";

export const MAX_FESTE = 3;
export const MIN_FESTE = 2; // con un posto solo non è una scelta: la card non compare
const ULTIMO_GIORNO = 20;

// Nomi di raccolta da tavolata. Parole intere all'inizio (amic- copre amici, amiche, amicizia).
const DA_TAVOLATA = /(^|[^\p{L}])(amic|collegh|compleann|grupp|fest|natal|capodann|famigli|tavolat|cena di lavoro|ufficio|team|parenti|cenone)/iu;

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

export function raccoltaDaTavolata(tags: readonly string[] | null | undefined): string | null {
  return (tags ?? []).find((t) => !isStateTag(t) && t !== OPINION_LIKE && t !== OPINION_DISLIKE && DA_TAVOLATA.test(t)) ?? null;
}

/**
 * I posti per la card, nell'ordine della lista ricevuta (quella di Salvati, già nel tuo ordine).
 * Fuori: 👎, chiusi per sempre, "Solo per me" (la card porta a "Manda al gruppo").
 * Meno di MIN_FESTE: lista vuota (niente riempitivi).
 */
export function postiFeste<T extends PostoFeste>(posti: readonly T[]): { posto: T; motivo: Motivo }[] {
  const ok = posti.filter((p) => !p.soloPerMe && !(p.tags ?? []).includes(OPINION_DISLIKE) && p.businessStatus !== "CLOSED_PERMANENTLY");
  const piaciuti = ok.filter((p) => (p.tags ?? []).includes(STATE_TAGS[1]) && (p.tags ?? []).includes(OPINION_LIKE));
  const scelti: { posto: T; motivo: Motivo }[] = piaciuti.slice(0, MAX_FESTE).map((posto) => ({ posto, motivo: { tipo: "piaciuto" } }));
  for (const p of ok) {
    if (scelti.length >= MAX_FESTE) break;
    if ((p.tags ?? []).includes(STATE_TAGS[1])) continue; // già visitato senza 👍: non è un consiglio
    const nome = raccoltaDaTavolata(p.tags);
    if (nome) scelti.push({ posto: p, motivo: { tipo: "raccolta", nome } });
  }
  return scelti.length >= MIN_FESTE ? scelti : [];
}

export function etichettaFeste(m: Motivo): string {
  return m.tipo === "piaciuto" ? "Ci sei stato · 👍" : `Da provare · ${m.nome}`;
}
