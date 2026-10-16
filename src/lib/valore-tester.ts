// "Ti è stato utile?" e domanda settimanale (PIANO-25-OTTOBRE.md 7.6): cosa resta nel telefono.
// Solo localStorage, letto con useSyncExternalStore: mai bloccare l'interfaccia se non c'è.
// Nessun testo scritto dalla persona: solo voti e scelte rapide (vedi src/lib/track.ts).

const VOTATI_KEY = "mapetite.utile_votati";      // risposte già votate (una volta sola per risposta)
const GIORNI_KEY = "mapetite.giorni_uso";        // giorni diversi in cui l'app è stata aperta
const SETTIMANA_KEY = "mapetite.domanda_settimanale"; // quando è stata fatta l'ultima domanda
const MAX_VOTATI = 60;
const MAX_GIORNI = 30;
export const SETTE_GIORNI = 7 * 86_400_000;

// Motivi del 👎: scelte rapide, mai testo libero (privacy).
export const MOTIVI = [
  { id: "sbagliati", label: "Risultati sbagliati" },
  { id: "lento", label: "Troppo lento" },
  { id: "gia_noti", label: "Posti già noti" },
  { id: "altro", label: "Altro" },
] as const;

const listeners = new Set<() => void>();
const notify = () => { for (const l of listeners) l(); };
export function subscribeFeedback(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (!e.key || e.key.startsWith("mapetite.")) cb(); };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(cb); window.removeEventListener("storage", onStorage); };
}

function readList(key: string): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function writeList(key: string, list: string[], max: number) {
  try { window.localStorage.setItem(key, JSON.stringify(list.slice(-max))); } catch { /* storage non disponibile */ }
}

// Stringa (non array) così useSyncExternalStore confronta il valore e non ridisegna a vuoto.
export const votatiSnapshot = (): string => {
  try { return window.localStorage.getItem(VOTATI_KEY) ?? "[]"; } catch { return "[]"; }
};
export const giaVotato = (snapshot: string, chiave: string): boolean => {
  try { const v = JSON.parse(snapshot); return Array.isArray(v) && v.includes(chiave); } catch { return false; }
};
export function segnaVotato(chiave: string) {
  const l = readList(VOTATI_KEY).filter((k) => k !== chiave);
  writeList(VOTATI_KEY, [...l, chiave], MAX_VOTATI);
  notify();
}

// Giorno di calendario del telefono.
const oggi = (now: number) => {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Chiamata a ogni visita (src/lib/track.ts): basta un'apertura per contare il giorno.
export function segnaGiornoUso(now: number = Date.now()) {
  const g = oggi(now);
  const l = readList(GIORNI_KEY);
  if (l.includes(g)) return;
  writeList(GIORNI_KEY, [...l, g], MAX_GIORNI);
}

// Domanda settimanale: solo a chi ha usato l'app in almeno 2 giorni diversi, al massimo
// una volta ogni 7 giorni (contati da quando è stata mostrata e risposta o chiusa).
export function domandaSnapshot(now: number = Date.now()): boolean {
  try {
    if (readList(GIORNI_KEY).length < 2) return false;
    const last = Number(window.localStorage.getItem(SETTIMANA_KEY) ?? 0);
    return !Number.isFinite(last) || now - last >= SETTE_GIORNI;
  } catch {
    return false;
  }
}
export function segnaDomandaFatta(now: number = Date.now()) {
  try { window.localStorage.setItem(SETTIMANA_KEY, String(now)); } catch { /* storage non disponibile */ }
  notify();
}
