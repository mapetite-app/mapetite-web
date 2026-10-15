"use client";

import type { SearchIntent } from "@/lib/search-intent";

// Frase capita in anticipo mentre la persona scrive (vedi /api/search/intent). Resta in memoria
// della pagina: anche dalla home alla mappa, che non ricarica la pagina.
const pending = new Map<string, Promise<SearchIntent | null>>();
const MAX = 20;

function key(q: string): string {
  return q.trim();
}

export function prefetchIntent(q: string): void {
  const k = key(q);
  if (k.length < 8 || pending.has(k)) return;
  const p = fetch("/api/search/intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: k }),
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (d?.intent ?? null) as SearchIntent | null)
    .catch(() => null);
  pending.set(k, p);
  if (pending.size > MAX) pending.delete(pending.keys().next().value!);
}

// L'intento per questa frase, se è già partito: si aspetta al massimo `waitMs` (di solito è già
// pronto o quasi; altrimenti la ricerca lo chiede da sola come prima).
export async function intentFor(q: string, waitMs = 2500): Promise<SearchIntent | null> {
  const p = pending.get(key(q));
  if (!p) return null;
  return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), waitMs))]);
}
