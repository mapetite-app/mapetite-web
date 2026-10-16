"use client";

import { useState, useSyncExternalStore } from "react";
import { track } from "@/lib/track";
import { MOTIVI, giaVotato, segnaVotato, subscribeFeedback, votatiSnapshot } from "@/lib/valore-tester";

// "Ti è stato utile?" in un tocco (PIANO-25-OTTOBRE.md 7.6): 👍/👎 dopo ricerche, risposte
// dell'assistente, serate a tappe, "Sorprendimi" e prenotazioni.
// Si registra solo il voto, dove e quanti risultati c'erano: mai la frase cercata.
// Con 👎 una riga facoltativa "Cosa mancava?" con scelte rapide: solo la scelta, mai testo libero.
// Con `chiave` il voto si ricorda nel telefono: la stessa risposta non chiede due volte.
export type UtileContesto = "ricerca" | "articolo" | "assistente" | "serata" | "sorpresa" | "prenota";

const SERVER_EMPTY = "[]";

export default function UtileFeedback({
  contesto,
  risultati,
  chiave,
  tono = "chiaro",
  className = "",
}: {
  contesto: UtileContesto;
  risultati?: number;
  chiave?: string;
  tono?: "chiaro" | "scuro";
  className?: string;
}) {
  const [voto, setVoto] = useState<"si" | "no" | null>(null);
  const [motivo, setMotivo] = useState<string | null>(null);
  const votati = useSyncExternalStore(subscribeFeedback, votatiSnapshot, () => SERVER_EMPTY);
  const scuro = tono === "scuro";
  const muted = scuro ? "text-white/75" : "text-text-muted";

  // Già votata in una visita precedente: niente domanda e niente ringraziamento.
  if (!voto && chiave && giaVotato(votati, chiave)) return null;

  if (voto === "si" || (voto === "no" && motivo)) {
    return (
      <p data-testid="utile-grazie" data-contesto={contesto} className={`text-sm font-sans ${muted} ${className}`}>
        {voto === "si" ? "Grazie! 🙏" : "Grazie, ci serve per migliorare."}
      </p>
    );
  }
  if (voto === "no") {
    const scegli = (id: string) => {
      setMotivo(id);
      track("utile", null, { contesto, stato: id });
    };
    return (
      <div data-testid="utile-motivi" data-contesto={contesto} className={className}>
        <p className={`text-sm font-sans ${muted}`}>
          <span className={`font-display font-semibold ${scuro ? "text-white" : "text-brand"}`}>Cosa mancava?</span> Se vuoi, un tocco.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {MOTIVI.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => scegli(m.id)}
              className={`min-h-9 rounded-pill border px-3 text-[13px] font-sans font-semibold active:scale-95 ${scuro ? "border-white/30 bg-white/10 text-white" : "border-border bg-white text-brand"}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const vote = (v: "si" | "no") => {
    setVoto(v);
    if (chiave) segnaVotato(chiave);
    track("utile", null, { voto: v, contesto, ...(typeof risultati === "number" ? { risultati } : {}) });
  };
  const btn = `flex h-10 w-10 items-center justify-center rounded-full border text-lg active:scale-95 ${scuro ? "border-white/30 bg-white/10" : "border-border bg-white"}`;
  return (
    <div data-testid="utile" data-contesto={contesto} className={`flex items-center gap-2 ${className}`}>
      <span className={`font-display text-sm font-semibold ${scuro ? "text-white" : "text-brand"}`}>Ti è stato utile?</span>
      <button type="button" aria-label="Sì, utile" onClick={() => vote("si")} className={btn}>
        👍
      </button>
      <button type="button" aria-label="No, non utile" onClick={() => vote("no")} className={btn}>
        👎
      </button>
    </div>
  );
}
