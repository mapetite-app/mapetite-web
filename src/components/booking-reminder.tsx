"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { CalendarCheck, Copy, MessageCircle, Navigation, Phone, X } from "lucide-react";
import { appenaPrenotata, bookingReminders, cancelMessage, daConfermare, dateKey, doubleBookings, loadBookings, popupPrenotazione, portamiLiUrl, quandoTavolo, removeBooking, subscribeBookings, subscribePopupPrenotazione, telHref, updateBooking, whatsappNumber, type BookingRequest } from "@/lib/booking";
import { track, trackFeature } from "@/lib/track";
import { dataOra } from "@/lib/orari";
import { DomandaPrenotato } from "@/components/domanda-prenotato";

// Promemoria delle prenotazioni richieste (salvate nel telefono): il giorno stesso
// "Stasera alle 21:00 da …", dal giorno dopo "Com'è andata?". In home e nel profilo.
const EMPTY: BookingRequest[] = [];

// "Portami lì" (indicazioni con la destinazione già messa) e "Chiama": le due cose che servono il giorno
// del tavolo. Le usano il promemoria in home, il banner sulla mappa e il foglio "Tra 2 ore".
export function AzioniTavolo({ b, fonte, chiaro = false }: { b: BookingRequest; fonte: string; chiaro?: boolean }) {
  const dir = portamiLiUrl(b);
  if (!dir && !b.phone) return null;
  const base = "flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-pill px-3 text-sm font-display font-semibold active:scale-[0.98]";
  return (
    <div className="mt-3 flex gap-2">
      {dir && (
        <a
          href={dir}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="portami-li"
          onClick={() => track("percorso", { id: b.placeId, ...(b.lat != null && b.lng != null ? { lat: b.lat, lng: b.lng } : {}) }, { fonte })}
          className={`${base} bg-accent text-white`}
        >
          <Navigation size={15} /> Portami lì
        </a>
      )}
      {b.phone && (
        <a
          href={telHref(b.phone)}
          data-testid="promemoria-chiama"
          onClick={() => track("chiama", { id: b.placeId, ...(b.lat != null && b.lng != null ? { lat: b.lat, lng: b.lng } : {}) }, { fonte, contesto: "telefono" })}
          className={`${base} ${chiaro ? "border border-border bg-white text-brand" : "border border-white/30 text-white"}`}
        >
          <Phone size={15} /> Chiama
        </a>
      )}
    </div>
  );
}

