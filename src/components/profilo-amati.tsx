"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, X } from "lucide-react";
import SelettoreGusti, { contaScelti } from "@/components/selettore-gusti";
import { salvaAmati } from "@/app/onboarding/actions";
import { tipoLocale } from "@/lib/tipi-locale";
import { trackFeature } from "@/lib/track";

const VISIBILI = 8;

// "I miei gusti" nel profilo (Lorenzo, 5/11): i tipi di locale scelti, e lo stesso selettore del primo accesso
// per cambiarli, a tutto schermo. Si salva sul server (profiles.gusto.amati).
export default function ProfiloAmati({ iniziali }: { iniziali: string[] }) {
  const router = useRouter();
  const [amati, setAmati] = useState(iniziali);
  const [aperto, setAperto] = useState(false);
  const [bozza, setBozza] = useState<string[]>(iniziali);
  const [errore, setErrore] = useState<string | null>(null);
  const [salvando, startSalva] = useTransition();
  const tipi = amati.map(tipoLocale).filter((t): t is NonNullable<ReturnType<typeof tipoLocale>> => t != null);

  // Foglio aperto: la pagina sotto non scorre.
  useEffect(() => {
    if (!aperto) return;
    const prima = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prima; };
  }, [aperto]);

  const apri = () => { setBozza(amati); setErrore(null); setAperto(true); };
  const salva = () => startSalva(async () => {
    const r = await salvaAmati(bozza).catch(() => ({ error: "Non sono riuscito a salvare: controlla la connessione e riprova.", amati: bozza }));
    if (r.error) { setErrore(r.error); return; }
    setAmati(r.amati);
    setAperto(false);
    trackFeature("gusti_amati", { contesto: "profilo", tipi: r.amati.length });
    router.refresh();
  });

  return (
    // Revisore 5/11: dentro il riquadro "Il tuo gusto" (prima era un secondo riquadro quasi omonimo, con il suo
    // "Modifica"): una riga "Tipi di locale" con le pillole e "Cambia" accanto.
    <section data-testid="profilo-amati" aria-labelledby="amati-titolo" className="mt-3 border-t border-[#e3e7e7] pt-2">
      <div className="flex items-center gap-1">
        <h3 id="amati-titolo" className="min-w-0 flex-1 font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted"><span className="sr-only">I miei gusti: </span><span aria-hidden>Tipi di locale</span></h3>
        {/* Revisore 5/11: una sola parola "Modifica" nel riquadro (quella del titolo): qui solo la freccia. */}
        <button type="button" data-testid="profilo-amati-modifica" onClick={apri} aria-label={tipi.length ? "Cambia i tipi di locale" : undefined} className="-mr-2 flex min-h-11 min-w-11 items-center justify-center px-2 text-[13px] font-medium text-brand active:opacity-70">
          {tipi.length ? <ChevronRight size={18} aria-hidden /> : "Scegli"}
        </button>
      </div>
      {tipi.length ? (
        <ul aria-label="Tipi di locale che ti piacciono" className="mt-1 flex flex-wrap gap-2">
          {tipi.slice(0, VISIBILI).map((t) => (
            <li key={t.id} data-testid="profilo-amati-chip" className="inline-flex min-h-9 items-center gap-1.5 rounded-pill bg-[#f0f2f2] px-3.5 text-[14px] font-medium text-[#33373d]">
              <span aria-hidden>{t.emoji}</span>{t.label}
            </li>
          ))}
          {tipi.length > VISIBILI && (
            <li>
              <button type="button" onClick={apri} data-testid="profilo-amati-altri" className="inline-flex min-h-9 items-center rounded-pill px-2 text-[14px] font-medium text-brand">
                {tipi.length - VISIBILI === 1 ? "e un altro" : `e altri ${tipi.length - VISIBILI}`}
              </button>
            </li>
          )}
        </ul>
      ) : (
        <button type="button" onClick={apri} data-testid="profilo-amati-vuoto" className="mt-1 text-left text-[14px] text-text-muted">
          Pizzeria, sushi, cocktail bar…: dimmi cosa ti piace e la ricerca parte da lì.
        </button>
      )}

      {aperto && (
        <div role="dialog" aria-modal="true" aria-labelledby="amati-foglio-titolo" data-testid="amati-foglio" className="fixed inset-0 z-[70] flex flex-col bg-[#f6f7f7]">
          <div className="flex items-center gap-2 px-4 pb-2 pt-[calc(0.75rem+env(safe-area-inset-top))]">
            <h2 id="amati-foglio-titolo" className="min-w-0 flex-1 font-title text-[26px] leading-tight text-text">Cosa ti piace?</h2>
            <button type="button" onClick={() => setAperto(false)} aria-label="Chiudi senza salvare" className="-mr-2 flex h-11 w-11 items-center justify-center text-text active:opacity-70">
              <X size={22} aria-hidden />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-2">
            <SelettoreGusti scelti={bozza} onChange={setBozza} />
          </div>
          <div className="border-t border-[#e3e7e7] bg-[#f6f7f7]/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
            <p data-testid="amati-foglio-contatore" aria-live="polite" className="mb-2 text-center font-display text-[14px] font-semibold text-brand">{contaScelti(bozza.length)}</p>
            <button type="button" data-testid="amati-salva" onClick={salva} disabled={salvando} className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-brand px-6 font-display text-[17px] font-semibold text-white shadow-float active:scale-[0.98] disabled:opacity-60">
              {salvando ? "Salvo…" : "Salva"}
            </button>
            {errore && <p role="alert" className="mt-2 text-center text-sm text-error">{errore}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
