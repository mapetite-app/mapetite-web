"use client";

import { Check } from "lucide-react";
import { GRUPPI_LOCALE } from "@/lib/tipi-locale";

// "Cosa ti piace?" (Lorenzo, 5/11): tutti i tipi di locale a gruppi, chip a scelta multipla come i filtri del
// vecchio MVP, con la grafica di adesso. Lo stesso componente nel primo accesso e in "I miei gusti" del profilo.
// Il contatore e il tasto per andare avanti li mette chi lo usa (barra fissa in basso).
export default function SelettoreGusti({ scelti, onChange }: { scelti: string[]; onChange: (ids: string[]) => void }) {
  const on = new Set(scelti);
  const tocca = (id: string) => onChange(on.has(id) ? scelti.filter((x) => x !== id) : [...scelti, id]);
  return (
    <div data-testid="selettore-gusti" className="flex flex-col gap-5">
      {GRUPPI_LOCALE.map((g) => {
        const n = g.tipi.filter((t) => on.has(t.id)).length;
        return (
          <section key={g.id} aria-labelledby={`gruppo-${g.id}`} data-testid="gusti-gruppo">
            <h2 id={`gruppo-${g.id}`} className="mb-2.5 flex items-center gap-2 font-display text-[13px] font-semibold uppercase tracking-[0.12em] text-text-muted">
              <span aria-hidden className="text-base">{g.emoji}</span>
              {g.titolo}
              {n > 0 && <span className="rounded-pill bg-brand px-1.5 text-[11px] leading-[18px] tracking-normal text-white">{n}</span>}
            </h2>
            <div className="flex flex-wrap gap-2">
              {g.tipi.map((t) => {
                const sel = on.has(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={sel}
                    data-testid="gusto-chip"
                    data-id={t.id}
                    onClick={() => tocca(t.id)}
                    className={`inline-flex min-h-11 items-center gap-1.5 rounded-pill border-2 px-3.5 font-display text-[15px] font-semibold transition-colors active:scale-[0.97] ${sel ? "border-brand bg-brand text-white" : "border-border bg-white text-brand"}`}
                  >
                    <span aria-hidden>{t.emoji}</span>
                    <span>{t.label}</span>
                    {sel && <Check size={15} strokeWidth={3} aria-hidden />}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** "12 scelti", "1 scelto", "Nessuno scelto". */
export const contaScelti = (n: number) => (n === 0 ? "Nessuno scelto" : n === 1 ? "1 scelto" : `${n} scelti`);