// "Non vado più" (contro i tavoli vuoti, docs/autonomia/POSIZIONAMENTO.md): il messaggio per il locale
// è già scritto; un tocco per mandarlo da dove era partita la richiesta. Senza numero si copia.
export function Disdetta({ b, titolo }: { b: BookingRequest; titolo?: string }) {
  const [copied, setCopied] = useState(false);
  let name = "";
  try { name = window.localStorage.getItem("mapetite.nome") ?? ""; } catch { /* storage non disponibile */ }
  const text = cancelMessage(b, name);
  const wa = whatsappNumber(b.phone);
  const done = (contesto: string) => {
    // Con il locale e le ore di anticipo: il pannello del ristoratore conta i tavoli liberati per tempo.
    const quando = b.date && b.time ? dataOra(b.date, b.time) : null;
    const ore = quando ? Math.round((quando.getTime() - Date.now()) / 3_600_000) : null;
    // Disdetta dopo l'ora del tavolo: si conta, ma non è un "tavolo liberato per tempo".
    track("funzione", { id: b.placeId, ...(b.lat != null && b.lng != null ? { lat: b.lat, lng: b.lng } : {}) }, { nome: "prenotazione_disdetta", contesto, ...(ore != null && ore >= 0 ? { ore } : {}), ...(quando && quando.getTime() < Date.now() ? { stato: "in_ritardo" } : {}) });
    updateBooking(b.id, { outcome: "non-andato", dismissed: true, disdetta: Date.now() });
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

// "Ci vai domani?" (proposta 36, PROBLEMI.md 16): il tavolo vuoto nasce quasi sempre da chi si dimentica
// di disdire. Il giorno prima una sola domanda: "Sì" chiude il promemoria (e l'avviso non parte),
// "Non più" apre la disdetta già scritta. Chi ha già risposto non vede più niente fino al giorno stesso.
function CiVaiDomani({ b, open, onNonPiu }: { b: BookingRequest; open: boolean; onNonPiu: () => void }) {
  const dettagli = b.people ? `${b.people} ${b.people === 1 ? "persona" : "persone"}` : "";
  return (
    <section data-testid="promemoria-domani" className="rounded-card bg-brand p-4 text-white shadow-card">
      <p className="flex items-center gap-1.5 text-xs font-display font-semibold uppercase tracking-wide text-accent">
        {/* Il giorno sta già nel titolo ("Domani alle 21:00 da…"): sopra solo "Il tuo tavolo" (revisore 14/11). */}
        <CalendarCheck size={14} /> Il tuo tavolo{dettagli ? ` · ${dettagli}` : ""}
      </p>
      {/* "Domani alle 21:00 da Nome" (Lorenzo, 8/11), poi la domanda. */}
      <p data-testid="ci-vai-titolo" className="mt-1 font-title text-lg font-semibold leading-tight">
        {quandoTavolo(b)} da {b.placeName}<span className="whitespace-pre">: ci vai?</span>
      </p>
      {!open ? (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            data-testid="ci-vai-si"
            onClick={() => { updateBooking(b.id, { ciVado: Date.now() }); trackFeature("ci_vai_domani", { stato: "si" }); }}
            className="min-h-11 flex-1 rounded-pill bg-white px-3 text-sm font-display font-semibold text-brand active:scale-95"
          >
            Sì, ci vado
          </button>
          <button
            type="button"
            data-testid="ci-vai-non-piu"
            aria-expanded={open}
            onClick={() => { onNonPiu(); trackFeature("ci_vai_domani", { stato: "non_piu" }); }}
            className="min-h-11 flex-1 rounded-pill border border-white/30 px-3 text-sm font-display font-semibold text-white active:scale-95"
          >
            Non più
          </button>
        </div>
      ) : (
        <>
          <Disdetta b={b} />
          <button type="button" data-testid="ci-vai-ripensato" onClick={onNonPiu} className="mt-1 min-h-11 text-sm font-display font-semibold text-white/80 underline underline-offset-2">
            Indietro
          </button>
        </>
      )}
    </section>
  );
}

export default function BookingReminder() {
  const [cancelling, setCancelling] = useState<string | null>(null);
  const list = useSyncExternalStore(subscribeBookings, loadBookings, () => EMPTY);
  const popup = useSyncExternalStore(subscribePopupPrenotazione, popupPrenotazione, () => null);
  const rem = bookingReminders(list);
  const { howWasIt, risposta } = rem;
  // Promemoria e doppioni solo per i tavoli con il sì della persona (revisore 8/11): un tocco su
  // "Prenota su TheFork" o su WhatsApp non è ancora una prenotazione.
  // Con il foglio "Tra 2 ore" aperto il banner dello stesso tavolo aspetta (revisore 14/11: niente doppioni).
  const today = rem.today.filter((b) => b.confirmed && b.id !== popup);
  // "Domani… ci vai?" non subito dopo aver prenotato (revisore 14/11): solo da 12 ore dopo.
  const now = new Date();
  const tomorrow = rem.tomorrow.filter((b) => b.confirmed && !appenaPrenotata(b, now));
  // Doppioni del giorno stesso o di domani (non nascosti): un solo promemoria al posto di quelli singoli.
  const todayKey = dateKey(now);
  const tomorrowD = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const tomorrowKey = dateKey(tomorrowD);
  const doppi = doubleBookings(list.filter((b) => b.confirmed), now)
    .filter((g) => g[0].date === todayKey || (g[0].date === tomorrowKey && g.some((b) => !b.dismissedEve)))
    .map((g) => ({ group: g, domani: g[0].date === tomorrowKey }));
  const inDoppi = new Set(doppi.flatMap((d) => d.group.map((b) => b.id)));
  // La richiesta in attesa di risposta ha già la sua scheda ("Hanno riaperto"): niente doppione.
  const inRisposta = new Set(risposta.filter((b) => !inDoppi.has(b.id)).slice(0, 1).map((b) => b.id));
  const chiedi = daConfermare(list, now).filter((b) => !inRisposta.has(b.id)).slice(0, 2);
  if (today.length === 0 && tomorrow.length === 0 && howWasIt.length === 0 && doppi.length === 0 && risposta.length === 0 && chiedi.length === 0) return null;
  const prossime = [...today.map((b) => ({ b, domani: false })), ...tomorrow.map((b) => ({ b, domani: true }))].filter(({ b }) => !inDoppi.has(b.id) && !inRisposta.has(b.id));
  return (
    <div data-testid="promemoria-prenotazioni" className="mb-4 flex flex-col gap-2 text-left">
      {/* Richiesta mandata a locale chiuso (orari Google): ora ha riaperto, ti hanno risposto?
          Stessa domanda e stesse due azioni del foglio Prenota e della mappa (revisore 14/11). */}
      {risposta.filter((b) => !inDoppi.has(b.id)).slice(0, 1).map((b) => (
        <section key={`r-${b.id}`} data-testid="promemoria-risposta" className="rounded-card border border-border bg-surface p-4 shadow-card">
          <DomandaPrenotato
            b={b}
            now={now}
            sopra="Hanno riaperto"
            ids={{ si: "risposta-confermata", nonAncora: "risposta-non-ancora" }}
            onSi={() => { updateBooking(b.id, { confirmed: true }); trackFeature("prenotazione_risposta", { stato: "confermata" }); }}
            onNonAncora={() => { updateBooking(b.id, { dismissedRisposta: true }); trackFeature("prenotazione_risposta", { stato: "non_ancora" }); }}
          />
        </section>
      ))}
      {/* Richiesta partita, senza risposta della persona: "L'hai prenotato?" al posto del promemoria. */}
      {chiedi.map((b) => (
        <section key={`c-${b.id}`} data-testid="promemoria-hai-prenotato" className="rounded-card border border-border bg-surface p-4 shadow-card">
          <DomandaPrenotato
            b={b}
            now={now}
            ids={{ si: "hai-prenotato-si", nonAncora: "hai-prenotato-non-ancora" }}
            onSi={() => { updateBooking(b.id, { confirmed: true }); trackFeature("prenotazione_segnata", { contesto: b.piattaforma ?? b.via, fonte: "promemoria" }); }}
            onNonAncora={() => { updateBooking(b.id, { nonAncora: Date.now() }); trackFeature("prenotazione_segnata", { stato: "non_ancora", fonte: "promemoria" }); }}
            altro={[{ label: "No, non prenoto: toglila", testid: "hai-prenotato-no", onClick: () => { removeBooking(b.id); trackFeature("prenotazione_segnata", { stato: "no", fonte: "promemoria" }); } }]}
          />
        </section>
      ))}
      {doppi.map(({ group, domani }) => (
        <Doppio key={group.map((b) => b.id).join()} group={group} domani={domani} />
      ))}
      {prossime.map(({ b, domani }) => (domani ? (
        <CiVaiDomani key={b.id} b={b} open={cancelling === b.id} onNonPiu={() => setCancelling(cancelling === b.id ? null : b.id)} />
      ) : (
        <section key={b.id} data-testid="promemoria-oggi" className="rounded-card bg-brand p-4 text-white shadow-card">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs font-display font-semibold uppercase tracking-wide text-accent">
                <CalendarCheck size={14} /> Il tuo tavolo{b.people ? ` · ${b.people} ${b.people === 1 ? "persona" : "persone"}` : ""}
              </p>
              {/* "Stasera alle 21:00 da Nome" (Lorenzo, 8/11): quando e dove in una riga. */}
              <p data-testid="promemoria-oggi-titolo" className="mt-1 font-title text-lg font-semibold leading-tight">
                {quandoTavolo(b, now)} da <span className="break-words">{b.placeName}</span>
              </p>
              <p className="mt-0.5 text-sm font-sans text-white/80">
                Prenotato{b.piattaforma ? ` su ${b.piattaforma}` : ""}
              </p>
            </div>
            <button type="button" aria-label="Nascondi il promemoria" onClick={() => updateBooking(b.id, { dismissed: true })} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80">
              <X size={16} />
            </button>
          </div>
          <AzioniTavolo b={b} fonte="promemoria" />
          {/* Le azioni secondarie in una riga sola: il banner resta basso. */}
          <div className="mt-1 flex items-center justify-between gap-2">
            <button
              type="button"
              data-testid="promemoria-non-vado"
              aria-expanded={cancelling === b.id}
              onClick={() => setCancelling(cancelling === b.id ? null : b.id)}
              className="min-h-10 text-sm font-display font-semibold text-white/80 underline underline-offset-2"
            >
              Non vado più
            </button>
            <Link href="/prenotazioni" data-testid="promemoria-tutte" className="flex min-h-10 items-center text-sm font-display font-semibold text-white/80 underline underline-offset-2">Le mie prenotazioni</Link>
          </div>
          {cancelling === b.id && <Disdetta b={b} />}
        </section>
      )))}
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
