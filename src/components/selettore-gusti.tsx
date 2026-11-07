"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { GRUPPI_LOCALE } from "@/lib/tipi-locale";

// "Cosa ti piace?" (Lorenzo, 5/11): tutti i tipi di locale a gruppi, chip a scelta multipla come i filtri del
// vecchio MVP, con la grafica di adesso. Lo stesso componente nel primo accesso e in "I miei gusti" del profilo.
// Il contatore e il tasto per andare avanti li mette chi lo usa (barra fissa in basso).
// Revisore 7/11: 54 chip in una pagina lunga erano troppe. Aperti solo i primi due gruppi; gli altri sono una
// riga che si apre al tocco (aperti da subito se hanno già una scelta). Solo nel primo accesso (`compatto`):
// in "I miei gusti" del profilo si vede tutto. La cucina dell'altra città non si mostra.

// Cucine legate a una città: a chi esce a Roma non si propone "Cucina milanese" (e viceversa).
const SOLO_CITTA: Record<string, string> = { romana: "Roma", milanese: "Milano" };
const APERTI = 2;

export default function SelettoreGusti({ scelti, onChange, citta = null, compatto = false }: { scelti: string[]; onChange: (ids: string[]) => void; citta?: string | null; compatto?: boolean }) {
  const on = new Set(scelti);
  const tocca = (id: string) => onChange(on.has(id) ? scelti.filter((x) => x !== id) : [...scelti, id]);
  const [aperti, setAperti] = useState<Set<string>>(
    () => new Set(GRUPPI_LOCALE.filter((g, i) => !compatto || i < APERTI || g.tipi.some((t) => scelti.includes(t.id))).map((g) => g.id)),
  );
  const visibile = (id: string) => on.has(id) || !citta || !SOLO_CITTA[id] || SOLO_CITTA[id] === citta;
  return (
    <div data-testid="selettore-gusti" className="flex flex-col gap-5">
      {GRUPPI_LOCALE.map((g) => {
        const tipi = g.tipi.filter((t) => visibile(t.id));
        const n = tipi.filter((t) => on.has(t.id)).length;
        const aperto = aperti.has(g.id);
        const badge = n > 0 && <span className="rounded-pill bg-brand px-1.5 text-[11px] leading-[18px] tracking-normal text-white">{n}</span>;
        if (!aperto) {
          return (
            <section key={g.id} aria-labelledby={`gruppo-${g.id}`} data-testid="gusti-gruppo" data-chiuso="">
              <h2 id={`gruppo-${g.id}`} className="contents">
                <button
                  type="button"
                  aria-expanded={false}
                  data-testid="gusti-gruppo-apri"
                  onClick={() => setAperti((s) => new Set(s).add(g.id))}
                  className="flex min-h-12 w-full items-center gap-2 rounded-card border border-border bg-white px-4 text-left font-display text-[15px] font-semibold text-brand active:scale-[0.99]"
                >
                  <span aria-hidden className="text-base">{g.emoji}</span>
                  <span className="flex-1">{g.titolo}</span>
                  <span className="font-sans text-[13px] font-normal text-text-muted">{tipi.length} tipi</span>
                  <ChevronDown aria-hidden size={18} className="text-text-muted" />
                </button>
              </h2>
            </section>
          );
        }
        return (
          <section key={g.id} aria-labelledby={`gruppo-${g.id}`} data-testid="gusti-gruppo">
            <h2 id={`gruppo-${g.id}`} className="mb-2.5 flex items-center gap-2 font-display text-[13px] font-semibold uppercase tracking-[0.12em] text-text-muted">
              <span aria-hidden className="text-base">{g.emoji}</span>
              {g.titolo}
              {badge}
            </h2>
            <div className="flex flex-wrap gap-2">
              {tipi.map((t) => {
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
                    {/* Designer 7/11: la spunta al posto dell'emoji, la chip non cambia larghezza. */}
                    <span aria-hidden className="flex w-5 justify-center">{sel ? <Check size={15} strokeWidth={3} /> : t.emoji}</span>
                    <span>{t.label}</span>
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
