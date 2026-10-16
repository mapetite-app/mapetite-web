"use client";

import { segnaGiornoUso } from "@/lib/valore-tester";

// Invia un segnale di comportamento a /api/events senza mai disturbare l'utente:
// nessuna attesa, nessun errore mostrato. Vedi src/lib/events.ts.
// Sessione, pagine ed errori partono da soli (src/instrumentation-client.ts, src/lib/track-auto.ts).
type TrackType =
  | "apri_scheda" | "salva" | "rimuovi" | "ci_sono_stato" | "voglio_andarci" | "percorso" | "chiama" | "sito" | "condividi"
  | "sessione_inizio" | "pagina" | "funzione" | "errore" | "utile";

// Stessi nomi di ANON_COOKIE / SESSION_COOKIE in src/lib/events.ts (lì c'è il codice del server).
const ANON_COOKIE = "mapetite_anon";
const SESSION_COOKIE = "mapetite_sessione";

function setCookie(name: string, value: string, maxAge: number) {
  try {
    document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; samesite=lax`;
  } catch {
    // cookie non disponibili: il server non collega le sue scritture, pazienza
  }
}

const ANON_KEY = "mapetite.anon";
function anonId(): string | null {
  try {
    let id = window.localStorage.getItem(ANON_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(ANON_KEY, id);
    }
    setCookie(ANON_COOKIE, id, 60 * 60 * 24 * 365);
    return id;
  } catch {
    return null;
  }
}

// Sessione = visita: finisce dopo 30 minuti senza segnali (come le analytics comuni).
// Salvata nel telefono, così più schede aperte restano la stessa visita.
const SESSION_KEY = "mapetite.sessione";
const SESSION_GAP = 30 * 60_000;
const DAY = 86_400_000;
type Session = { id: string; last: number };

function readSession(): Session | null {
  try {
    const s = JSON.parse(window.localStorage.getItem(SESSION_KEY) ?? "null");
    return s && typeof s.id === "string" && typeof s.last === "number" ? s : null;
  } catch {
    return null;
  }
}

// Giorni di calendario (ora del telefono) tra l'ultima attività e oggi.
function daysSince(ts: number, now: number): number {
  const day = (t: number) => { const d = new Date(t); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); };
  return Math.max(0, Math.round((day(now) - day(ts)) / DAY));
}

// Restituisce la sessione in corso; se è scaduta ne apre una nuova e manda "sessione_inizio".
function currentSession(): string | null {
  try {
    const now = Date.now();
    segnaGiornoUso(now); // giorni diversi d'uso, per la domanda settimanale (src/lib/valore-tester.ts)
    const prev = readSession();
    if (prev && now - prev.last < SESSION_GAP) {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify({ id: prev.id, last: now }));
      setCookie(SESSION_COOKIE, prev.id, SESSION_GAP / 1000);
      return prev.id;
    }
    const id = crypto.randomUUID();
    window.localStorage.setItem(SESSION_KEY, JSON.stringify({ id, last: now }));
    setCookie(SESSION_COOKIE, id, SESSION_GAP / 1000);
    const installed = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    send("sessione_inizio", id, null, {
      ...(prev ? { giorni: daysSince(prev.last, now) } : { prima_volta: 1 }),
      installata: installed ? 1 : 0,
    });
    return id;
  } catch {
    return null;
  }
}

// All'apertura e quando l'app torna in primo piano: true se è iniziata una nuova visita.
export function ensureSession(): boolean {
  const before = readSession()?.id ?? null;
  return currentSession() !== before;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function send(
  type: TrackType,
  sessionId: string | null,
  place: { id: string; lat?: number; lng?: number } | null | undefined,
  props: Record<string, string | number> | undefined,
): void {
  const id = place?.id ?? null;
  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({
      type,
      anonId: anonId(),
      sessionId,
      placeId: id && UUID.test(id) ? id : null,
      googlePlaceId: id && !UUID.test(id) ? id : null,
      lat: place?.lat ?? null,
      lng: place?.lng ?? null,
      props: props ?? {},
    }),
  }).catch(() => {});
}

export function track(
  type: TrackType,
  place?: { id: string; lat?: number; lng?: number } | null,
  props?: Record<string, string | number>,
): void {
  try {
    send(type, currentSession(), place, props);
  } catch {
    // mai bloccare l'interfaccia per un segnale
  }
}

// Uso di una funzione (filtri, import_link, sorprendimi…): solo il nome, mai cosa ha scritto la persona.
export function trackFeature(nome: string, props?: Record<string, string | number>): void {
  track("funzione", null, { ...props, nome });
}
