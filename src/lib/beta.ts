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
