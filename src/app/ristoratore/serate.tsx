"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { frasePosto, GIORNI, SETTIMANA, VALIDITA_GIORNI } from "@/lib/serate";

// "Serate tranquille" nel pannello del ristoratore (POSIZIONAMENTO.md, proposta 1): il titolare
// tocca i giorni in cui di solito ha posto e salva. Chi apre la scheda del locale vede una riga
// sola ("Martedì c'è posto"). Nell'esempio dimostrativo si prova tutto ma non si salva niente.

const sigla = (g: number) => GIORNI[g].slice(0, 3);

export default function SerateTranquille({ placeId, iniziali, at, verificato, demo }: { placeId: string; iniziali: number[]; at: string | null; verificato: boolean; demo: boolean }) {
  const [giorni, setGiorni] = useState<number[]>(iniziali);
  const [salvati, setSalvati] = useState<{ giorni: number[]; at: string | null }>({ giorni: iniziali, at });
  const [stato, setStato] = useState<"fermo" | "salvo" | "fatto" | "errore">("fermo");
  const [errore, setErrore] = useState<string | null>(null);
  const cambiato = giorni.join() !== salvati.giorni.join();

  const tocca = (g: number) => {
    setStato("fermo");
    setGiorni((prev) => SETTIMANA.filter((x) => (x === g ? !prev.includes(x) : prev.includes(x))));
  };

  const salva = async () => {
    if (demo) {
      setSalvati({ giorni, at: new Date().toISOString() });
      setStato("fatto");
      return;
    }
    setStato("salvo");
    setErrore(null);
    try {
      const r = await fetch("/api/ristoratore/serate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: placeId, giorni }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "Non sono riuscito a salvare.");
      setSalvati({ giorni: j.giorni ?? giorni, at: j.at ?? null });
      setStato("fatto");
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Non sono riuscito a salvare.");
      setStato("errore");
    }
  };

  // Anteprima della riga che vede chi apre la scheda (anche nell'esempio: lì il locale è "verificato").
  const anteprima = frasePosto({ verificato: true, giorni: cambiato ? giorni : salvati.giorni, at: cambiato ? new Date().toISOString() : salvati.at });

  if (!verificato) {
    return <p className="text-sm font-sans text-text-muted">Si accende quando il locale è verificato.</p>;
  }

  return (
    <div data-testid="serate-tranquille">
      <div className="grid grid-cols-7 gap-1" role="group" aria-label="Giorni in cui di solito hai posto">
        {SETTIMANA.map((g) => {
          const on = giorni.includes(g);
          return (
            <button
              key={g}
              type="button"
              aria-pressed={on}
              aria-label={GIORNI[g]}
              onClick={() => tocca(g)}
              className={`flex h-11 min-w-0 items-center justify-center rounded-pill border text-xs font-display font-semibold capitalize active:scale-95 ${on ? "border-brand bg-brand text-white" : "border-border bg-white text-brand"}`}
            >
              {sigla(g)}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          data-testid="serate-salva"
          disabled={!cambiato || stato === "salvo"}
          onClick={salva}
          className="min-h-11 rounded-pill bg-accent px-5 text-sm font-display font-semibold text-white active:scale-95 disabled:opacity-40"
        >
          {stato === "salvo" ? "Salvo…" : "Salva"}
        </button>
        {stato === "fatto" && !cambiato && (
          <span role="status" className="inline-flex items-center gap-1 text-sm font-sans text-success">
            <Check size={16} aria-hidden /> {demo ? "Fatto (esempio: non si salva)" : "Salvato"}
          </span>
        )}
        {stato === "errore" && errore && <span role="alert" className="text-sm font-sans text-error">{errore}</span>}
      </div>
      <p data-testid="serate-anteprima" className="mt-3 text-xs font-sans leading-snug text-text-muted">
        {anteprima ? (
          <>Nella tua scheda: <strong className="font-display text-text">🌙 {anteprima}</strong> · dura {VALIDITA_GIORNI} giorni, poi te lo richiediamo.</>
        ) : (
          "Nessun giorno scelto: nella tua scheda non compare niente."
        )}
      </p>
    </div>
  );
}
