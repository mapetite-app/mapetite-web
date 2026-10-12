"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { clearRecentSearches, loadRecentSearches, subscribeRecent, useBeta } from "@/lib/beta";

// "Le tue ricerche" nel profilo (come lo storico di Places): le ultime ricerche fatte su
// questo telefono (solo nel browser, chiave "mapetite.recenti"), da rifare con un tocco.
export default function ProfiloRicerche() {
  const on = useBeta("recenti");
  const raw = useSyncExternalStore(subscribeRecent, () => JSON.stringify(loadRecentSearches()), () => "[]");
  if (!on) return null;
  const recent = JSON.parse(raw) as string[];

  return (
    <section className="mb-10" data-testid="profilo-ricerche">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-title text-xl font-semibold text-brand">Le tue ricerche</h2>
        {recent.length > 0 && (
          <button
            type="button"
            onClick={clearRecentSearches}
            aria-label="Cancella le ricerche recenti"
            className="min-h-10 text-sm font-display font-semibold text-text-muted"
          >
            Cancella
          </button>
        )}
      </div>
      {recent.length === 0 ? (
        <p data-testid="ricerche-vuote" className="rounded-card border border-dashed border-border p-4 text-sm text-text-muted">
          Le ricerche che fai su questo telefono compaiono qui, pronte da rifare con un tocco.
        </p>
      ) : (
        <ul className="space-y-2">
          {recent.map((q) => (
            <li key={q}>
              <Link
                href={`/mappa?q=${encodeURIComponent(q)}`}
                data-testid="ricerca-recente"
                aria-label={`Cerca di nuovo: ${q}`}
                className="flex min-h-[64px] items-center gap-3 rounded-card border border-border bg-surface px-4 py-3 active:scale-[0.99] transition-transform duration-150"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-sm font-semibold text-text">{q}</span>
                  <span className="mt-0.5 block text-xs text-accent">Cerca di nuovo</span>
                </span>
                <span aria-hidden className="shrink-0 text-lg text-brand/70">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
