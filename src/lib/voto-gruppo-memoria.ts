// "Manda al gruppo" (proposta 56): sul telefono di chi propone si ricorda, per 2 giorni, telefono e sito dei
// posti del voto (arrivati con la ricerca), così a voto chiuso "Prenota" apre il foglio di sempre senza
// chiedere niente a Google. Solo nel telefono (localStorage): mai sui nostri server (termini Google).

const KEY = "mapetite.voti";
const DURATA = 2 * 86_400_000;

export type PostoPrenotabile = { uuid: string; gid: string | null; nome: string; phone: string | null; websiteUri: string | null; lat: number | null; lng: number | null };
type Memoria = Record<string, { t: number; posti: PostoPrenotabile[] }>;

function leggi(): Memoria {
  try {
    const m = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Memoria;
    const now = Date.now();
    return Object.fromEntries(Object.entries(m).filter(([, v]) => v && Array.isArray(v.posti) && now - v.t < DURATA));
  } catch {
    return {};
  }
}

export function ricordaVoto(codice: string, posti: PostoPrenotabile[]): void {
  try {
    const m = leggi();
    m[codice] = { t: Date.now(), posti };
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch { /* storage pieno o non disponibile: "Prenota" aprirà Maps */ }
}

export function postoRicordato(codice: string, uuid: string): PostoPrenotabile | null {
  return leggi()[codice]?.posti.find((p) => p.uuid === uuid) ?? null;
}
