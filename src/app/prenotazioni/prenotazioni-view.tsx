"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { CalendarPlus, Check, MessageCircle, Navigation, Phone, Globe, Copy, Trash2 } from "lucide-react";
import {
  bookingIcs,
  bookingStatus,
  dayLabel,
  fromKey,
  loadBookings,
  removeBooking,
  splitBookings,
  subscribeBookings,
  updateBooking,
  type BookingRequest,
  type BookingStatus,
} from "@/lib/booking";
import { track } from "@/lib/track";

// "Le mie prenotazioni" (piano 1.5b): le richieste mandate ai locali dal foglio Prenota,
// salvate nel telefono. Stato: Richiesta inviata → Confermata (lo segna l'utente: Mapetite
// non vede le risposte del locale) → Fatta, con "Com'è andata?".

const EMPTY: BookingRequest[] = [];
const subscribeNothing = () => () => {};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONTHS = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const WEEK = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];

const VIA: Record<BookingRequest["via"], { label: string; Icon: typeof Phone }> = {
  whatsapp: { label: "Inviata su WhatsApp", Icon: MessageCircle },
  telefono: { label: "Chiesta per telefono", Icon: Phone },
  sito: { label: "Chiesta dal sito del locale", Icon: Globe },
  copiato: { label: "Messaggio copiato", Icon: Copy },
};
const OUTCOMES = [
  ["bene", "👍 Mi è piaciuto"],
  ["male", "👎 Non fa per me"],
  ["non-andato", "Non ci sono andato"],
] as const;
const OUTCOME_LABEL: Record<NonNullable<BookingRequest["outcome"]>, string> = {
  bene: "👍 Ti è piaciuto",
  male: "👎 Non faceva per te",
  "non-andato": "Non ci sei andato",
};

// Segnali (src/lib/track.ts): tipi esistenti, il dettaglio in "nome" / "stato" / "fonte" (chiavi ammesse da /api/events).
function placeOf(b: BookingRequest) {
  return b.lat != null && b.lng != null ? { id: b.placeId, lat: b.lat, lng: b.lng } : { id: b.placeId };
}
function signal(nome: string, b: BookingRequest | null, props?: Record<string, string | number>) {
  track("funzione", b ? placeOf(b) : null, { ...props, nome });
}

