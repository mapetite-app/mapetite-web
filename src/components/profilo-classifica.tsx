"use client";

import { useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import { browserClient } from "@/lib/supabase/client-lazy";
import { cityFromAddress } from "@/lib/city";
import { sortByScore, topByCity } from "@/lib/classifica";
import ClassificaConfronto from "@/components/classifica-confronto";
import ClassificaLista from "@/components/classifica-lista";

// "La tua classifica" nel profilo (piano 4.3): la top dei posti provati, città per città, e
// "Metti in classifica" per i visitati non ancora ordinati (stesse domande della scheda).
// Il profilo la mostra solo se la colonna rank_score esiste (migrazione 20261015_classifica).

export type ClassificaRow = { placeId: string; name: string; category: string | null; address: string | null; score: number | null };

export default function ProfiloClassifica({ userId, initialRows }: { userId: string; initialRows: ClassificaRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [city, setCity] = useState<string | null>(null);
  const [ordering, setOrdering] = useState(false);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [error, setError] = useState(false);

  const withCity = useMemo(() => rows.map((r) => ({ ...r, city: cityFromAddress(r.address) })), [rows]);
  const tops = useMemo(
    () => topByCity(withCity.filter((r) => r.score != null).map((r) => ({ ...r, score: r.score! }))),
    [withCity],
  );
  const todo = withCity.filter((r) => r.score == null && r.city && !skipped.has(r.placeId));
  const current = todo[0] ?? null;
  const rankedForCurrent = current
    ? sortByScore(withCity.filter((r) => r.city === current.city && r.score != null).map((r) => ({ id: r.placeId, name: r.name, category: r.category, score: r.score! })))
    : [];

  const save = async (placeId: string, score: number) => {
    const supabase = await browserClient().catch(() => null);
    if (!supabase) { setError(true); return false; }
    const { error: err } = await supabase.from("saved_places").update({ rank_score: score }).eq("user_id", userId).eq("place_id", placeId);
    if (err) { setError(true); return false; }
    setError(false);
    setRows((prev) => prev.map((r) => (r.placeId === placeId ? { ...r, score } : r)));
    return true;
  };

  // Inizio: il primo provato di ogni città ancora senza classifica entra senza domande (non c'è
  // nulla con cui confrontarlo); per tutti gli altri si chiede "più o meno di…?".
  const start = async () => {
    setSkipped(new Set());
    setOrdering(true);
    const seeded = new Set(withCity.filter((r) => r.score != null).map((r) => r.city));
    for (const r of withCity) {
      if (r.score != null || !r.city || seeded.has(r.city)) continue;
      seeded.add(r.city);
      if (!(await save(r.placeId, 0))) setSkipped((prev) => new Set(prev).add(r.placeId));
    }
  };

  if (rows.length === 0) return null;
  const shown = tops.find(([c]) => c === city) ?? tops[0] ?? null;
  const todoCount = withCity.filter((r) => r.score == null && r.city).length;

  return (
    <section id="classifica" data-testid="profilo-classifica" className="mb-10 scroll-mt-4">
      <h2 className="mb-3 flex items-center gap-2 font-title text-xl font-semibold text-brand">
        <Trophy size={20} aria-hidden className="text-accent" /> La tua classifica
      </h2>

      {tops.length > 1 && (
        <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Città">
          {tops.map(([c, list]) => {
            const on = shown?.[0] === c;
            return (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={on}
                data-testid="classifica-citta"
                onClick={() => setCity(c)}
                className={`min-h-10 shrink-0 rounded-pill border px-4 text-sm font-display font-semibold ${on ? "border-brand bg-brand text-white" : "border-border bg-white text-brand"}`}
              >
                {c} · {list.length}
              </button>
            );
          })}
        </div>
      )}

      {shown ? (
        <>
          {tops.length === 1 && <p className="mb-2 text-xs font-display font-semibold uppercase tracking-wider text-text-muted">📍 {shown[0]}</p>}
          <ClassificaLista voci={shown[1].map((r) => ({ id: r.placeId, name: r.name, category: r.category, href: `/mappa?salvato=${r.placeId}` }))} />
        </>
      ) : (
        <p data-testid="classifica-vuota" className="rounded-card border border-dashed border-border p-4 text-sm text-text-muted">
          Metti in ordine i posti che hai provato: ti chiedo solo &quot;ti è piaciuto più o meno di…?&quot;, al massimo tre volte per posto.
        </p>
      )}

      {todoCount > 0 && !ordering && (
        <button
          type="button"
          data-testid="classifica-ordina"
          onClick={() => void start()}
          className="mt-3 flex min-h-12 w-full items-center justify-center rounded-pill border border-dashed border-brand/40 px-4 text-sm font-display font-semibold text-brand active:scale-[0.99]"
        >
          Metti in classifica {todoCount === 1 ? "1 posto provato" : `${todoCount} posti provati`}
        </button>
      )}

      {ordering && (
        <div className="mt-3" data-testid="classifica-ordina-box">
          {current && rankedForCurrent.length > 0 ? (
            <>
              <p className="mb-2 text-sm text-text-muted">
                {todo.length === 1 ? "Ultimo da mettere in classifica" : `Ne restano ${todo.length}`}
              </p>
              <ClassificaConfronto
                key={current.placeId}
                target={{ id: current.placeId, name: current.name, category: current.category }}
                city={current.city!}
                ranked={rankedForCurrent}
                onSave={(score) => save(current.placeId, score)}
                onSkip={() => setSkipped((prev) => new Set(prev).add(current.placeId))}
              />
            </>
          ) : !current ? (
            <div className="flex items-center justify-between gap-3 rounded-card bg-accent-light/60 px-4 py-3">
              <p role="status" className="text-sm text-text">Fatto: la classifica è aggiornata.</p>
              <button type="button" onClick={() => setOrdering(false)} className="min-h-10 shrink-0 text-sm font-display font-semibold text-brand">Chiudi</button>
            </div>
          ) : null}
          {error && <p role="alert" className="mt-2 text-sm text-error">Non sono riuscito a salvare la classifica: controlla la connessione e riprova.</p>}
        </div>
      )}
    </section>
  );
}
