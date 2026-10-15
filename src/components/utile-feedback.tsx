"use client";

import { useState } from "react";
import { track } from "@/lib/track";

// "Ti è stato utile?" in un tocco (PIANO-25-OTTOBRE.md 7.6): 👍/👎 sui risultati di una ricerca.
// Si registra solo il voto, dove e quanti risultati c'erano: mai la frase cercata.
// Dopo il tocco ringrazia e non si può rivotare (un voto per ricerca mostrata).
export default function UtileFeedback({ contesto, risultati }: { contesto: "ricerca" | "articolo"; risultati: number }) {
  const [voto, setVoto] = useState<"si" | "no" | null>(null);
  if (voto) {
    return (
      <p data-testid="utile-grazie" className="text-sm font-sans text-text-muted">
        {voto === "si" ? "Grazie! 🙏" : "Grazie, ci serve per migliorare. Se vuoi, raccontaci cosa non andava."}
      </p>
    );
  }
  const vote = (v: "si" | "no") => {
    setVoto(v);
    track("utile", null, { voto: v, contesto, risultati });
  };
  return (
    <div data-testid="utile" className="flex items-center gap-2">
      <span className="font-display text-sm font-semibold text-brand">Ti è stato utile?</span>
      <button type="button" aria-label="Sì, utile" onClick={() => vote("si")} className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white text-lg active:scale-95">
        👍
      </button>
      <button type="button" aria-label="No, non utile" onClick={() => vote("no")} className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white text-lg active:scale-95">
        👎
      </button>
    </div>
  );
}
