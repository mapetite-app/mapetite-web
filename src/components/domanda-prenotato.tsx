"use client";

import { useState, type ReactNode } from "react";
import { CalendarCheck, Check, MoreHorizontal } from "lucide-react";
import { dateKey, quandoTavolo, updateBooking, type BookingRequest } from "@/lib/booking";

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
  compatto = false,
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
  compatto?: boolean;
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
  // Compatto (banner sulla mappa, revisore 14/11): "Stasera 21:30 · 2 persone", in una riga, senza spiegazione.
  const persone = b.people ? `${b.people} ${b.people === 1 ? "persona" : "persone"}` : null;
  const riga = [conNome ? b.placeName : null, (compatto ? quando.replace(" alle ", " ") : quando) || null, persone].filter(Boolean).join(" · ");
  const muted = scuro ? "text-white/80" : "text-text-muted";
  return (
    <div data-testid="domanda-prenotato">
      {sopra && (
        <p className="mb-1 flex items-center gap-1.5 text-xs font-display font-semibold uppercase tracking-wide text-accent">
          <CalendarCheck size={14} /> {sopra}
        </p>
      )}
      <p data-testid="domanda-prenotato-titolo" className={`font-title ${compatto ? "text-lg" : "text-xl"} font-semibold leading-tight ${scuro ? "text-white" : "text-text"}`}>{DOMANDA_PRENOTATO}</p>
      {riga && <p data-testid="domanda-prenotato-riga" className={`mt-0.5 text-sm font-sans font-semibold ${compatto ? "truncate" : ""} ${scuro ? "text-white" : "text-brand"}`}>{riga}</p>}
      {!compatto && <p className={`mt-0.5 text-sm font-sans ${muted}`}>{rigaPrenotato(b)}</p>}
      {children}
      <div className={`${compatto ? "mt-2" : "mt-3"} flex gap-2`}>
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
      {/* Una sola voce (revisore 14/11): un link diretto, non un "Altro" che ne apre una. */}
      {altro.length === 1 && (
        <button
          type="button"
          data-testid={altro[0].testid}
          onClick={altro[0].onClick}
          className={`mt-1 min-h-10 text-sm font-display font-semibold underline underline-offset-2 ${muted}`}
        >
          {altro[0].label}
        </button>
      )}
      {altro.length > 1 && (
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

// "Sì" su una richiesta senza giorno o senza ora (TheFork aperto senza sceglierli): "Per quando?" qui,
// così i promemoria sanno quando ricordarlo. Lo usano la home, la mappa e /prenotazioni.
export function PerQuando({ b, scuro = false, onFatto }: { b: BookingRequest; scuro?: boolean; onFatto?: () => void }) {
  const [date, setDate] = useState(b.date ?? "");
  const [time, setTime] = useState(b.time ?? "");
  const campo = "min-h-11 min-w-0 flex-1 rounded-btn border border-border bg-white px-3 text-base font-sans text-text";
  return (
    <div data-testid="prenotazione-quando" className={`mt-2 rounded-btn p-3 ${scuro ? "bg-white/10" : "bg-surface"}`}>
      <p className={`text-sm font-display font-semibold ${scuro ? "text-white" : "text-text"}`}>Per quando?</p>
      <div className="mt-2 flex gap-2">
        <input type="date" aria-label="Giorno" min={dateKey(new Date())} value={date} onChange={(e) => setDate(e.target.value)} className={campo} />
        <input type="time" aria-label="Ora" value={time} onChange={(e) => setTime(e.target.value)} className={campo} />
      </div>
      <button
        type="button"
        data-testid="prenotazione-quando-salva"
        disabled={!date || !time}
        onClick={() => { updateBooking(b.id, { date, time, confirmed: true }); onFatto?.(); }}
        className="mt-2 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-pill bg-accent px-4 text-sm font-display font-semibold text-white disabled:bg-border disabled:text-text-muted"
      >
        <Check size={16} /> Segna prenotato
      </button>
    </div>
  );
}
