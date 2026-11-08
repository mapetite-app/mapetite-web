// Memoria breve delle ricerche nel telefono (D25 della prova dell'8/11): ricaricando /mappa o tornando
// indietro la ricerca si ritrova com'era, senza rifare la chiamata a Google (quota 50 al giorno) né i
// verdetti dell'AI. Solo sessionStorage (resta nella scheda del browser, sparisce chiudendola) e solo
// per pochi minuti: i fatti (orari, "aperto adesso") invecchiano. Nessun dato sui nostri server.

const KEY = "mapetite.ricerche";
export const MEMORIA_MS = 20 * 60 * 1000;
const MAX_VOCI = 8;

type Voce = { k: string; t: number; v: unknown };

function leggi(): Voce[] {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? (arr as Voce[]).filter((x) => x && typeof x.k === "string" && typeof x.t === "number") : [];
  } catch {
    return [];
  }
}

// Chiave stabile per una richiesta: indirizzo + le parti del corpo che decidono la risposta.
export function chiaveRicerca(url: string, parti: Record<string, unknown>): string {
  return `${url}|${JSON.stringify(parti)}`;
}

export function ricordata<T>(k: string, adesso = Date.now()): T | null {
  const hit = leggi().find((x) => x.k === k);
  return hit && adesso - hit.t < MEMORIA_MS ? (hit.v as T) : null;
}

export function ricorda(k: string, v: unknown, adesso = Date.now()): void {
  const resto = leggi().filter((x) => x.k !== k && adesso - x.t < MEMORIA_MS);
  const voci = [{ k, t: adesso, v }, ...resto].slice(0, MAX_VOCI);
  // Spazio finito (navigazione privata, telefono pieno): si tolgono le voci più vecchie e si riprova.
  for (let n = voci.length; n > 0; n--) {
    try {
      window.sessionStorage.setItem(KEY, JSON.stringify(voci.slice(0, n)));
      return;
    } catch {
      // si riprova con meno voci
    }
  }
}

// Coordinate arrotondate (~1 m): la stessa ricerca ricaricata ha la stessa chiave.
export function arrotonda(n: number): number {
  return Math.round(n * 1e5) / 1e5;
}

// La pagina è stata ricaricata o riaperta con Indietro/Avanti (non un link nuovo). Revisore 8/11: il tipo di
// caricamento vale per tutta la vita del documento, quindi dopo una ricarica della home anche la ricerca dal
// campo (navigazione interna verso /mappa?q=) sembrava una ricarica e non partiva. Conta solo se il documento
// è stato caricato proprio su questo indirizzo (`href` letto prima di togliere q e at), e una volta sola.
let giaChiesta = false;
export function aperturaRipetuta(href: string): boolean {
  if (giaChiesta) return false;
  giaChiesta = true;
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    return (nav?.type === "reload" || nav?.type === "back_forward") && nav.name === href;
  } catch {
    return false;
  }
}
