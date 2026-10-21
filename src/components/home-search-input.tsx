"use client";

import { useEffect, useState } from "react";
import { prefetchIntent } from "@/lib/intent-prefetch";

// Campo della home: mentre si scrive, l'AI capisce già la frase (nessuna chiamata Google),
// così sulla mappa la ricerca parte subito. Il modulo resta un normale <form> (funziona senza JS).
export default function HomeSearchInput() {
  const [q, setQ] = useState("");
  useEffect(() => {
    if (q.trim().length < 8) return;
    const t = setTimeout(() => prefetchIntent(q), 700);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <input
      type="search"
      name="q"
      required
      minLength={3}
      enterKeyHint="search"
      placeholder="Cosa cerchi?"
      aria-label="Chiedi all'AI: cosa cerchi?"
      value={q}
      onChange={(e) => setQ(e.target.value)}
      className="min-h-11 min-w-0 flex-1 bg-transparent text-base font-sans text-text placeholder:text-text-muted focus:outline-none"
    />
  );
}
