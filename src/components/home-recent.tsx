"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { loadRecentSearches, subscribeRecent, useBeta } from "@/lib/beta";

// Le ultime ricerche fatte su questo telefono (solo nel browser), anche nella home.
export default function HomeRecent() {
  const on = useBeta("recenti");
  const raw = useSyncExternalStore(subscribeRecent, () => JSON.stringify(loadRecentSearches()), () => "[]");
  const recent = on ? (JSON.parse(raw) as string[]).slice(0, 3) : [];
  if (recent.length === 0) return null;
  return (
    // Semplificare (Lorenzo 17/10): solo le ricerche, senza titolo né "Cancella" (si cancellano dal profilo e dalla mappa).
    <div className="mb-3" data-testid="home-recenti">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        {recent.map((q) => (
          <Link
            key={q}
            href={`/mappa?q=${encodeURIComponent(q)}`}
            className="flex min-h-10 max-w-64 shrink-0 items-center gap-1.5 rounded-pill border border-border bg-white px-3.5 text-sm font-sans text-text active:scale-95"
          >
            <span aria-hidden className="text-text-muted">↻</span>
            <span className="truncate">{q}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
