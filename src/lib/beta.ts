"use client";

import { useSyncExternalStore } from "react";

// Funzioni introdotte in prova: dal 11/10 sono ACCESE per tutti. Per spegnerle (confronto) ?beta=off.
//   filtri-lista  chip "Aperto ora / Fino a €€ / 4,5+" sopra la lista risultati
//   condividi     pulsante "Condividi" nella scheda locale
//   recenti       ricerche recenti (solo su questo telefono) nella card iniziale
//   barra         campo "Chiedi all'AI" + pulsante "Filtri" sempre in cima alla mappa (dal 11/10, scelta di Lorenzo)
//   suggerimenti  frasi d'esempio sotto la barra al posto della card in basso (dal 12/10, Lorenzo: "una sola barra")
export type BetaFlag = "filtri-lista" | "condividi" | "recenti" | "barra" | "suggerimenti";

// Funzioni nuove SPENTE di default: si accendono con ?beta=nome (resta acceso su
// quel telefono finché non si apre ?beta=off).
//   gemme         badge "💎 Poco conosciuto" sui locali molto amati ma con poche recensioni
//   articolo      risposta della ricerca da leggere come un articolo (Places), con "Fai un'altra domanda"
//   salva         finestra "Salva" dal basso come Places: Voglio andarci / Ci sono stato, nota, tag
//   sorprendimi   "🎲 Scegli tu" nei salvati: apre un locale a caso, prima i "Voglio andarci"
//   voce          🎤 nella barra di ricerca: si detta la ricerca (riconoscimento vocale del telefono)
export type OptInFlag = "gemme" | "articolo" | "salva" | "sorprendimi" | "voce";
const OPTIN_KEY = "mapetite.beta";

// ?stile=places accende anche articolo, nuovo "Salva" e 🎤 (tutti come Places); ?stile=attuale li spegne.
const PLACES_OPTIN = ["articolo", "salva", "voce"];
function readOptIn(): string {
  const url = readFlags();
  if (url.split(",").includes("off")) return EMPTY;
  const stile = new URLSearchParams(window.location.search).get("stile");
  try {
    const stored = window.localStorage.getItem(OPTIN_KEY) ?? EMPTY;
    const saved = stile === "attuale" ? stored.split(",").filter((f) => !PLACES_OPTIN.includes(f)).join(",") : stored;
    const extra = stile === "places" ? PLACES_OPTIN : [];
    const merged = Array.from(new Set([...saved.split(","), ...url.split(","), ...extra].map((f) => f.trim()).filter(Boolean))).join(",");
    if (merged !== stored) window.localStorage.setItem(OPTIN_KEY, merged);
    return merged;
  } catch {
    return url;
  }
}

export function useOptIn(flag: OptInFlag): boolean {
  const raw = useSyncExternalStore(() => () => {}, readOptIn, () => EMPTY);
  return raw.split(",").includes(flag);
}

const EMPTY = "";

function readFlags(): string {
  const raw = new URLSearchParams(window.location.search).get("beta") ?? EMPTY;
  // ?beta=off spegne anche le funzioni accese su questo telefono (vedi useOptIn).
  if (raw.split(",").includes("off")) {
    try { window.localStorage.removeItem("mapetite.beta"); } catch { /* storage non disponibile */ }
  }
  return raw;
}

export function useBeta(flag: BetaFlag): boolean {
  const raw = useSyncExternalStore(() => () => {}, readFlags, () => EMPTY);
  const list = raw.split(",").map((f) => f.trim());
  return !list.includes("off") && !list.includes(`-${flag}`);
}

const RECENT_KEY = "mapetite.recenti";

export function loadRecentSearches(): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 5) : [];
  } catch {
    return [];
  }
}

// Avvisa chi mostra le recenti (mappa, home) che sono cambiate.
export const RECENT_EVENT = "mapetite-recenti";
export function subscribeRecent(cb: () => void): () => void {
  window.addEventListener(RECENT_EVENT, cb);
  return () => window.removeEventListener(RECENT_EVENT, cb);
}

// "Cancella" le ricerche recenti (es. se si presta il telefono).
export function clearRecentSearches(): void {
  try {
    window.localStorage.removeItem(RECENT_KEY);
  } catch {
    // localStorage non disponibile: niente da cancellare
  }
  window.dispatchEvent(new Event(RECENT_EVENT));
}

export function saveRecentSearch(q: string): void {
  try {
    const next = [q, ...loadRecentSearches().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 5);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // localStorage non disponibile (navigazione privata): si ignora
  }
}

// Varianti grafiche in prova (?scheda=b, ?home=b, ?pin=b; "a" = attuale, predefinita).
// Le imposta lo script in layout.tsx su <html data-…>, prima del primo disegno.
export function useVariant(key: "scheda" | "home" | "pin"): "a" | "b" {
  return useSyncExternalStore(
    () => () => {},
    () => (document.documentElement.dataset[key] === "b" ? "b" : "a"),
    () => "a",
  );
}
