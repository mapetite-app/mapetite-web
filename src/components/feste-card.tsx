"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ChevronRight } from "lucide-react";
import type { Place } from "@/app/mappa/map-view";
import MandaAlGruppo from "@/components/manda-al-gruppo";
import { getCategoryEmoji } from "@/lib/emoji";
import { cityFromAddress } from "@/lib/city";
import { oggiRoma } from "@/lib/stasera";
import { chiaveChiusa, etichettaFeste, postiFeste, stagioneFeste } from "@/lib/feste";
import { trackFeature } from "@/lib/track";

// "Le feste si prenotano adesso" (proposta 89): una sola card in cima a Salvati, dal 1 al 20 dicembre.
// Un tocco su un posto apre la sua scheda (lì c'è "Prenota" dove si può); "Manda al gruppo" fa votare la
// tavolata (proposta 56); "Non quest'anno" la chiude fino alle feste dell'anno dopo (memoria del telefono).
// Per la demo: `?oggi=2026-12-05` nell'indirizzo finge la data (solo questa card, nient'altro).

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

export default function FesteCard({ posti, verdicts, onOpen }: {
  posti: Place[];
  verdicts: Record<string, { verdict?: string | null }>;
  onOpen: (p: Place) => void;
}) {
  // Data e "chiusa" si leggono solo nel telefono (mai nel server: niente card che appare e sparisce).
  const oggi = useSyncExternalStore(subscribeNothing, oggiDiProva, () => "");
  const giaChiusa = useSyncExternalStore(subscribeNothing, () => (oggi ? letta(chiaveChiusa(oggi)) : false), () => true);
  const [chiusa, setChiusa] = useState(false);
  const scelti = useMemo(() => postiFeste(posti), [posti]);
  const mostra = !!oggi && stagioneFeste(oggi) && !giaChiusa && !chiusa && scelti.length > 0;
  useEffect(() => { if (mostra) trackFeature("feste_vista", { risultati: scelti.length }); }, [mostra, scelti.length]);

  if (!mostra) return null;

  const chiudi = () => {
    try { window.localStorage.setItem(chiaveChiusa(oggi), "1"); } catch { /* resta chiusa finché non si ricarica */ }
    setChiusa(true);
    trackFeature("feste_chiudi", {});
  };

  return (
    <section data-testid="feste-card" aria-labelledby="feste-titolo" className="mt-2 overflow-hidden rounded-card border border-[#e3e7e7] bg-white shadow-card">
      <div className="px-4 pt-3.5">
        <h2 id="feste-titolo" className="font-title text-[19px] font-semibold leading-tight text-brand">Cena delle feste?</h2>
        <p className="mt-0.5 text-[13.5px] text-text-muted">A metà dicembre è tutto pieno: si prenota adesso.</p>
      </div>
      <ul className="mt-2" aria-label="I tuoi posti per la tavolata">
        {scelti.map(({ posto, motivo }) => {
          const zona = cityFromAddress(posto.address);
          return (
            <li key={posto.id} className="border-t border-[#eef1f1] first:border-t-0">
              <button
                type="button"
                data-testid="feste-posto"
                onClick={() => { trackFeature("feste_apri", { contesto: motivo.tipo }); onOpen(posto); }}
                className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-[#f6f7f7]"
              >
                <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#f1f4f4] text-xl">{getCategoryEmoji(posto.category, posto.name)}</span>
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
      <div className="flex items-center justify-between gap-2 border-t border-[#eef1f1] px-4 py-2.5">
        <MandaAlGruppo
          da="feste"
          accediDa="/mappa?vista=salvati"
          toccoClass="inline-flex"
          pillolaClass="inline-flex min-h-11 items-center rounded-pill px-4 text-sm font-display"
          posti={scelti.map(({ posto }) => ({
            id: posto.id, name: posto.name, category: posto.category, address: posto.address, lat: posto.lat, lng: posto.lng,
            verdict: verdicts[posto.id]?.verdict ?? null, photoRef: null, phone: null, websiteUri: null,
          }))}
        />
        <button type="button" data-testid="feste-non-quest-anno" onClick={chiudi} className="min-h-11 px-1 text-[13px] font-semibold text-text-muted active:scale-95">
          Non quest&apos;anno
        </button>
      </div>
    </section>
  );
}
