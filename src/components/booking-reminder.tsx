"use client";

import { useSyncExternalStore } from "react";
import { CalendarCheck, Navigation, X } from "lucide-react";
import { bookingReminders, loadBookings, removeBooking, subscribeBookings, updateBooking, type BookingRequest } from "@/lib/booking";
import { track } from "@/lib/track";

// Promemoria delle prenotazioni richieste (salvate nel telefono): il giorno stesso
// "Stasera alle 21:00 da …", dal giorno dopo "Com'è andata?". In home e nel profilo.
const EMPTY: BookingRequest[] = [];
const VIA: Record<BookingRequest["via"], string> = {
  whatsapp: "richiesta su WhatsApp",
  telefono: "richiesta per telefono",
  sito: "richiesta dal sito",
  copiato: "messaggio copiato",
};

export default function BookingReminder() {
  const list = useSyncExternalStore(subscribeBookings, loadBookings, () => EMPTY);
  const { today, howWasIt } = bookingReminders(list);
  if (today.length === 0 && howWasIt.length === 0) return null;
  return (
    <div data-testid="promemoria-prenotazioni" className="mb-4 flex flex-col gap-2 text-left">
      {today.map((b) => (
        <section key={b.id} data-testid="promemoria-oggi" className="rounded-card bg-brand p-4 text-white shadow-card">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs font-display font-semibold uppercase tracking-wide text-accent">
                <CalendarCheck size={14} /> Oggi{b.time ? ` alle ${b.time}` : ""}
              </p>
              <p className="mt-1 truncate font-title text-lg font-semibold leading-tight">{b.placeName}</p>
              <p className="mt-0.5 text-sm font-sans text-white/80">
                {b.people ? `${b.people} ${b.people === 1 ? "persona" : "persone"} · ` : ""}{VIA[b.via]}
              </p>
            </div>
            <button type="button" aria-label="Nascondi il promemoria" onClick={() => updateBooking(b.id, { dismissed: true })} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80">
              <X size={16} />
            </button>
          </div>
          <p className="mt-2 text-xs font-sans text-white/70">La conferma arriva dal locale: controlla WhatsApp, i messaggi o le chiamate.</p>
          <div className="mt-3 flex gap-2">
            {b.lat != null && b.lng != null && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track("percorso", { id: b.placeId, lat: b.lat!, lng: b.lng! }, { da: "promemoria" })}
                className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-pill bg-accent px-3 text-sm font-display font-semibold text-white"
              >
                <Navigation size={15} /> Percorso
              </a>
            )}
            <button type="button" onClick={() => removeBooking(b.id)} className="min-h-10 rounded-pill border border-white/30 px-3 text-sm font-display font-semibold text-white">
              Non l&apos;ho inviata
            </button>
          </div>
        </section>
      ))}
      {howWasIt.slice(0, 1).map((b) => (
        <section key={b.id} data-testid="promemoria-com-e-andata" className="rounded-card border border-border bg-surface p-4 shadow-card">
          <p className="text-xs font-display font-semibold uppercase tracking-wide text-accent">Com&apos;è andata?</p>
          <p className="mt-1 font-title text-lg font-semibold leading-tight text-text">{b.placeName}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {([["bene", "👍 Mi è piaciuto"], ["male", "👎 Non fa per me"], ["non-andato", "Non ci sono andato"]] as const).map(([outcome, label]) => (
              <button
                key={outcome}
                type="button"
                onClick={() => {
                  updateBooking(b.id, { outcome });
                  if (outcome !== "non-andato") track("ci_sono_stato", { id: b.placeId }, { da: "prenota", esito: outcome });
                }}
                className="min-h-10 rounded-pill border border-border bg-white px-3 text-sm font-display font-semibold text-brand active:scale-95"
              >
                {label}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
