// Tetto alle chiamate Haiku (costi AI): Lorenzo, 12/10 "metti un limite".
// Due livelli, entrambi in memoria del server (si azzerano a ogni riavvio e valgono per
// singola istanza Vercel: sono un freno, NON un tetto di spesa garantito — quello è il
// credito prepagato sulla console Anthropic, senza ricarica automatica).
//  1. per persona (utente o indirizzo IP): al massimo PER_HOUR azioni AI all'ora;
//  2. per istanza: al massimo PER_DAY azioni AI al giorno, chiunque le faccia.
// Superato il limite l'app non si rompe: la ricerca risponde con un messaggio chiaro,
// i verdetti si saltano (restano i dati Google).
// "luoghi" non è AI ma una ricerca Google a pagamento (Importa): stesso freno per persona.
// "raccolte": proposte di raccolte per i salvati senza raccolta (piano 4.2), 1 chiamata per gruppo di 30.
export type AiAction = "ricerca" | "verdetti" | "screenshot" | "luoghi" | "intento" | "raccolte" | "chiedi" | "chiedi-ricerca";

// verdetti: 4 richieste per ricerca dal 14/10 (gruppi da 2, 3, 3, 4) → 160 = le stesse 40 ricerche di prima.
// intento: la frase capita mentre si scrive (~0,1 centesimi l'una), al massimo 3 per ricerca.
// raccolte: 10 gruppi all'ora = 300 salvati, più che sufficiente anche per chi importa tutto in blocco.
// chiedi: "Chiedi ai tuoi posti" (proposta 33), una domanda = una chiamata.
// chiedi-ricerca: gli stessi salvati scelti accanto a ogni ricerca nel mondo (una per ricerca, come "ricerca").
const PER_HOUR: Record<AiAction, number> = { ricerca: 30, verdetti: 160, screenshot: 20, luoghi: 20, intento: 90, raccolte: 10, chiedi: 20, "chiedi-ricerca": 30 };
const PER_DAY = 1500;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const perKey = new Map<string, number[]>();
let dayStart = Date.now();
let dayCount = 0;

export function clientKey(request: Request, userId?: string | null): string {
  if (userId) return `u:${userId}`;
  const fwd = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `ip:${fwd || request.headers.get("x-real-ip") || "sconosciuto"}`;
}

// true = si può procedere (e l'azione viene contata); false = limite raggiunto.
export function allowAi(action: AiAction, key: string, now = Date.now()): boolean {
  if (now - dayStart > DAY) { dayStart = now; dayCount = 0; }
  if (dayCount >= PER_DAY) {
    console.warn(`[ai-limit] tetto giornaliero dell'istanza raggiunto (${PER_DAY}): ${action} bloccata`);
    return false;
  }
  const k = `${action}|${key}`;
  const recent = (perKey.get(k) ?? []).filter((t) => now - t < HOUR);
  if (recent.length >= PER_HOUR[action]) {
    perKey.set(k, recent);
    console.warn(`[ai-limit] ${action} oltre ${PER_HOUR[action]}/ora per ${key.startsWith("u:") ? "utente" : "indirizzo"}: bloccata`);
    return false;
  }
  recent.push(now);
  perKey.set(k, recent);
  dayCount++;
  // Pulizia: la mappa non cresce senza fine.
  if (perKey.size > 5000) {
    for (const [kk, ts] of perKey) if (ts.every((t) => now - t >= HOUR)) perKey.delete(kk);
  }
  return true;
}

export const AI_LIMIT_MESSAGE = "Hai fatto tante ricerche in poco tempo: riprova tra qualche minuto.";
export const AI_LIMIT_SCREENSHOT_MESSAGE = "Hai letto tanti screenshot in poco tempo: riprova tra qualche minuto.";
