"use client";

import { useState } from "react";
import { getCategoryEmoji } from "@/lib/emoji";
import { answer, finalPosition, nextCompare, scoreAt, startSearch } from "@/lib/classifica";

// "Ti è piaciuto più o meno di X?" (piano 4.3): ricerca binaria sulla classifica della città,
// al massimo 3 domande. Alla fine chiama onSave con il punteggio (posizione tra i due vicini).
export type RankedPlace = { id: string; name: string; category: string | null; score: number };

export default function ClassificaConfronto({
  target,
  city,
  ranked,
  onSave,
  onSkip,
}: {
  target: { id: string; name: string; category: string | null };
  city: string;
  ranked: RankedPlace[]; // stessa città, senza il locale da classificare, dal più amato
  onSave: (score: number, position: number) => Promise<boolean>;
  onSkip?: () => void;
}) {
  const [search, setSearch] = useState(() => startSearch(ranked.length));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const mid = nextCompare(search);
  const other = mid != null ? ranked[mid] : null;

  const reply = async (better: boolean) => {
    if (mid == null || busy) return;
    const next = answer(search, mid, better);
    setSearch(next);
    if (nextCompare(next) == null) {
      const pos = finalPosition(next);
      setBusy(true);
      setError(false);
      const ok = await onSave(scoreAt(ranked, pos), pos);
      setBusy(false);
      if (!ok) { setError(true); setSearch(search); }
    }
  };

  if (!other) return null;
  return (
    <div data-testid="classifica-confronto" className="rounded-card border border-accent/30 bg-accent-light/50 p-3">
      <p className="text-xs font-display font-semibold uppercase tracking-wide text-accent">
        La tua classifica · {city}
      </p>
      <p className="mt-1.5 text-[15px] font-display font-semibold leading-snug text-text">
        {target.name}: ti è piaciuto più o meno di{" "}
        <span aria-hidden>{getCategoryEmoji(other.category, other.name)} </span>
        <span data-testid="classifica-rivale">{other.name}</span>?
      </p>
      {error && <p role="alert" className="mt-2 text-sm text-error">Non sono riuscito a salvare la classifica. Riprova.</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          data-testid="classifica-di-piu"
          disabled={busy}
          onClick={() => void reply(true)}
          className="min-h-11 flex-1 rounded-pill bg-brand px-3 text-sm font-display font-semibold text-white active:scale-95 disabled:opacity-60"
        >
          Di più
        </button>
        <button
          type="button"
          data-testid="classifica-di-meno"
          disabled={busy}
          onClick={() => void reply(false)}
          className="min-h-11 flex-1 rounded-pill border border-brand bg-white px-3 text-sm font-display font-semibold text-brand active:scale-95 disabled:opacity-60"
        >
          Di meno
        </button>
      </div>
      {onSkip && (
        <button type="button" onClick={onSkip} className="mt-1 min-h-10 w-full text-center text-sm font-display font-semibold text-text-muted">
          Salta
        </button>
      )}
      <p className="mt-0.5 text-center text-[11px] text-text-muted">Domanda {search.asked + 1} di al massimo {Math.min(3, Math.ceil(Math.log2(ranked.length + 1)))}</p>
    </div>
  );
}
