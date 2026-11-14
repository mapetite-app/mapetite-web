"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { CalendarCheck, Navigation, X } from "lucide-react";
import {
  appenaPrenotata,
  daConfermare,
  removeBooking,
  loadBookings,
  popupPrenotazione,
  portamiLiUrl,
  prenotazioneDaRicordare,
  prenotazioneTraPoco,
  quandoTavolo,
  segnaPopupPrenotazione,
  subscribeBookings,
  subscribePopupPrenotazione,
  traQuanto,
  updateBooking,
  type BookingRequest,
} from "@/lib/booking";
import { track, trackFeature } from "@/lib/track";
import { AzioniTavolo, Disdetta } from "@/components/booking-reminder";
import { DomandaPrenotato } from "@/components/domanda-prenotato";

// Promemoria che si vedono (Lorenzo, 8/11: "gli ricordi con un banner, con un pop-up"):
// - PrenotazioneMappa: sulla mappa, il giorno stesso "Stasera alle 21:00 da…" con Portami lì e Chiama;
//   il giorno prima "Domani alle 21:00 da…". Si chiude con la X (solo sulla mappa, per quel tavolo).
// - PrenotazionePopup: aprendo l'app nelle 2 ore e mezza prima del tavolo, un foglio "Tra 2 ore da…"
//   con Portami lì e Ho disdetto. Una volta per prenotazione (ricordato nel telefono).
// Tutto dalle prenotazioni del telefono (src/lib/booking.ts): nessuna chiamata al server.

const EMPTY: BookingRequest[] = [];
const subscribeNothing = () => () => {};

function leggiLista(key: string): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(-50) : [];
  } catch {
    return [];
  }
}
function aggiungiLista(key: string, id: string) {
  try { window.localStorage.setItem(key, JSON.stringify([...leggiLista(key).filter((x) => x !== id), id].slice(-50))); } catch { /* storage non disponibile */ }
}

// L'ora cambia mentre l'app resta aperta: si ricontrolla ogni minuto e quando si torna nell'app.
function useOra(): Date | null {
  const [ora, setOra] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setOra(new Date());
    const t0 = setTimeout(tick, 0);
    const iv = setInterval(tick, 60_000);
    const onVis = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearTimeout(t0); clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
  }, []);
  return ora;
}

const NASCOSTI_MAPPA = "mapetite.prenota.mappa-nascosti";

