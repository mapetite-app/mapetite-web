"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X, Phone, Globe, Copy, Check, Minus, Plus, MessageCircle } from "lucide-react";
import {
  addBooking,
  bookingMessage,
  clienteDiParola,
  dateKey,
  dayLabel,
  lastBookingFor,
  loadBookings,
  missingDetails,
  subscribeBookings,
  telHref,
  whatsappNumber,
  type BookingDetails,
  type BookingRequest,
} from "@/lib/booking";
import { track, trackFeature } from "@/lib/track";
import { apertoIl, dataOra, prossimaApertura, prossimaAperturaData, type Orari } from "@/lib/orari";
import UtileFeedback from "@/components/utile-feedback";
import { browserClient } from "@/lib/supabase/client-lazy";
import { POSTO_FISSO, visiteDi } from "@/lib/diario";
import type { Canale } from "@/lib/canale-prenotazione";

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
  orari?: Orari | null; // orari Google della ricerca, se ci sono: "a quell'ora risulta chiuso"
};

// Altri locali della stessa ricerca (proposta CEO 20/10): se a quell'ora questo è chiuso, si propongono
// quelli aperti, con il loro verdetto. Il tocco apre il loro foglio Prenota con gli stessi dati.
export type BookingAlternative = { id: string; name: string; verdict: string | null; orari: Orari | null };

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
  alternative = [],
  onAlternative,
}: {
  place: BookingPlace;
  initial?: Partial<BookingDetails> | null;
  onClose: () => void;
  alternative?: BookingAlternative[];
  onAlternative?: (id: string, details: BookingDetails) => void;
}) {
  // Il portale serve perché la scheda del locale sta dentro pannelli con transform:
  // un fixed lì dentro si posizionerebbe rispetto al pannello, non allo schermo.
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
  // "Come l'ultima volta" (PROPOSTE.md 10): se non arrivano né persone né ora, si riparte da quelle
  // dell'ultima richiesta a questo locale. Il giorno si sceglie sempre.
  const [ultima] = useState(() => (typeof window === "undefined" || initial?.people != null || initial?.time != null ? null : lastBookingFor(loadBookings(), place.id)));
  const [details, setDetails] = useState<BookingDetails>({
    date: initial?.date ?? null,
    time: initial?.time ?? ultima?.time ?? null,
    people: initial?.people ?? ultima?.people ?? null,
    special: initial?.special ?? null,
  });
  const [name, setName] = useState<string>(() => (typeof window === "undefined" ? "" : readName()));
  // Messaggio modificato a mano: non si riscrive più quando cambiano giorno/ora/persone.
  const [custom, setCustom] = useState<string | null>(null);
  const [done, setDone] = useState<BookingRequest | null>(null);
  // Modulo di prenotazione del locale (TheFork, Quandoo…) trovato sul suo sito: un tocco e ci sei.
  const [canale, setCanale] = useState<{ sito: string; canale: Canale | null } | null>(null);
  useEffect(() => {
    const sito = place.websiteUri;
    if (!sito) return;
    const ctrl = new AbortController();
    fetch(`/api/prenota/canale?u=${encodeURIComponent(sito)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setCanale({ sito, canale: j?.canale && typeof j.canale.url === "string" ? j.canale : null }))
      .catch(() => { /* senza rete resta "Prenota dal sito" */ });
    return () => ctrl.abort();
  }, [place.websiteUri]);
  const modulo = canale && canale.sito === place.websiteUri ? canale.canale : null;
  const [copied, setCopied] = useState(false);
  // Due passi chiari: 1) quando e quanti, 2) messaggio e invio. Con i dati già completi
  // (dalla conversazione o dalla scheda) si parte dal passo 2: un tocco e si scrive al locale.
  const [step, setStep] = useState<1 | 2>(() => (missingDetails({ date: initial?.date ?? null, time: initial?.time ?? null, people: initial?.people ?? null, special: null }).length === 0 ? 2 : 1));

  // "Sarà la mia 3ª volta da voi" (PROPOSTE.md 11): solo nei posti fissi (2+ visite segnate), spento
  // finché l'utente non lo accende. La lettura passa dalla RLS: si vedono solo i propri salvati.
  const [visite, setVisite] = useState(0);
  const [dicoVolta, setDicoVolta] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      const db = await browserClient().catch(() => null);
      if (!db) return;
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(place.id);
      const q = db.from("saved_places").select("visite, tags, places!inner(google_place_id)");
      const { data, error } = await (uuid ? q.eq("place_id", place.id) : q.eq("places.google_place_id", place.id)).limit(1);
      const row = !error ? (data?.[0] as { visite?: unknown; tags?: string[] | null } | undefined) : undefined;
      if (alive && row) setVisite(visiteDi(row.tags, row.visite));
    })();
    return () => { alive = false; };
  }, [place.id]);
  const volta = visite >= POSTO_FISSO ? visite + 1 : null;
  // "Cliente di parola" (PROPOSTE.md 3): dalle prenotazioni di questo telefono, spento finché l'utente non lo accende.
  const parola = useSyncExternalStore(subscribeBookings, () => clienteDiParola(loadBookings()), () => null);
  const [dicoParola, setDicoParola] = useState(false);
  const message = custom ?? bookingMessage(details, name, undefined, dicoVolta ? volta : null, dicoParola ? parola : null);
  const missing = missingDetails(details);
  const wa = whatsappNumber(place.phone);
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    return { key: dateKey(d), label: i === 0 ? "Oggi" : i === 1 ? "Domani" : `${SHORT_DAYS[d.getDay()]} ${d.getDate()}` };
  });
  const isToday = details.date === dateKey(today);
  // Orari Google (se la ricerca li ha dati): un orario in cui il locale risulta chiuso si segnala, senza
  // bloccare l'invio (gli orari di Google a volte sbagliano). Riapertura: per chi scrive a locale chiuso.
  const chiusoAlle = (t: string) => (details.date ? apertoIl(place.orari, dataOra(details.date, t) ?? today) === false : false);
  const chiusoScelto = details.time ? chiusoAlle(details.time) : false;
  const riapre = place.openNow === false ? prossimaApertura(place.orari, today) : null;
  const quando = details.date && details.time ? dataOra(details.date, details.time) : null;
  const aperti = chiusoScelto && quando && onAlternative ? alternative.filter((a) => a.id !== place.id && apertoIl(a.orari, quando) === true).slice(0, 2) : [];

  const record = (via: BookingRequest["via"], piattaforma: string | null = null) => {
    if (name.trim()) rememberName(name);
    const req = addBooking({
      ...details,
      placeId: place.id,
      placeName: place.name,
      lat: place.lat,
      lng: place.lng,
      via,
      phone: place.phone ?? null,
      piattaforma,
      // Locale chiuso adesso (dati Google): alla riapertura il promemoria chiede se hanno risposto.
      riapre: place.openNow === false && (via === "whatsapp" || via === "copiato") ? prossimaAperturaData(place.orari, new Date())?.getTime() ?? null : null,
    });
    // Segnali esistenti (src/lib/track.ts): sito e chiama, con "da: prenota" per distinguerli.
    const where = place.lat != null && place.lng != null ? { id: place.id, lat: place.lat, lng: place.lng } : { id: place.id };
    if (via === "sito") track("sito", where, { fonte: "prenota", ...(piattaforma ? { contesto: piattaforma } : {}) });
    else if (via === "telefono" || via === "whatsapp") track("chiama", where, { fonte: "prenota", contesto: via });
    setDone(req);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(message); setCopied(true); setTimeout(() => setCopied(false), 2500); return true; } catch { return false; }
  };

  if (!mounted) return null;
  const viaLabel = done?.via === "whatsapp" ? "su WhatsApp" : done?.via === "telefono" ? "per telefono" : done?.via === "sito" ? (done.piattaforma ? `su ${done.piattaforma}` : "dal sito") : "con il messaggio copiato";
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
        ) : step === 1 ? (
          <>
            <p data-testid="prenota-passo" className="mt-1 text-xs font-sans text-text-muted">Passo 1 di 2 · quando e quanti</p>
            {ultima && (
              <p data-testid="prenota-come-ultima" className="mt-2 text-sm font-sans font-semibold text-accent">
                ↻ Come l&apos;ultima volta{ultima.people ? `: ${ultima.people} ${ultima.people === 1 ? "persona" : "persone"}` : ""}{ultima.time ? `${ultima.people ? "" : ":"} alle ${ultima.time}` : ""}
              </p>
            )}
            {/* Giorno */}
            <p className="mt-3 text-sm font-display font-semibold text-text">Quando</p>
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
                  className={`min-h-11 shrink-0 rounded-pill border px-3 text-sm font-sans font-semibold ${details.time === t ? "border-brand bg-brand text-white" : chiusoAlle(t) ? "border-border bg-white text-text-muted line-through decoration-1" : "border-border bg-white text-text"}`}
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
            {chiusoScelto && (
              <p data-testid="prenota-chiuso" className="mt-2 text-xs font-sans font-semibold text-error">A quell&apos;ora risulta chiuso (orari Google): meglio un altro orario.</p>
            )}
            {aperti.length > 0 && (
              <div data-testid="prenota-alternative" className="mt-2 rounded-card bg-surface p-3">
                <p className="text-xs font-display font-semibold text-text">Aperti a quell&apos;ora, dalla tua ricerca:</p>
                {aperti.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => { trackFeature("prenota_alternativa"); onAlternative?.(a.id, details); }}
                    className="mt-2 flex min-h-12 w-full items-center justify-between gap-2 rounded-btn border border-border bg-white px-3 text-left active:scale-[0.99]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-display font-semibold text-brand">{a.name}</span>
                      {a.verdict && <span className="block truncate text-xs font-sans text-text-muted"><span aria-hidden className="text-accent">✦ </span>{a.verdict}</span>}
                    </span>
                    <span className="shrink-0 text-xs font-display font-semibold text-accent">Prenota lì</span>
                  </button>
                ))}
              </div>
            )}
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
            <label className="mt-3 block">
              <span className="text-xs font-sans text-text-muted">Richiesta (facoltativa)</span>
              <input
                value={details.special ?? ""}
                onChange={(e) => setDetails((b) => ({ ...b, special: e.target.value || null }))}
                placeholder="es. in terrazza"
                className="mt-1 min-h-11 w-full rounded-btn border border-border bg-white px-3 text-base font-sans text-text"
              />
            </label>
            {disabled && (
              <p data-testid="prenota-manca" className="mt-3 rounded-btn bg-accent-light px-3 py-2 text-sm font-sans text-accent">
                Scegli {missing.map((m) => (m === "persone" ? "quante persone" : m === "giorno" ? "il giorno" : "l'ora")).join(", ")} per scrivere al locale.
              </p>
            )}
            <button
              type="button"
              data-testid="prenota-avanti"
              disabled={disabled}
              onClick={() => setStep(2)}
              className={`${btn} mt-4 bg-accent text-white disabled:bg-border disabled:text-text-muted`}
            >
              Avanti: il messaggio
            </button>
          </>
        ) : (
          <>
            {/* Passo 2: riepilogo in una riga (tocco per cambiare), nome, messaggio, invio. */}
            <p className="mt-1 text-xs font-sans text-text-muted">Passo 2 di 2 · scrivi al locale</p>
            <button
              type="button"
              data-testid="prenota-modifica"
              onClick={() => setStep(1)}
              aria-label="Modifica giorno, ora e persone"
              className="mt-3 flex min-h-12 w-full items-center justify-between gap-2 rounded-card bg-surface px-4 text-left"
            >
              <span data-testid="prenota-riepilogo" className="min-w-0 py-2 text-[15px] font-display font-semibold leading-snug text-text">
                <span data-testid="prenota-persone">{details.people ?? "–"}</span> {details.people === 1 ? "persona" : "persone"}
                {details.date ? ` · ${dayLabel(details.date)}` : ""}{details.time ? ` · ${details.time}` : ""}
                {details.special ? ` · ${details.special}` : ""}
              </span>
              <span className="shrink-0 text-sm font-display font-semibold text-accent">Modifica</span>
            </button>
            <div className="mt-3">
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

            {volta && custom == null && (
              <label data-testid="prenota-volta" className="mt-3 flex min-h-11 items-center gap-3 text-sm font-sans text-text">
                <input type="checkbox" checked={dicoVolta} onChange={(e) => setDicoVolta(e.target.checked)} className="h-5 w-5 accent-brand" />
                Scrivi che è la tua {volta}ª volta
              </label>
            )}
            {parola && custom == null && (
              <label data-testid="prenota-parola" className="mt-2 flex min-h-11 items-center gap-3 text-sm font-sans text-text">
                <input type="checkbox" checked={dicoParola} onChange={(e) => { setDicoParola(e.target.checked); if (e.target.checked) trackFeature("cliente_di_parola", { stato: "acceso", risultati: parola }); }} className="h-5 w-5 accent-brand" />
                Scrivi che sei di parola ({parola} su {parola})
              </label>
            )}

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
              {riapre ? ` Riapre ${riapre}: la risposta arriverà probabilmente da allora.` : ""}
            </p>
            {chiusoScelto && (
              <p data-testid="prenota-chiuso-2" className="mt-1 text-xs font-sans font-semibold text-error">A quell&apos;ora risulta chiuso (orari Google): controlla l&apos;orario prima di inviare.</p>
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
              {/* Il modulo vero della piattaforma (tavoli liberi) prende il posto di "dal sito", nello stesso
                  punto: arrivando dopo non sposta i pulsanti sopra (collaudo del 30/10). */}
              {modulo && (
                <a
                  data-testid="prenota-piattaforma"
                  href={modulo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => record("sito", modulo.nome)}
                  className={`${btn} ${wa || place.phone ? "border border-brand bg-white text-brand" : "bg-brand text-white"}`}
                >
                  <Globe size={18} /> Prenota su {modulo.nome}
                </a>
              )}
              {place.websiteUri && !modulo && (
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
              {modulo ? (
                <p data-testid="prenota-piattaforma-nota" className="-mt-1 text-center text-xs font-sans text-text-muted">Su {modulo.nome} vedi i tavoli liberi e confermi lì (giorno e ora li scegli di nuovo).</p>
              ) : place.websiteUri && <p className="-mt-1 text-center text-xs font-sans text-text-muted">Sul sito il messaggio è già copiato: incollalo se serve.</p>}
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
