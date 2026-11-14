"use client";

import { useState, type ReactNode } from "react";
import { CalendarCheck, Check, MoreHorizontal } from "lucide-react";
import { quandoTavolo, type BookingRequest } from "@/lib/booking";

// "L'hai prenotato?" (revisore 14/11): la stessa frase e le stesse due azioni nel foglio Prenota,
// nel promemoria in home e sul banner della mappa. "Sì" e "Non ancora" in vista; il resto
// (altro giorno, "No, non prenoto") un tocco più in là, in "Altro".

export const DOMANDA_PRENOTATO = "L'hai prenotato?";

export function rigaPrenotato(b: Pick<BookingRequest, "piattaforma">): string {
  return b.piattaforma ? `Se hai confermato su ${b.piattaforma}, te lo ricordo io.` : "Se il locale ti ha detto sì, te lo ricordo io.";
}

export type VoceAltro = { label: string; testid: string; onClick: () => void };

export function DomandaPrenotato({
  b,
  scuro = false,
  conNome = true,
  sopra,
  onSi,
  onNonAncora,
  altro = [],
  ids,
  children,
  now,
}: {
  b: BookingRequest;
  scuro?: boolean;
  conNome?: boolean;
  sopra?: string;
  onSi: () => void;
  onNonAncora: () => void;
  altro?: VoceAltro[];
  ids: { si: string; nonAncora: string };
  children?: ReactNode;
  now?: Date;
}) {
  const [aperto, setAperto] = useState(false);
  const quando = quandoTavolo(b, now);
  const persone = b.people ? `${b.people} ${b.people === 1 ? "persona" : "persone"}` : null;
  const riga = [conNome ? b.placeName : null, quando || null, persone].filter(Boolean).join(" · ");
  const muted = scuro ? "text-white/80" : "text-text-muted";
  return (
    <div data-testid="domanda-prenotato">
      {sopra && (
        <p className="mb-1 flex items-center gap-1.5 text-xs font-display font-semibold uppercase tracking-wide text-accent">
          <CalendarCheck size={14} /> {sopra}
        </p>
      )}
      <p data-testid="domanda-prenotato-titolo" className={`font-title text-xl font-semibold leading-tight ${scuro ? "text-white" : "text-text"}`}>{DOMANDA_PRENOTATO}</p>
      {riga && <p data-testid="domanda-prenotato-riga" className={`mt-0.5 text-sm font-sans font-semibold ${scuro ? "text-white" : "text-brand"}`}>{riga}</p>}
      <p className={`mt-0.5 text-sm font-sans ${muted}`}>{rigaPrenotato(b)}</p>
      {children}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          data-testid={ids.si}
          onClick={onSi}
          className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-pill bg-accent px-3 text-sm font-display font-semibold text-white active:scale-95"
        >
          <Check size={16} /> Sì, l&apos;ho prenotato
        </button>
        <button
          type="button"
          data-testid={ids.nonAncora}
          onClick={onNonAncora}
          className={`min-h-11 rounded-pill px-4 text-sm font-display font-semibold active:scale-95 ${scuro ? "border border-white/30 text-white" : "border border-border bg-white text-brand"}`}
        >
          Non ancora
        </button>
      </div>
      {altro.length > 0 && (
        <>
          <button
            type="button"
            data-testid="domanda-prenotato-altro"
            aria-expanded={aperto}
            onClick={() => setAperto(!aperto)}
            className={`mt-1 flex min-h-10 items-center gap-1 text-sm font-display font-semibold ${muted}`}
          >
            <MoreHorizontal size={16} /> Altro
          </button>
          {aperto && (
            <div className={`overflow-hidden rounded-btn ${scuro ? "bg-white/10" : "border border-border bg-white"}`}>
              {altro.map((v, i) => (
                <button
                  key={v.testid}
                  type="button"
                  data-testid={v.testid}
                  onClick={v.onClick}
                  className={`flex min-h-11 w-full items-center px-3 text-left text-sm font-display font-semibold ${i > 0 ? (scuro ? "border-t border-white/15" : "border-t border-border") : ""} ${scuro ? "text-white" : "text-text"}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
