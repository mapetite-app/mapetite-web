"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { clearRecentSearches, loadRecentSearches, subscribeRecent, useBeta } from "@/lib/beta";

// Le ultime ricerche fatte su questo telefono (solo nel browser), anche nella home.
export default function HomeRecent() {
  const on = useBeta("recenti");
  const raw = useSyncExternalStore(subscribeRecent, () => JSON.stringify(loadRecentSearches()), () => "[]");
  const recent = on ? (JSON.parse(raw) as string[]).slice(0, 3) : [];
  if (recent.length === 0) return null;
  return (
    <div className="mb-3" data-testid="home-recenti">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-xs font-display font-semibold uppercase tracking-wider text-text-muted">Le tue ultime ricerche</p>
        <button type="button" onClick={clearRecentSearches} aria-label="Cancella le ricerche recenti" className="min-h-8 text-xs font-sans text-text-muted">
          Cancella
        </button>
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        {recent.map((q) => (
          <Link
            key={q}
            href={`/mappa?q=${encodeURIComponent(q)}`}
            className="flex min-h-10 max-w-64 shrink-0 items-center rounded-pill bg-accent-light px-3.5 text-sm font-sans text-accent active:scale-95"
          >
            <span className="truncate">↻ {q}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
