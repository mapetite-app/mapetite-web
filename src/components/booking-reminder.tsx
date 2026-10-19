"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { CalendarCheck, Copy, MessageCircle, Navigation, Phone, X } from "lucide-react";
import { bookingReminders, cancelMessage, dateKey, doubleBookings, loadBookings, removeBooking, subscribeBookings, telHref, updateBooking, whatsappNumber, type BookingRequest } from "@/lib/booking";
import { track, trackFeature } from "@/lib/track";

// Promemoria delle prenotazioni richieste (salvate nel telefono): il giorno stesso
// "Stasera alle 21:00 da …", dal giorno dopo "Com'è andata?". In home e nel profilo.
const EMPTY: BookingRequest[] = [];
const VIA: Record<BookingRequest["via"], string> = {
  whatsapp: "richiesta su WhatsApp",
  telefono: "richiesta per telefono",
  sito: "richiesta dal sito",
  copiato: "messaggio copiato",
};

// "Non vado più" (contro i tavoli vuoti, docs/autonomia/POSIZIONAMENTO.md): il messaggio per il locale
// è già scritto; un tocco per mandarlo da dove era partita la richiesta. Senza numero si copia.
function Disdetta({ b, titolo }: { b: BookingRequest; titolo?: string }) {
  const [copied, setCopied] = useState(false);
  let name = "";
  try { name = window.localStorage.getItem("mapetite.nome") ?? ""; } catch { /* storage non disponibile */ }
  const text = cancelMessage(b, name);
  const wa = whatsappNumber(b.phone);
  const done = (contesto: string) => {
    trackFeature("prenotazione_disdetta", { contesto });
    updateBooking(b.id, { outcome: "non-andato", dismissed: true });
  };
  const btn = "flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-pill bg-white px-3 text-sm font-display font-semibold text-brand";
  return (
    <div data-testid="promemoria-disdetta" className="mt-3 rounded-btn bg-white/10 p-3">
      <p className="text-xs font-sans text-white/80">{titolo ?? "Avvisa il locale: così dà il tavolo a qualcun altro."}</p>
      <p data-testid="promemoria-disdetta-testo" className="mt-1.5 text-sm font-sans italic text-white">“{text}”</p>
      <div className="mt-2.5 flex gap-2">
        {wa ? (
          <a href={`https://wa.me/${wa}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" data-testid="disdetta-whatsapp" onClick={() => done("whatsapp")} className={btn}>
            <MessageCircle size={15} /> WhatsApp
          </a>
        ) : b.phone ? (
          <a href={telHref(b.phone)} data-testid="disdetta-chiama" onClick={() => done("telefono")} className={btn}>
            <Phone size={15} /> Chiama
          </a>
        ) : (
          <button
            type="button"
            data-testid="disdetta-copia"
            onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); } catch { /* copia non riuscita: il testo resta da leggere */ } done("copiato"); }}
            className={btn}
          >
            <Copy size={15} /> {copied ? "Copiato" : "Copia il messaggio"}
          </button>
        )}
      </div>
      <button type="button" onClick={() => removeBooking(b.id)} className="mt-2 min-h-9 text-xs font-display font-semibold text-white/80 underline underline-offset-2">
        Non l&apos;avevo inviata: toglila
      </button>
    </div>
  );
}

// "Hai 2 tavoli sabato: quale tieni?" (proposta CEO 19/10): un solo promemoria per i tavoli dello stesso
// pasto; scelto quello da tenere, la disdetta degli altri è già scritta. Il giorno stesso e il giorno prima.
function Doppio({ group, domani }: { group: BookingRequest[]; domani: boolean }) {
  const [kept, setKept] = useState<string | null>(null);
  const evening = group.some((b) => b.time && Number(b.time.slice(0, 2)) >= 16);
  const lunch = group.every((b) => b.time && Number(b.time.slice(0, 2)) < 16);
  const when = domani ? (lunch ? "domani a pranzo" : evening ? "domani sera" : "domani") : lunch ? "oggi a pranzo" : evening ? "stasera" : "oggi";
  const tenuto = group.find((b) => b.id === kept);
  return (
    <section data-testid="promemoria-doppio" className="rounded-card bg-brand p-4 text-white shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-display font-semibold uppercase tracking-wide text-accent">
            <CalendarCheck size={14} /> {domani ? "Domani" : "Oggi"} · {group.length} tavoli
          </p>
          <p className="mt-1 font-title text-lg font-semibold leading-tight">
            {tenuto ? `Tieni ${tenuto.placeName}` : `Hai ${group.length} tavoli ${when}: quale tieni?`}
          </p>
        </div>
        <button
          type="button"
          aria-label="Nascondi il promemoria"
          onClick={() => group.forEach((b) => updateBooking(b.id, domani ? { dismissedEve: true } : { dismissed: true }))}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80"
        >
          <X size={16} />
        </button>
      </div>
      {!tenuto ? (
        <div className="mt-3 flex flex-col gap-2">
          {group.map((b) => (
            <button
              key={b.id}
              type="button"
              data-testid="tengo-questo"
              onClick={() => { setKept(b.id); trackFeature("doppia_prenotazione", { contesto: domani ? "domani" : "oggi" }); }}
              className="flex min-h-12 items-center justify-between gap-2 rounded-btn bg-white/10 px-3 text-left active:scale-[0.99]"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-display font-semibold">{b.placeName}</span>
                <span className="block text-xs font-sans text-white/70">{[b.time ? `alle ${b.time}` : null, b.people ? `${b.people} ${b.people === 1 ? "persona" : "persone"}` : null].filter(Boolean).join(" · ")}</span>
              </span>
              <span className="shrink-0 rounded-pill bg-white px-3 py-1.5 text-xs font-display font-semibold text-brand">Tengo questo</span>
            </button>
          ))}
        </div>
      ) : (
        group.filter((b) => b.id !== kept).map((b) => (
          <Disdetta key={b.id} b={b} titolo={`Avvisa ${b.placeName}: così dà il tavolo a qualcun altro.`} />
        ))
      )}
    </section>
  );
}

export default function BookingReminder() {
  const [cancelling, setCancelling] = useState<string | null>(null);
  const list = useSyncExternalStore(subscribeBookings, loadBookings, () => EMPTY);
  const { today, tomorrow, howWasIt } = bookingReminders(list);
  // Doppioni del giorno stesso o di domani (non nascosti): un solo promemoria al posto di quelli singoli.
  const now = new Date();
  const todayKey = dateKey(now);
  const tomorrowD = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const tomorrowKey = dateKey(tomorrowD);
  const doppi = doubleBookings(list, now)
    .filter((g) => g[0].date === todayKey || (g[0].date === tomorrowKey && g.some((b) => !b.dismissedEve)))
    .map((g) => ({ group: g, domani: g[0].date === tomorrowKey }));
  const inDoppi = new Set(doppi.flatMap((d) => d.group.map((b) => b.id)));
  if (today.length === 0 && tomorrow.length === 0 && howWasIt.length === 0 && doppi.length === 0) return null;
  const prossime = [...today.map((b) => ({ b, domani: false })), ...tomorrow.map((b) => ({ b, domani: true }))].filter(({ b }) => !inDoppi.has(b.id));
  return (
    <div data-testid="promemoria-prenotazioni" className="mb-4 flex flex-col gap-2 text-left">
      {doppi.map(({ group, domani }) => (
        <Doppio key={group.map((b) => b.id).join()} group={group} domani={domani} />
      ))}
      {prossime.map(({ b, domani }) => (
        <section key={b.id} data-testid={domani ? "promemoria-domani" : "promemoria-oggi"} className="rounded-card bg-brand p-4 text-white shadow-card">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs font-display font-semibold uppercase tracking-wide text-accent">
                <CalendarCheck size={14} /> {domani ? "Domani" : "Oggi"}{b.time ? ` alle ${b.time}` : ""}
              </p>
              <p className="mt-1 truncate font-title text-lg font-semibold leading-tight">{b.placeName}</p>
              <p className="mt-0.5 text-sm font-sans text-white/80">
                {b.people ? `${b.people} ${b.people === 1 ? "persona" : "persone"} · ` : ""}{VIA[b.via]}
              </p>
            </div>
            <button type="button" aria-label="Nascondi il promemoria" onClick={() => updateBooking(b.id, domani ? { dismissedEve: true } : { dismissed: true })} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80">
              <X size={16} />
            </button>
          </div>
          <p className="mt-2 text-xs font-sans text-white/70">
            {domani ? "Se non puoi più andare, avvisa il locale: libera il tavolo per qualcun altro." : "La conferma arriva dal locale: controlla WhatsApp, i messaggi o le chiamate."}{" "}
            <Link href="/prenotazioni" data-testid="promemoria-tutte" className="font-semibold text-white underline underline-offset-2">Le mie prenotazioni</Link>
          </p>
          <div className="mt-3 flex gap-2">
            {!domani && b.lat != null && b.lng != null && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track("percorso", { id: b.placeId, lat: b.lat!, lng: b.lng! }, { fonte: "promemoria" })}
                className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-pill bg-accent px-3 text-sm font-display font-semibold text-white"
              >
                <Navigation size={15} /> Percorso
              </a>
            )}
            <button
              type="button"
              data-testid="promemoria-non-vado"
              aria-expanded={cancelling === b.id}
              onClick={() => setCancelling(cancelling === b.id ? null : b.id)}
              className="min-h-10 rounded-pill border border-white/30 px-3 text-sm font-display font-semibold text-white"
            >
              Non vado più
            </button>
          </div>
          {cancelling === b.id && <Disdetta b={b} />}
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
                  if (outcome !== "non-andato") track("ci_sono_stato", { id: b.placeId }, { fonte: "prenota", stato: outcome });
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
