"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Place } from "@/app/mappa/map-view";
import MandaAlGruppo from "@/components/manda-al-gruppo";
import { getCategoryEmoji } from "@/lib/emoji";
import { cityFromAddress } from "@/lib/city";
import { quartiereDi } from "@/lib/scaffali-salvati";
import { oggiRoma } from "@/lib/stasera";
import { MIN_SALVATI_FESTE, chiaveChiusa, etichettaFeste, postiFeste, stagioneFeste } from "@/lib/feste";
import { trackFeature } from "@/lib/track";

// "Le feste si prenotano adesso" (proposta 89): una sola card in cima a Salvati, dal 1 al 20 dicembre.
// Un tocco su un posto apre la sua scheda (lì c'è "Prenota" dove si può); "Manda al gruppo" fa votare la
// tavolata (proposta 56); "Non quest'anno" la chiude fino alle feste dell'anno dopo (memoria del telefono).
// Per la demo: `?oggi=2026-12-05` nell'indirizzo finge la data (solo questa card, nient'altro).
// 26/11 sera: approvata dal terzo revisore (8,6), accesa per tutti.

const subscribeNothing = () => () => {};

function oggiDiProva(): string {
  try {
    const q = new URLSearchParams(window.location.search).get("oggi");
    if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) return q;
  } catch {
    // niente indirizzo leggibile: la data vera
  }
  return oggiRoma();
}

function letta(chiave: string): boolean {
  try { return window.localStorage.getItem(chiave) === "1"; } catch { return false; }
}

export default function FesteCard({ posti, totale, verdicts, onOpen }: {
  posti: Place[];
  totale: number; // tutti i salvati: con pochi la card ripeterebbe la lista subito sotto
  verdicts: Record<string, { verdict?: string | null }>;
  onOpen: (p: Place) => void;
}) {
  // Data e "chiusa" si leggono solo nel telefono (mai nel server: niente card che appare e sparisce).
  const oggi = useSyncExternalStore(subscribeNothing, oggiDiProva, () => "");
  const giaChiusa = useSyncExternalStore(subscribeNothing, () => (oggi ? letta(chiaveChiusa(oggi)) : false), () => true);
  const [chiusa, setChiusa] = useState(false);
  const scelti = useMemo(() => postiFeste(posti, (p) => cityFromAddress(p.address)), [posti]);
  // Revisore 26/11 (3): con salvati in più città la riga dice quale ha scelto ("3 dei tuoi posti a Milano").
  const cittaScelta = useMemo(() => {
    const tutte = new Set(posti.map((p) => cityFromAddress(p.address)).filter(Boolean));
    const c = scelti[0] ? cityFromAddress(scelti[0].posto.address) : null;
    return tutte.size > 1 && c ? c : null;
  }, [posti, scelti]);
  const [aperta, setAperta] = useState(false);
  const mostra = !!oggi && stagioneFeste(oggi) && totale >= MIN_SALVATI_FESTE && !giaChiusa && !chiusa && scelti.length > 0;
  useEffect(() => { if (mostra) trackFeature("feste_vista", { risultati: scelti.length }); }, [mostra, scelti.length]);

  if (!mostra) return null;

  const chiudi = () => {
    try { window.localStorage.setItem(chiaveChiusa(oggi), "1"); } catch { /* resta chiusa finché non si ricarica */ }
    setChiusa(true);
    // Revisore 26/11 (3): il fuoco non resta sul niente, passa al primo posto della lista.
    requestAnimationFrame(() => (document.querySelector('[data-testid="salvati-lista-posti"] button, [data-testid="salvati-lista-posti"] a') as HTMLElement | null)?.focus());
    trackFeature("feste_chiudi", {});
  };

  return (
    <section data-testid="feste-card" aria-labelledby="feste-titolo" className="mt-2 overflow-hidden rounded-card border border-[#e3e7e7] bg-white shadow-card">
      {/* Revisore 26/11: chiusa è una riga sola, così la lista (la cosa principale di Salvati) resta nella prima
          schermata anche con gli scaffali; un tocco la apre. */}
      <button
        type="button"
        data-testid="feste-apri"
        aria-expanded={aperta}
        aria-controls={aperta ? "feste-posti" : undefined}
        onClick={() => { if (!aperta) trackFeature("feste_apri", { contesto: "card" }); setAperta((a) => !a); }}
        className="flex min-h-[56px] w-full items-center gap-3 px-4 py-2 text-left active:bg-[#f6f7f7]"
      >
        <span className="min-w-0 flex-1">
          <span id="feste-titolo" className="block font-title text-[17px] font-semibold leading-tight text-brand">Cena delle feste?</span>
          <span className="block truncate text-[13px] text-text-muted">{scelti.length} dei tuoi posti{cittaScelta ? ` a ${cittaScelta}` : ""} · prenota presto</span>
        </span>
        <ChevronDown size={18} aria-hidden className={`shrink-0 text-text-muted transition-transform motion-reduce:transition-none ${aperta ? "rotate-180" : ""}`} />
      </button>
      {aperta && (<>
      <ul id="feste-posti" className="border-t border-[#eef1f1]" aria-label="I tuoi posti per la tavolata">
        {scelti.map(({ posto, motivo }) => {
          const zona = quartiereDi(posto);
          return (
            <li key={posto.id} className="border-t border-[#eef1f1] first:border-t-0">
              <button
                type="button"
                data-testid="feste-posto"
                onClick={() => { trackFeature("feste_posto", { contesto: motivo.tipo }); onOpen(posto); }}
                className="flex min-h-[52px] w-full items-center gap-3 px-4 py-1.5 text-left active:bg-[#f6f7f7]"
              >
                <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#f1f4f4] text-lg">{getCategoryEmoji(posto.category, posto.name)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-text">{posto.name}</span>
                  <span data-testid="feste-motivo" className="block truncate text-[12.5px] text-text-muted">{etichettaFeste(motivo)}{zona ? ` · ${zona}` : ""}</span>
                </span>
                <ChevronRight size={18} aria-hidden className="shrink-0 text-text-muted" />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between gap-2 border-t border-[#eef1f1] px-4 py-1.5">
        <MandaAlGruppo
          da="feste"
          accediDa="/mappa?vista=salvati"
          toccoClass="inline-flex shrink-0 whitespace-nowrap"
          pillolaClass="inline-flex min-h-11 items-center whitespace-nowrap rounded-pill px-4 text-sm font-display"
          posti={scelti.map(({ posto }) => ({
            id: posto.id, name: posto.name, category: posto.category, address: posto.address, lat: posto.lat, lng: posto.lng,
            verdict: verdicts[posto.id]?.verdict ?? null, photoRef: null, phone: null, websiteUri: null,
          }))}
        />
        <button type="button" data-testid="feste-non-quest-anno" onClick={chiudi} className="min-h-11 shrink-0 whitespace-nowrap px-1 text-[14px] font-semibold text-[#4a4f55] active:scale-95">
          Non quest&apos;anno
        </button>
      </div>
      </>)}
    </section>
  );
}
