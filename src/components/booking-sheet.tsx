"use client";

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X, Phone, Globe, Copy, Check, Minus, Plus, MessageCircle } from "lucide-react";
import {
  addBooking,
  bookingMessage,
  dateKey,
  dayLabel,
  missingDetails,
  telHref,
  whatsappNumber,
  type BookingDetails,
  type BookingRequest,
} from "@/lib/booking";
import { track } from "@/lib/track";
import UtileFeedback from "@/components/utile-feedback";

// Foglio "Prenota" (piano 1.3): riepilogo modificabile e le vie che QUEL locale offre davvero
// (WhatsApp solo se il numero è un cellulare, chiamata, sito), con il messaggio già scritto.
// Mapetite non vede i tavoli liberi: lo si dice sempre, la conferma arriva dal locale.

export type BookingPlace = {
  id: string;
  name: string;
  phone: string | null;
  websiteUri: string | null;
  openNow: boolean | null;
  lat: number | null;
  lng: number | null;
};

const NAME_KEY = "mapetite.nome";
const TIMES = ["12:30", "13:00", "19:30", "20:00", "20:30", "21:00", "21:30"];
const SHORT_DAYS = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];

function readName(): string {
  try { return window.localStorage.getItem(NAME_KEY) ?? ""; } catch { return ""; }
}
function rememberName(name: string) {
  try { window.localStorage.setItem(NAME_KEY, name.trim().slice(0, 40)); } catch { /* storage non disponibile */ }
}

const subscribeNothing = () => () => {};

