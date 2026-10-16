"use client";

import { useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { trackFeature } from "@/lib/track";
import { domandaSnapshot, segnaDomandaFatta, subscribeFeedback } from "@/lib/valore-tester";

// Domanda settimanale breve (PIANO-25-OTTOBRE.md 7.6), in home: al massimo una volta ogni
// 7 giorni e solo a chi ha usato l'app in almeno 2 giorni diversi (src/lib/valore-tester.ts).
// Due tocchi: quanto ha aiutato (1–5) e se lo consiglierebbe (Sì/Forse/No). Chiudibile.
// Segnali: "funzione" con nome "domanda_settimanale" e voto (1–5) oppure stato (si/forse/no/chiusa).
const CONSIGLIO = [
  { id: "si", label: "Sì" },
  { id: "forse", label: "Forse" },
  { id: "no", label: "No" },
] as const;

export default function DomandaSettimanale() {
  const due = useSyncExternalStore(subscribeFeedback, () => domandaSnapshot(), () => false);
  // Una volta iniziata resta visibile fino alla fine, anche se nel telefono è già segnata come fatta.
  const [fase, setFase] = useState<"voto" | "consiglio" | "grazie" | null>(null);
  const [voto, setVoto] = useState<number | null>(null);
  if (!due && fase === null) return null;

  const chiudi = () => {
    if (fase === null || fase === "voto") trackFeature("domanda_settimanale", { stato: "chiusa" });
    segnaDomandaFatta();
    setFase(null);
  };
  const vota = (n: number) => {
    setVoto(n);
    setFase("consiglio");
    segnaDomandaFatta();
    trackFeature("domanda_settimanale", { voto: n });
  };
  const consiglia = (id: string) => {
    setFase("grazie");
    trackFeature("domanda_settimanale", { stato: id });
  };
  // Dopo "Chiudi" la fase torna null e `due` diventa falso: il componente sparisce.
  const current = fase ?? "voto";

  return (
    <section data-testid="domanda-settimanale" className="relative mb-3 rounded-card border border-border bg-white p-4 text-left shadow-card">
      <button
        type="button"
        onClick={chiudi}
        aria-label="Chiudi la domanda"
        className="absolute right-1.5 top-1.5 flex h-10 w-10 items-center justify-center rounded-full text-text-muted active:bg-surface"
      >
        <X size={16} />
      </button>
      {current === "voto" && (
        <>
          <p className="pr-8 font-display text-[15px] font-semibold leading-snug text-brand">
            Quanto ti ha aiutato Mapetite questa settimana a scegliere dove andare?
          </p>
          <div data-testid="domanda-voto" className="mt-3 grid grid-cols-5 gap-1.5" role="group" aria-label="Da 1 (per niente) a 5 (moltissimo)">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => vota(n)}
                aria-label={`${n} su 5`}
                className="flex min-h-11 items-center justify-center rounded-btn border border-border bg-surface font-display text-base font-semibold text-brand active:scale-95"
              >
                {n}
              </button>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[11px] font-sans text-text-muted">
            <span>per niente</span>
            <span>moltissimo</span>
          </div>
        </>
      )}
      {current === "consiglio" && (
        <>
          <p className="pr-8 font-display text-[15px] font-semibold leading-snug text-brand">Lo consiglieresti a un amico?</p>
          <div data-testid="domanda-consiglio" className="mt-3 grid grid-cols-3 gap-1.5">
            {CONSIGLIO.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => consiglia(c.id)}
                className="min-h-11 rounded-pill border border-border bg-surface font-display text-sm font-semibold text-brand active:scale-95"
              >
                {c.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] font-sans text-text-muted">Hai dato {voto} su 5. Grazie!</p>
        </>
      )}
      {current === "grazie" && (
        <p data-testid="domanda-grazie" className="pr-8 text-sm font-sans text-text">
          <span className="font-display font-semibold text-brand">Grazie!</span> Ci aiuta a capire se Mapetite ti serve davvero. Te lo richiediamo tra una settimana.
        </p>
      )}
    </section>
  );
}