function people(n: number | null): string | null {
  return n ? `${n} ${n === 1 ? "persona" : "persone"}` : null;
}
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function downloadIcs(b: BookingRequest) {
  const ics = bookingIcs(b);
  if (!ics) return;
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  const slug = b.placeName.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "locale";
  a.download = `prenotazione-${slug}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  signal("prenotazione_calendario", b);
}

function DateTile({ date, muted }: { date: string | null; muted?: boolean }) {
  const d = date ? fromKey(date) : null;
  return (
    <div
      aria-hidden
      className={`flex w-14 shrink-0 flex-col items-center justify-center rounded-btn py-2 ${muted ? "bg-surface text-text-muted" : "bg-brand text-white"}`}
    >
      <span className={`text-[11px] font-display font-semibold uppercase tracking-wide ${muted ? "" : "text-accent"}`}>{d ? WEEK[d.getDay()] : "—"}</span>
      <span className="font-title text-2xl font-semibold leading-none">{d ? d.getDate() : "?"}</span>
      <span className="mt-0.5 text-[11px] font-sans">{d ? MONTHS[d.getMonth()] : ""}</span>
    </div>
  );
}

// Tre passi: Richiesta inviata → Confermata → Fatta.
function Steps({ status }: { status: BookingStatus }) {
  const reached = status === "inviata" ? 0 : status === "confermata" ? 1 : 2;
  const steps = ["Richiesta inviata", "Confermata", "Fatta"];
  return (
    <ol data-testid="prenotazione-passi" aria-label="Stato della prenotazione" className="mt-3 flex items-center gap-1.5">
      {steps.map((s, i) => (
        <li key={s} aria-current={i === reached ? "step" : undefined} className="flex min-w-0 flex-1 flex-col gap-1">
          <span className={`h-1 rounded-full ${i <= reached ? (i === reached ? "bg-accent" : "bg-brand") : "bg-border"}`} />
          <span className={`truncate text-[11px] font-display ${i === reached ? "font-semibold text-text" : "text-text-muted"}`}>{s}</span>
        </li>
      ))}
    </ol>
  );
}

function RemoveButton({ b, confirmText }: { b: BookingRequest; confirmText: string }) {
  const [asking, setAsking] = useState(false);
  if (asking) {
    return (
      <div data-testid="prenotazione-togli-conferma" className="mt-3 rounded-btn bg-accent-light p-3">
        <p className="text-sm font-sans text-text">{confirmText}</p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => { signal("prenotazione_tolta", b, { stato: bookingStatus(b) }); removeBooking(b.id); }}
            className="min-h-10 flex-1 rounded-pill bg-accent px-3 text-sm font-display font-semibold text-white"
          >
            Sì, togli
          </button>
          <button type="button" onClick={() => setAsking(false)} className="min-h-10 flex-1 rounded-pill border border-border bg-white px-3 text-sm font-display font-semibold text-brand">
            No
          </button>
        </div>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setAsking(true)}
      aria-label={`Togli la prenotazione da ${b.placeName}`}
      className="flex min-h-10 items-center justify-center gap-1.5 rounded-pill px-3 text-sm font-display font-semibold text-text-muted"
    >
      <Trash2 size={15} /> Togli
    </button>
  );
}

function PlaceName({ b, className }: { b: BookingRequest; className: string }) {
  // La scheda pubblica /locali/<id> accetta solo l'id Mapetite (UUID); le prenotazioni nate
  // dalla ricerca hanno l'id Google: in quel caso il nome resta testo.
  if (UUID_RE.test(b.placeId)) {
    return <Link href={`/locali/${b.placeId}`} className={`${className} underline-offset-2 active:underline`}>{b.placeName}</Link>;
  }
  return <span className={className}>{b.placeName}</span>;
}

function UpcomingCard({ b }: { b: BookingRequest }) {
  const status = bookingStatus(b);
  const via = VIA[b.via] ?? VIA.copiato;
  const when = [b.date ? capitalize(dayLabel(b.date)) : null, b.time ? `alle ${b.time}` : null].filter(Boolean).join(" ");
  return (
    <li data-testid="prenotazione-in-arrivo" data-stato={status} className="rounded-card border border-border bg-white p-4 shadow-card">
      <div className="flex gap-3">
        <DateTile date={b.date} />
        <div className="min-w-0 flex-1">
          <PlaceName b={b} className="block truncate font-title text-lg font-semibold leading-tight text-text" />
          <p className="mt-0.5 text-sm font-sans font-semibold text-brand">{when || "Giorno da definire"}</p>
          <p className="mt-0.5 text-sm font-sans text-text-muted">{[people(b.people), b.special].filter(Boolean).join(" · ")}</p>
          <p className="mt-1 flex items-center gap-1 text-xs font-sans text-text-muted">
            <via.Icon size={12} aria-hidden /> {via.label}
          </p>
        </div>
      </div>
      <Steps status={status} />
      {status === "inviata" ? (
        <div className="mt-3">
          <button
            type="button"
            data-testid="prenotazione-conferma"
            onClick={() => { updateBooking(b.id, { confirmed: true }); signal("prenotazione_confermata", b); }}
            className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-pill bg-brand px-4 text-sm font-display font-semibold text-white active:scale-[0.98]"
          >
            <Check size={16} /> Il locale ha confermato
          </button>
          <p className="mt-1.5 text-center text-xs font-sans text-text-muted">Toccalo quando il locale ti risponde: Mapetite non vede le sue risposte.</p>
        </div>
      ) : (
        <p data-testid="prenotazione-confermata" className="mt-3 flex items-center gap-1.5 rounded-btn bg-surface px-3 py-2 text-sm font-sans text-text">
          <Check size={16} className="shrink-0 text-success" aria-hidden /> Confermata dal locale.
          <button type="button" onClick={() => updateBooking(b.id, { confirmed: false })} className="ml-auto min-h-8 shrink-0 text-xs font-display font-semibold text-text-muted">
            Non ancora
          </button>
        </p>
      )}
      <div className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2">
        {b.lat != null && b.lng != null ? (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="prenotazione-percorso"
            onClick={() => track("percorso", placeOf(b), { fonte: "prenotazioni" })}
            className="flex min-h-10 items-center justify-center gap-1.5 rounded-pill border border-border bg-white px-2 text-sm font-display font-semibold text-brand"
          >
            <Navigation size={15} /> Percorso
          </a>
        ) : <span />}
        <button
          type="button"
          data-testid="prenotazione-calendario"
          disabled={!b.date}
          onClick={() => downloadIcs(b)}
          className="flex min-h-10 items-center justify-center gap-1.5 rounded-pill border border-border bg-white px-2 text-sm font-display font-semibold text-brand disabled:opacity-40"
        >
          <CalendarPlus size={15} /> Calendario
        </button>
        <RemoveButton
          b={b}
          confirmText={b.confirmed ? "La togli da qui. Se non ci vai più, avvisa il locale." : "La togli dall'elenco. Se l'avevi già inviata, avvisa il locale."}
        />
      </div>
    </li>
  );
}

function PastCard({ b }: { b: BookingRequest }) {
  const status = bookingStatus(b);
  const when = [b.date ? capitalize(dayLabel(b.date)) : null, b.time ? `alle ${b.time}` : null, people(b.people)].filter(Boolean).join(" · ");
  return (
    <li data-testid="prenotazione-passata" data-stato={status} className="rounded-card border border-border bg-surface p-4">
      <div className="flex gap-3">
        <DateTile date={b.date} muted />
        <div className="min-w-0 flex-1">
          <PlaceName b={b} className="block truncate font-title text-lg font-semibold leading-tight text-text" />
          <p className="mt-0.5 text-sm font-sans text-text-muted">{when}</p>
          {b.outcome && (
            <p data-testid="prenotazione-esito" className="mt-1.5 inline-flex rounded-pill bg-white px-2.5 py-1 text-xs font-display font-semibold text-brand">
              {OUTCOME_LABEL[b.outcome]}
            </p>
          )}
        </div>
      </div>
      {status === "da-dire" && (
        <div data-testid="prenotazione-com-e-andata" className="mt-3">
          <p className="text-sm font-display font-semibold text-accent">Com&apos;è andata?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {OUTCOMES.map(([outcome, label]) => (
              <button
                key={outcome}
                type="button"
                onClick={() => {
                  updateBooking(b.id, { outcome });
                  signal("prenotazione_esito", b, { stato: outcome });
                  if (outcome !== "non-andato") track("ci_sono_stato", placeOf(b), { fonte: "prenotazioni", stato: outcome });
                }}
                className="min-h-10 rounded-pill border border-border bg-white px-3 text-sm font-display font-semibold text-brand active:scale-95"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mt-2 flex justify-end">
        <RemoveButton b={b} confirmText="La togli dallo storico delle prenotazioni." />
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <div data-testid="prenotazioni-vuoto" className="mt-6 rounded-card bg-brand p-6 text-center text-white shadow-float">
      <span aria-hidden className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl">🗓️</span>
      <h2 className="mt-4 font-title text-2xl font-semibold leading-tight">Nessuna prenotazione, per ora</h2>
      <p className="mx-auto mt-2 max-w-xs text-sm font-sans leading-relaxed text-white/80">
        Chiedi all&apos;assistente: trova il posto e scrive per te il messaggio al locale.
      </p>
      <p className="mx-auto mt-4 max-w-xs rounded-card bg-white/10 px-4 py-3 text-[15px] font-sans italic text-white">
        «Prenotami sabato alle 21 per 2»
      </p>
      <Link
        href="/assistente"
        data-testid="prenotazioni-vuoto-assistente"
        className="mt-5 inline-flex min-h-12 items-center justify-center rounded-pill bg-accent px-6 text-[15px] font-display font-semibold text-white active:scale-[0.98]"
      >
        Chiedi all&apos;assistente
      </Link>
    </div>
  );
}

export default function PrenotazioniView() {
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const list = useSyncExternalStore(subscribeBookings, loadBookings, () => EMPTY);
  const { upcoming, past } = splitBookings(list);

  // Apertura della pagina, una volta (la vista "pagina" la conta già track-auto).
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    const s = splitBookings(loadBookings());
    signal("prenotazioni_apri", null, { risultati: s.upcoming.length, contesto: `passate_${s.past.length}` });
  }, []);

  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-10 pt-6">
      <p className="text-xs font-display font-semibold uppercase tracking-wide text-accent">Prenotazioni</p>
      <h1 className="mt-1 font-title text-3xl font-semibold leading-tight text-text">Le mie prenotazioni</h1>
      <p className="mt-1 text-sm font-sans text-text-muted">Le richieste che hai mandato ai locali, salvate su questo telefono.</p>

      {!mounted ? (
        <div aria-hidden className="mt-6 h-40 animate-pulse rounded-card bg-surface" />
      ) : list.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <section aria-labelledby="in-arrivo" className="mt-6">
            <h2 id="in-arrivo" className="mb-3 flex items-baseline gap-2 font-title text-xl font-semibold text-brand">
              In arrivo <span className="text-sm font-sans font-normal text-text-muted">{upcoming.length}</span>
            </h2>
            {upcoming.length === 0 ? (
              <div data-testid="prenotazioni-nessuna-in-arrivo" className="rounded-card border border-dashed border-border p-4 text-sm font-sans text-text-muted">
                Niente in programma.{" "}
                <Link href="/assistente" className="font-display font-semibold text-accent">Prenota con l&apos;assistente →</Link>
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {upcoming.map((b) => <UpcomingCard key={b.id} b={b} />)}
              </ul>
            )}
          </section>

          {past.length > 0 && (
            <section aria-labelledby="passate" className="mt-8">
              <h2 id="passate" className="mb-3 flex items-baseline gap-2 font-title text-xl font-semibold text-brand">
                Passate <span className="text-sm font-sans font-normal text-text-muted">{past.length}</span>
              </h2>
              <ul className="flex flex-col gap-3">
                {past.map((b) => <PastCard key={b.id} b={b} />)}
              </ul>
            </section>
          )}

          <p className="mt-8 text-center text-xs font-sans leading-relaxed text-text-muted">
            Mapetite non vede i tavoli liberi: la conferma arriva sempre dal locale.
          </p>
          {upcoming.length > 0 && (
            <Link
              href="/assistente"
              className="mt-3 flex min-h-11 items-center justify-center rounded-pill border border-dashed border-brand/40 px-4 text-sm font-display font-semibold text-brand"
            >
              + Nuova prenotazione con l&apos;assistente
            </Link>
          )}
        </>
      )}
    </main>
  );
}