export default function BookingSheet({
  place,
  initial,
  onClose,
}: {
  place: BookingPlace;
  initial?: Partial<BookingDetails> | null;
  onClose: () => void;
}) {
  // Il portale serve perché la scheda del locale sta dentro pannelli con transform:
  // un fixed lì dentro si posizionerebbe rispetto al pannello, non allo schermo.
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const [details, setDetails] = useState<BookingDetails>({
    date: initial?.date ?? null,
    time: initial?.time ?? null,
    people: initial?.people ?? null,
    special: initial?.special ?? null,
  });
  const [name, setName] = useState<string>(() => (typeof window === "undefined" ? "" : readName()));
  // Messaggio modificato a mano: non si riscrive più quando cambiano giorno/ora/persone.
  const [custom, setCustom] = useState<string | null>(null);
  const [done, setDone] = useState<BookingRequest | null>(null);
  const [copied, setCopied] = useState(false);

  const message = custom ?? bookingMessage(details, name);
  const missing = missingDetails(details);
  const wa = whatsappNumber(place.phone);
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    return { key: dateKey(d), label: i === 0 ? "Oggi" : i === 1 ? "Domani" : `${SHORT_DAYS[d.getDay()]} ${d.getDate()}` };
  });
  const isToday = details.date === dateKey(today);

  const record = (via: BookingRequest["via"]) => {
    if (name.trim()) rememberName(name);
    const req = addBooking({
      ...details,
      placeId: place.id,
      placeName: place.name,
      lat: place.lat,
      lng: place.lng,
      via,
    });
    // Segnali esistenti (src/lib/track.ts): sito e chiama, con "da: prenota" per distinguerli.
    const where = place.lat != null && place.lng != null ? { id: place.id, lat: place.lat, lng: place.lng } : { id: place.id };
    if (via === "sito") track("sito", where, { fonte: "prenota" });
    else if (via === "telefono" || via === "whatsapp") track("chiama", where, { fonte: "prenota", contesto: via });
    setDone(req);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(message); setCopied(true); setTimeout(() => setCopied(false), 2500); return true; } catch { return false; }
  };

  if (!mounted) return null;
  const viaLabel = done?.via === "whatsapp" ? "su WhatsApp" : done?.via === "telefono" ? "per telefono" : done?.via === "sito" ? "dal sito" : "con il messaggio copiato";
  const disabled = missing.length > 0;
  const btn = "flex min-h-12 w-full items-center justify-center gap-2 rounded-pill px-4 text-[15px] font-display font-semibold active:scale-[0.98]";

  return createPortal(
    // Gli eventi di un portale risalgono comunque l'albero React: senza fermarli, il pannello della
    // mappa sotto (trascinabile) li prenderebbe come un trascinamento o un tocco fuori.
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape") onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Prenota da ${place.name}`}
        data-testid="foglio-prenota"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[1.5rem] bg-bg px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-float"
      >
        <div aria-hidden className="mx-auto mb-2 h-1 w-10 rounded-full bg-border" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-display font-semibold uppercase tracking-wide text-accent">Prenota</p>
            <h2 className="mt-0.5 font-title text-2xl font-semibold leading-tight text-text">{place.name}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Chiudi" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-text-muted">
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div data-testid="prenota-fatto" className="mt-4">
            <div className="rounded-card bg-brand p-5 text-white">
              <p className="flex items-center gap-2 font-display text-lg font-semibold"><Check size={20} className="text-accent" /> Prenotazione richiesta</p>
              <p className="mt-2 text-sm font-sans leading-relaxed text-white/85">
                Hai scritto a {place.name} {viaLabel}
                {done.people ? ` per ${done.people} ${done.people === 1 ? "persona" : "persone"}` : ""}
                {done.date ? `, ${dayLabel(done.date)}` : ""}
                {done.time ? ` alle ${done.time}` : ""}.
              </p>
              <p className="mt-2 text-sm font-sans font-semibold leading-relaxed text-white">
                La conferma arriva dal locale: Mapetite non vede i tavoli liberi.
              </p>
              <p className="mt-2 text-sm font-sans leading-relaxed text-white/85">
                La trovi in &ldquo;Le mie prenotazioni&rdquo;: te la ricordo il giorno stesso in home e il giorno dopo ti chiedo com&apos;è andata.
              </p>
            </div>
            {done.via === "telefono" && (
              <div className="mt-3 rounded-card bg-surface p-4">
                <p className="text-xs font-display font-semibold uppercase tracking-wide text-text-muted">Cosa dire al telefono</p>
                <p className="mt-1 text-sm font-sans leading-relaxed text-text">{message}</p>
              </div>
            )}
            <button type="button" onClick={onClose} className={`${btn} mt-4 bg-accent text-white`}>Fatto</button>
            <Link
              href="/prenotazioni"
              data-testid="prenota-vedi-prenotazioni"
              className="mt-1 flex min-h-11 items-center justify-center text-sm font-display font-semibold text-brand"
            >
              Vedi le mie prenotazioni →
            </Link>
            {/* "Ti è stato utile?" (piano 7.6): una volta per prenotazione inviata. */}
            <div className="mt-2 flex justify-center border-t border-border pt-3">
              <UtileFeedback contesto="prenota" chiave={`prenota:${done.id}`} />
            </div>
          </div>
        ) : (
          <>
            {/* Giorno */}
            <p className="mt-4 text-sm font-display font-semibold text-text">Quando</p>
            <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
              {days.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  aria-pressed={details.date === d.key}
                  onClick={() => setDetails((b) => ({ ...b, date: d.key }))}
                  className={`min-h-10 shrink-0 rounded-pill border px-3.5 text-sm font-display font-semibold ${details.date === d.key ? "border-brand bg-brand text-white" : "border-border bg-white text-brand"}`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            {/* Ora */}
            <div className="-mx-4 mt-2 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
              {TIMES.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={details.time === t}
                  onClick={() => setDetails((b) => ({ ...b, time: t }))}
                  className={`min-h-10 shrink-0 rounded-pill border px-3 text-sm font-sans font-semibold ${details.time === t ? "border-brand bg-brand text-white" : "border-border bg-white text-text"}`}
                >
                  {t}
                </button>
              ))}
              <input
                type="time"
                aria-label="Altro orario"
                value={details.time ?? ""}
                onChange={(e) => setDetails((b) => ({ ...b, time: e.target.value || null }))}
                className="min-h-10 shrink-0 rounded-pill border border-border bg-white px-3 text-base font-sans text-text"
              />
            </div>
            {/* Persone */}
            <div className="mt-3 flex items-center justify-between rounded-card bg-surface px-4 py-2">
              <p className="text-sm font-display font-semibold text-text">Persone</p>
              <div className="flex items-center gap-3">
                <button type="button" aria-label="Una persona in meno" onClick={() => setDetails((b) => ({ ...b, people: Math.max(1, (b.people ?? 2) - 1) }))} className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white text-brand">
                  <Minus size={16} />
                </button>
                <span data-testid="prenota-persone" className="min-w-6 text-center font-display text-lg font-semibold text-text">{details.people ?? "–"}</span>
                <button type="button" aria-label="Una persona in più" onClick={() => setDetails((b) => ({ ...b, people: Math.min(30, (b.people ?? 1) + 1) }))} className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white text-brand">
                  <Plus size={16} />
                </button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs font-sans text-text-muted">Richiesta (facoltativa)</span>
                <input
                  value={details.special ?? ""}
                  onChange={(e) => setDetails((b) => ({ ...b, special: e.target.value || null }))}
                  placeholder="es. in terrazza"
                  className="mt-1 min-h-11 w-full rounded-btn border border-border bg-white px-3 text-base font-sans text-text"
                />
              </label>
              <label className="block">
                <span className="text-xs font-sans text-text-muted">Il tuo nome</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="es. Giulia"
                  autoComplete="given-name"
                  className="mt-1 min-h-11 w-full rounded-btn border border-border bg-white px-3 text-base font-sans text-text"
                />
              </label>
            </div>

            {/* Messaggio già scritto, modificabile */}
            <div className="mt-4 flex min-h-8 items-center justify-between">
              <label htmlFor="prenota-messaggio" className="text-sm font-display font-semibold text-text">Il messaggio (puoi modificarlo)</label>
              {custom != null && (
                <button type="button" onClick={() => setCustom(null)} className="min-h-8 text-xs font-sans font-semibold text-accent">Rigenera</button>
              )}
            </div>
            <textarea
              id="prenota-messaggio"
              data-testid="prenota-messaggio"
              value={message}
              onChange={(e) => setCustom(e.target.value)}
              rows={4}
              className="mt-1 w-full resize-none rounded-card border border-border bg-white p-3 text-base font-sans leading-snug text-text"
            />

            {/* Onestà sulla disponibilità: solo i dati Google, mai tavoli o orari inventati. */}
            <p data-testid="prenota-onesta" className="mt-2 text-xs font-sans leading-relaxed text-text-muted">
              Mapetite non vede i tavoli liberi: la conferma arriva dal locale.
              {isToday && place.openNow != null ? ` Adesso risulta ${place.openNow ? "aperto" : "chiuso"} (dati Google).` : ""}
            </p>

            {disabled && (
              <p data-testid="prenota-manca" className="mt-3 rounded-btn bg-accent-light px-3 py-2 text-sm font-sans text-accent">
                Scegli {missing.map((m) => (m === "persone" ? "quante persone" : m === "giorno" ? "il giorno" : "l'ora")).join(", ")} per scrivere al locale.
              </p>
            )}

            <div className={`mt-3 flex flex-col gap-2 ${disabled ? "pointer-events-none opacity-40" : ""}`} aria-disabled={disabled}>
              {wa && (
                <a
                  data-testid="prenota-whatsapp"
                  href={`https://wa.me/${wa}?text=${encodeURIComponent(message)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => record("whatsapp")}
                  className={`${btn} bg-[#1f8f4e] text-white`}
                >
                  <MessageCircle size={18} /> Invia su WhatsApp
                </a>
              )}
              {place.phone && (
                <a
                  data-testid="prenota-chiama"
                  href={telHref(place.phone)}
                  onClick={() => record("telefono")}
                  className={`${btn} ${wa ? "border border-border bg-white text-brand" : "bg-brand text-white"}`}
                >
                  <Phone size={18} /> Chiama {place.phone}
                </a>
              )}
              {place.websiteUri && (
                <a
                  data-testid="prenota-sito"
                  href={place.websiteUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => { void copy(); record("sito"); }}
                  className={`${btn} border border-border bg-white text-brand`}
                >
                  <Globe size={18} /> Prenota dal sito del locale
                </a>
              )}
              <button
                type="button"
                data-testid="prenota-copia"
                onClick={async () => { if (await copy()) record("copiato"); }}
                className="flex min-h-11 items-center justify-center gap-1.5 text-sm font-display font-semibold text-accent"
              >
                <Copy size={16} /> {copied ? "Messaggio copiato" : "Copia il messaggio"}
              </button>
              {place.websiteUri && <p className="-mt-1 text-center text-xs font-sans text-text-muted">Sul sito il messaggio è già copiato: incollalo se serve.</p>}
              {!place.phone && !place.websiteUri && (
                <p className="text-center text-xs font-sans text-text-muted">Google non ha telefono né sito di questo locale: copia il messaggio e mandalo come preferisci.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
