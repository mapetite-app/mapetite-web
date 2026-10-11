"use client";

import { useSyncExternalStore } from "react";

// Funzioni introdotte in prova: dal 11/10 sono ACCESE per tutti. Per spegnerle (confronto) ?beta=off.
//   filtri-lista  chip "Aperto ora / Fino a €€ / 4,5+" sopra la lista risultati
//   condividi     pulsante "Condividi" nella scheda locale
//   recenti       ricerche recenti (solo su questo telefono) nella card iniziale
export type BetaFlag = "filtri-lista" | "condividi" | "recenti";

const EMPTY = "";

function readFlags(): string {
  return new URLSearchParams(window.location.search).get("beta") ?? EMPTY;
}

export function useBeta(flag: BetaFlag): boolean {
  const raw = useSyncExternalStore(() => () => {}, readFlags, () => EMPTY);
  const list = raw.split(",").map((f) => f.trim());
  return !list.includes("off") && !list.includes(`-${flag}`);
}

// Proposte nuove (Fase 4): SPENTE di default, si accendono solo elencandole, es. ?beta=condividi-ricerca
//   condividi-ricerca  pulsante "Condividi" sul titolo della risposta: link che rifà la stessa ricerca
//   installa           dopo la prima ricerca, suggerimento "Aggiungi alla schermata Home"
export type OptInFlag = "condividi-ricerca" | "installa";

export function useBetaOptIn(flag: OptInFlag): boolean {
  const raw = useSyncExternalStore(() => () => {}, readFlags, () => EMPTY);
  return raw.split(",").map((f) => f.trim()).includes(flag);
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
