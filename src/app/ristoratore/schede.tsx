"use client";

import { useEffect, useState } from "react";

// Schede del pannello del ristoratore: Panoramica · Clienti · Zona · Promozione.
// Tutto il contenuto è già nella pagina (calcolato sul server); qui si sceglie solo cosa
// mostrare. La scheda scelta resta nell'indirizzo (?vista=) così si può condividere e il
// cambio di periodo non la perde.

export type Scheda = { id: string; label: string; content: React.ReactNode };

export default function Schede({ schede, iniziale, periodi, giorni, base }: { schede: Scheda[]; iniziale: string; periodi: readonly number[]; giorni: number; base: string }) {
  const [attiva, setAttiva] = useState(schede.some((s) => s.id === iniziale) ? iniziale : schede[0].id);

  // Link "Vedi Clienti →" dentro la Panoramica: <a data-vai="clienti">.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-vai]");
      if (!el) return;
      e.preventDefault();
      scegli(el.dataset.vai!);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  });

  function scegli(id: string) {
    setAttiva(id);
    try {
      const u = new URL(window.location.href);
      if (id === schede[0].id) u.searchParams.delete("vista");
      else u.searchParams.set("vista", id);
      window.history.replaceState(null, "", u);
    } catch {}
  }

  const hrefPeriodo = (g: number) => `${base}?giorni=${g}${attiva !== schede[0].id ? `&vista=${attiva}` : ""}`;

  return (
    <>
      <div className="sticky top-0 z-20 -mx-4 mt-4 border-b border-border bg-bg/95 px-4 pb-2 pt-2 backdrop-blur">
        <div role="tablist" aria-label="Sezioni del pannello" data-testid="pannello-schede" className="flex gap-1 rounded-pill bg-surface p-1">
          {schede.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              id={`scheda-${s.id}`}
              aria-selected={attiva === s.id}
              aria-controls={`vista-${s.id}`}
              onClick={() => scegli(s.id)}
              className={`min-h-9 flex-1 rounded-pill px-1 text-[13px] font-display font-semibold transition-colors ${attiva === s.id ? "bg-white text-brand shadow-card" : "text-text-muted"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <nav aria-label="Periodo" className="mt-3 flex items-center justify-end gap-1 text-xs font-display font-semibold">
        {periodi.map((g) => (
          <a
            key={g}
            href={hrefPeriodo(g)}
            aria-current={g === giorni ? "page" : undefined}
            className="inline-flex min-h-11 items-center"
          >
            <span className={`rounded-pill px-3 py-1.5 ${g === giorni ? "bg-brand text-white" : "text-brand"}`}>Ultimi {g} giorni</span>
          </a>
        ))}
      </nav>
      {schede.map((s) => (
        <div key={s.id} role="tabpanel" id={`vista-${s.id}`} aria-labelledby={`scheda-${s.id}`} data-testid={`vista-${s.id}`} hidden={attiva !== s.id}>
          {s.content}
        </div>
      ))}
    </>
  );
}