export function PrenotazioneMappa() {
  const list = useSyncExternalStore(subscribeBookings, loadBookings, () => EMPTY);
  const ora = useOra();
  const popup = useSyncExternalStore(subscribePopupPrenotazione, popupPrenotazione, () => null);
  const [nascosti, setNascosti] = useState<string[] | null>(null);
  const [nonPiu, setNonPiu] = useState(false);
  useEffect(() => { const t = setTimeout(() => setNascosti(leggiLista(NASCOSTI_MAPPA)), 0); return () => clearTimeout(t); }, []);
  if (!ora || !nascosti) return null;
  const r = prenotazioneDaRicordare(list, ora);
  // Con il foglio "Tra 2 ore" aperto il banner dello stesso tavolo aspetta (revisore 14/11: niente doppioni).
  const tavolo = r && r.b.id !== popup && !nascosti.includes(`${r.b.id}:${r.domani ? "d" : "o"}`) ? r : null;
  // Senza un tavolo da ricordare: la richiesta ancora senza risposta, con la stessa domanda della home
  // e del foglio Prenota ("L'hai prenotato?", Sì / Non ancora; revisore 14/11).
  const chiedi = !tavolo ? daConfermare(list, ora).find((b) => !nascosti.includes(`${b.id}:c`)) ?? null : null;
  if (!tavolo && !chiedi) return null;
  const chiudiKey = (k: string) => { aggiungiLista(NASCOSTI_MAPPA, k); setNascosti([...nascosti, k]); };
  const xBtn = (k: string) => (
    <button type="button" aria-label="Nascondi il promemoria" onClick={() => chiudiKey(k)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80">
      <X size={15} />
    </button>
  );
  if (chiedi) {
    return (
      <section data-testid="mappa-prenotazione" data-tipo="chiedi" className="pointer-events-auto rounded-card bg-brand p-3 text-white shadow-float">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <DomandaPrenotato
              b={chiedi}
              now={ora}
              scuro
              ids={{ si: "mappa-hai-prenotato-si", nonAncora: "mappa-hai-prenotato-non-ancora" }}
              onSi={() => { updateBooking(chiedi.id, { confirmed: true }); trackFeature("prenotazione_segnata", { contesto: chiedi.piattaforma ?? chiedi.via, fonte: "mappa" }); }}
              onNonAncora={() => { updateBooking(chiedi.id, { nonAncora: Date.now() }); trackFeature("prenotazione_segnata", { stato: "non_ancora", fonte: "mappa" }); }}
              altro={[{ label: "No, non prenoto: toglila", testid: "mappa-hai-prenotato-no", onClick: () => { removeBooking(chiedi.id); trackFeature("prenotazione_segnata", { stato: "no", fonte: "mappa" }); } }]}
            />
          </div>
          {xBtn(`${chiedi.id}:c`)}
        </div>
      </section>
    );
  }
  const { b, domani } = tavolo!;
  const k = `${b.id}:${domani ? "d" : "o"}`;
  // Il giorno prima: la stessa domanda della home, "…: ci vai?" con Sì, ci vado / Non più.
  // "Ci vai?" non subito dopo aver prenotato (revisore 14/11): da 12 ore dopo.
  const chiediVai = domani && !b.ciVado && !appenaPrenotata(b, ora);
  return (
    <section data-testid="mappa-prenotazione" className="pointer-events-auto rounded-card bg-brand p-3 text-white shadow-float">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-display font-semibold uppercase tracking-wide text-accent">
            {/* Il giorno sta già nel titolo ("Stasera alle 21:00 da…"): sopra solo "Il tuo tavolo" e le persone. */}
            <CalendarCheck size={13} /> Il tuo tavolo{b.people ? ` · ${b.people} ${b.people === 1 ? "persona" : "persone"}` : ""}
          </p>
          <p data-testid="mappa-prenotazione-titolo" className="mt-0.5 font-title text-base font-semibold leading-tight">
            {quandoTavolo(b, ora)} da {b.placeName}{chiediVai ? <span className="whitespace-pre">: ci vai?</span> : null}
          </p>
        </div>
        {xBtn(k)}
      </div>
      {domani ? (
        chiediVai && (nonPiu ? (
          <>
            <Disdetta b={b} />
            <button type="button" onClick={() => setNonPiu(false)} className="mt-1 min-h-10 text-sm font-display font-semibold text-white/80 underline underline-offset-2">
              Indietro
            </button>
          </>
        ) : (
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              data-testid="mappa-ci-vado"
              onClick={() => { updateBooking(b.id, { ciVado: Date.now() }); trackFeature("ci_vai_domani", { stato: "si", fonte: "mappa" }); chiudiKey(k); }}
              className="min-h-10 flex-1 rounded-pill bg-white px-3 text-sm font-display font-semibold text-brand active:scale-95"
            >
              Sì, ci vado
            </button>
            <button
              type="button"
              data-testid="mappa-non-piu"
              onClick={() => { setNonPiu(true); trackFeature("ci_vai_domani", { stato: "non_piu", fonte: "mappa" }); }}
              className="min-h-10 flex-1 rounded-pill border border-white/30 px-3 text-sm font-display font-semibold text-white active:scale-95"
            >
              Non più
            </button>
          </div>
        ))
      ) : (
        <AzioniTavolo b={b} fonte="mappa" />
      )}
    </section>
  );
}

const POPUP_KEY = "mapetite.prenota.popup";
// Pagine dei ristoratori e del pannello numeri: lì il foglio non c'entra.
const SENZA_POPUP = /^\/(?:ristoratore|per-i-ristoratori|numeri|admin|accedi|auth)/;

export function PrenotazionePopup() {
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const list = useSyncExternalStore(subscribeBookings, loadBookings, () => EMPTY);
  const ora = useOra();
  const pathname = usePathname() ?? "/";
  const [chiuso, setChiuso] = useState<string | null>(null);
  const [mostrate, setMostrate] = useState<string[] | null>(null);
  useEffect(() => { const t = setTimeout(() => setMostrate(leggiLista(POPUP_KEY)), 0); return () => clearTimeout(t); }, []);
  const r = ora && mostrate && !SENZA_POPUP.test(pathname) ? prenotazioneTraPoco(list, ora, chiuso ? [...mostrate, chiuso] : mostrate) : null;
  // Mostrato = ricordato subito: anche ricaricando non torna.
  useEffect(() => { if (r) aggiungiLista(POPUP_KEY, r.b.id); }, [r?.b.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Aperto: il banner dello stesso tavolo (home, mappa) si nasconde finché il foglio c'è.
  const aperto = mounted && r ? r.b.id : null;
  useEffect(() => { segnaPopupPrenotazione(aperto); }, [aperto]);
  useEffect(() => () => segnaPopupPrenotazione(null), []);
  if (!mounted || !r) return null;
  const { b, minuti } = r;
  const dir = portamiLiUrl(b);
  const chiudi = () => setChiuso(b.id);
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40" onClick={chiudi}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Tra poco da ${b.placeName}`}
        data-testid="popup-prenotazione"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-t-[1.5rem] bg-bg px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-float"
      >
        <div aria-hidden className="mx-auto mb-2 h-1 w-10 rounded-full bg-border" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-display font-semibold uppercase tracking-wide text-accent"><CalendarCheck size={14} /> Il tuo tavolo</p>
            <h2 data-testid="popup-prenotazione-titolo" className="mt-0.5 font-title text-2xl font-semibold leading-tight text-text">{traQuanto(minuti)} da {b.placeName}</h2>
            <p className="mt-1 text-sm font-sans text-text-muted">
              Alle {b.time}{b.people ? ` · ${b.people} ${b.people === 1 ? "persona" : "persone"}` : ""}{b.confirmed ? " · prenotato" : ""}
            </p>
          </div>
          <button type="button" onClick={chiudi} aria-label="Chiudi" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-text-muted">
            <X size={18} />
          </button>
        </div>
        {dir && (
          <a
            href={dir}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="popup-portami-li"
            onClick={() => { track("percorso", { id: b.placeId, ...(b.lat != null && b.lng != null ? { lat: b.lat, lng: b.lng } : {}) }, { fonte: "popup_prenotazione" }); chiudi(); }}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-pill bg-accent px-4 text-[15px] font-display font-semibold text-white active:scale-[0.98]"
          >
            <Navigation size={18} /> Portami lì
          </a>
        )}
        <button
          type="button"
          data-testid="popup-ho-disdetto"
          onClick={() => {
            updateBooking(b.id, { outcome: "non-andato", dismissed: true, disdetta: Date.now() });
            trackFeature("prenotazione_disdetta", { contesto: "popup" });
            chiudi();
          }}
          className="mt-2 flex min-h-12 w-full items-center justify-center rounded-pill border border-border bg-white px-4 text-[15px] font-display font-semibold text-brand active:scale-[0.98]"
        >
          Ho disdetto
        </button>
      </div>
    </div>,
    document.body,
  );
}
