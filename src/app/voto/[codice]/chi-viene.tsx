"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle, Minus, Phone, Plus, X } from "lucide-react";
import { loadBookings, telHref, whatsappNumber } from "@/lib/booking";
import { trackFeature } from "@/lib/track";
import { PERSONE_MAX, PERSONE_MIN, daAvvisare, giornoRoma, messaggioNumero, quandoTavolo, type VotoPosto, type VotoStato } from "@/lib/voto-gruppo";
import { chiHaVotato } from "./chi-ha-votato";

// "Chi viene?" (proposta 94): dopo il voto, il link diventa la conferma. Chi ha proposto dice quando e per
// quanti ha prenotato; tutti rispondono "Ci sono / Non ci sono"; se il numero cambia, il messaggio per il
// locale è già scritto. Tutto sulla stessa pagina del voto, senza account per chi risponde.

const btnBase = "flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-pill px-4 font-display text-[15px] font-semibold active:scale-[0.98] disabled:opacity-60";

/** Il modulo di chi organizza: giorno, ora, persone. Precompilato dalla prenotazione fatta con Mapetite. */
export function FissaTavolo({ stato, posto, onFatto, onAnnulla }: { stato: VotoStato; posto: VotoPosto; onFatto: (s: VotoStato) => void; onAnnulla?: () => void }) {
  const oggi = giornoRoma(new Date());
  const domani = giornoRoma(new Date(), 1);
  const prima = (() => {
    if (stato.tavolo) {
      const d = new Date(stato.tavolo.alle);
      const ora = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
      return { giorno: giornoRoma(d), ora, persone: stato.tavolo.persone };
    }
    try {
      const b = loadBookings().filter((x) => (x.placeId === posto.gid || x.placeId === posto.id) && x.date && x.time && x.date >= oggi).sort((a, z) => z.createdAt - a.createdAt)[0];
      if (b) return { giorno: b.date!, ora: b.time!, persone: Math.min(PERSONE_MAX, Math.max(PERSONE_MIN, b.people ?? 2)) };
    } catch { /* storage non disponibile */ }
    const votanti = new Set(stato.voti.map((v) => v.nome)).size;
    return { giorno: oggi, ora: "20:30", persone: Math.min(PERSONE_MAX, Math.max(PERSONE_MIN, votanti)) };
  })();
  const [giorno, setGiorno] = useState(prima.giorno);
  const [ora, setOra] = useState(prima.ora);
  const [persone, setPersone] = useState(prima.persone);
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const altro = giorno !== oggi && giorno !== domani;

  const salva = async () => {
    if (invio) return;
    setErrore(null);
    setInvio(true);
    try {
      const res = await fetch(`/api/voto/${stato.codice}/tavolo`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ posto: posto.id, giorno, ora, persone }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.tavolo) { setErrore(typeof data?.error === "string" ? data.error : "Non sono riuscito a salvarlo. Riprova."); return; }
      trackFeature("chi_viene", { stato: stato.tavolo ? "cambiato" : "fissato", risultati: persone });
      onFatto(data as VotoStato);
    } catch {
      setErrore("Sei offline? Riprova tra poco.");
    } finally {
      setInvio(false);
    }
  };

  const chip = (sel: boolean) => `flex min-h-11 items-center justify-center rounded-pill px-4 font-display text-sm font-semibold ${sel ? "bg-brand text-white" : "border border-border bg-bg text-text"}`;
  return (
    <section data-testid="chi-viene-modulo" className="rounded-card bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-[15px] font-semibold text-text">{stato.tavolo ? "Cambia il tavolo" : "Quando avete il tavolo?"}</p>
          <p className="text-[13px] font-sans text-text-muted">Lo chiedo io al gruppo: chi c&apos;è risponde dal link.</p>
        </div>
        {onAnnulla && (
          <button type="button" onClick={onAnnulla} aria-label="Chiudi" className="-mr-1 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-text-muted">
            <X size={18} />
          </button>
        )}
      </div>
      <div role="radiogroup" aria-label="Giorno" className="mt-3 flex flex-wrap gap-2">
        <button type="button" role="radio" aria-checked={giorno === oggi} data-testid="chi-viene-oggi" onClick={() => setGiorno(oggi)} className={chip(giorno === oggi)}>Oggi</button>
        <button type="button" role="radio" aria-checked={giorno === domani} data-testid="chi-viene-domani" onClick={() => setGiorno(domani)} className={chip(giorno === domani)}>Domani</button>
        <label className={`${chip(altro)} relative cursor-pointer`}>
          <span>{altro ? quandoTavolo(`${giorno}T12:00:00Z`).replace(/ alle .*/, "") : "Altro giorno"}</span>
          <input
            type="date"
            data-testid="chi-viene-data"
            aria-label="Altro giorno"
            min={oggi}
            value={giorno}
            onChange={(e) => { if (e.target.value) setGiorno(e.target.value); }}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <label className="flex min-h-12 flex-1 items-center gap-2 rounded-pill border border-border bg-bg px-4">
          <span className="text-[13px] font-sans text-text-muted">Alle</span>
          <input type="time" data-testid="chi-viene-ora" value={ora} onChange={(e) => setOra(e.target.value)} className="min-w-0 flex-1 bg-transparent font-display text-[16px] font-semibold text-text outline-none" />
        </label>
        <div className="flex min-h-12 items-center gap-1 rounded-pill border border-border bg-bg px-1.5" role="group" aria-label="Persone">
          <button type="button" aria-label="Una persona in meno" data-testid="chi-viene-meno" disabled={persone <= PERSONE_MIN} onClick={() => setPersone((n) => Math.max(PERSONE_MIN, n - 1))} className="flex h-10 w-10 items-center justify-center rounded-full text-brand disabled:opacity-40"><Minus size={16} /></button>
          <span data-testid="chi-viene-persone" className="min-w-[4.5rem] text-center font-display text-[15px] font-semibold text-text">{persone} persone</span>
          <button type="button" aria-label="Una persona in più" data-testid="chi-viene-piu" disabled={persone >= PERSONE_MAX} onClick={() => setPersone((n) => Math.min(PERSONE_MAX, n + 1))} className="flex h-10 w-10 items-center justify-center rounded-full text-brand disabled:opacity-40"><Plus size={16} /></button>
        </div>
      </div>
      {errore && <p role="alert" data-testid="chi-viene-errore" className="mt-2 text-sm font-sans text-error">{errore}</p>}
      <button type="button" data-testid="chi-viene-salva" disabled={invio || !ora} onClick={() => void salva()} className={`${btnBase} mt-3 w-full bg-brand text-white`}>
        {invio ? "…" : stato.tavolo ? "Salva" : "Chiedi chi viene"}
      </button>
    </section>
  );
}

/** "Ci sei?": la domanda per tutti, con il conto di chi ha risposto. */
export function CiSei({ stato, nome, onNome, onStato, campoNome }: { stato: VotoStato; nome: string; onNome: (n: string) => void; onStato: (s: VotoStato) => void; campoNome: React.ReactNode }) {
  const [invio, setInvio] = useState<boolean | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const si = stato.presenze.filter((p) => p.ciSono).map((p) => p.nome);
  const no = stato.presenze.filter((p) => !p.ciSono).length;

  const rispondi = async (ciSono: boolean) => {
    if (invio != null) return;
    const n = nome.replace(/\s+/g, " ").trim();
    if (!n) { setErrore("Prima scrivi il tuo nome."); document.getElementById("voto-nome")?.focus(); return; }
    setErrore(null);
    setInvio(ciSono);
    try {
      const res = await fetch(`/api/voto/${stato.codice}/presenza`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome: n, ciSono }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErrore(typeof data?.error === "string" ? data.error : "Non sono riuscito a salvare la risposta. Riprova."); return; }
      onNome(n);
      if (data?.posti) onStato(data as VotoStato);
      trackFeature("chi_viene", { stato: ciSono ? "ci_sono" : "non_ci_sono", contesto: stato.sonoIo ? "organizza" : "invitato" });
    } catch {
      setErrore("Sei offline? Riprova tra poco.");
    } finally {
      setInvio(null);
    }
  };

  const mia = stato.miaPresenza;
  return (
    <section data-testid="ci-sei" className="rounded-card bg-bg p-4 shadow-card">
      <p className="font-title text-xl font-semibold leading-tight text-text">{mia === true ? "Ci sei" : mia === false ? "Non ci sei" : "Ci sei?"}</p>
      <p className="mt-0.5 text-[13px] font-sans text-text-muted">{mia == null ? "Rispondi, così chi ha prenotato sa quanti siete." : "Puoi cambiare idea fino all'ora della cena."}</p>
      {mia == null && <div className="mt-3">{campoNome}</div>}
      <div className="mt-3 flex gap-2">
        <button type="button" data-testid="ci-sei-si" aria-pressed={mia === true} disabled={invio != null} onClick={() => void rispondi(true)} className={`${btnBase} ${mia === true ? "bg-accent text-white" : mia === false ? "border border-border bg-bg text-text" : "bg-accent text-white"}`}>
          {invio === true ? "…" : <>{mia === true && <Check size={16} aria-hidden />}Ci sono</>}
        </button>
        <button type="button" data-testid="ci-sei-no" aria-pressed={mia === false} disabled={invio != null} onClick={() => void rispondi(false)} className={`${btnBase} ${mia === false ? "bg-brand text-white" : "border border-border bg-bg text-text"}`}>
          {invio === false ? "…" : <>{mia === false && <Check size={16} aria-hidden />}Non ci sono</>}
        </button>
      </div>
      {errore && <p role="alert" data-testid="ci-sei-errore" className="mt-2 text-sm font-sans text-error">{errore}</p>}
      <p data-testid="ci-sei-conto" className="mt-3 text-[13px] font-sans text-text">
        {si.length === 0 && no === 0 ? (
          <span className="text-text-muted">Ancora nessuna risposta</span>
        ) : (
          <>
            <span className="font-semibold text-brand">{si.length === 1 ? "1 c'è" : `${si.length} ci sono`}</span>
            {no > 0 && <> · {no === 1 ? "1 no" : `${no} no`}</>}
          </>
        )}
        {stato.sonoIo && stato.senzaRisposta > 0 && <> · {stato.senzaRisposta === 1 ? "1 senza risposta" : `${stato.senzaRisposta} senza risposta`}</>}
      </p>
      {si.length > 0 && <p data-testid="ci-sei-chi" title={si.join(", ")} className="truncate text-[12px] font-sans text-text-muted">{chiHaVotato(si)}</p>}
    </section>
  );
}

/** Per chi organizza: il numero è cambiato, il messaggio per il locale è già scritto. */
export function AvvisaLocale({ stato, posto, telefono, nome, onStato }: { stato: VotoStato; posto: VotoPosto; telefono: string | null; nome: string; onStato: (s: VotoStato) => void }) {
  const [copiato, setCopiato] = useState(false);
  const nuovo = daAvvisare(stato);
  if (!stato.tavolo || nuovo == null) return null;
  const t = stato.tavolo;
  const testo = messaggioNumero(t.persone, nuovo, quandoTavolo(t.alle), nome || null);
  const wa = whatsappNumber(telefono);
  // Avvisato il locale, il tavolo ora è per il numero nuovo (così l'avviso non torna).
  const fatto = async (via: string) => {
    trackFeature("chi_viene", { stato: "avvisato", contesto: via, risultati: nuovo });
    const d = new Date(t.alle);
    const ora = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
    if (nuovo < PERSONE_MIN) return;
    try {
      const res = await fetch(`/api/voto/${stato.codice}/tavolo`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ posto: t.posto, giorno: giornoRoma(d), ora, persone: nuovo }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.posti) onStato(data as VotoStato);
    } catch { /* resta l'avviso: si può riprovare */ }
  };
  const btn = "flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-pill bg-white px-3 font-display text-sm font-semibold text-brand";
  return (
    <section data-testid="avvisa-locale" className="rounded-card bg-brand p-4 text-white shadow-card">
      <p className="font-display text-[15px] font-semibold">Avvisa {posto.nome}: siete in {nuovo}</p>
      <p data-testid="avvisa-locale-testo" className="mt-1.5 text-sm font-sans italic text-white/90">“{testo}”</p>
      <div className="mt-3 flex gap-2">
        {wa ? (
          <a href={`https://wa.me/${wa}?text=${encodeURIComponent(testo)}`} target="_blank" rel="noopener noreferrer" data-testid="avvisa-whatsapp" onClick={() => void fatto("whatsapp")} className={btn}><MessageCircle size={15} aria-hidden /> WhatsApp</a>
        ) : telefono ? (
          <a href={telHref(telefono)} data-testid="avvisa-chiama" onClick={() => void fatto("telefono")} className={btn}><Phone size={15} aria-hidden /> Chiama</a>
        ) : (
          <button type="button" data-testid="avvisa-copia" onClick={async () => { try { await navigator.clipboard.writeText(testo); setCopiato(true); } catch { /* resta da leggere */ } void fatto("copiato"); }} className={btn}>
            <Copy size={15} aria-hidden /> {copiato ? "Copiato" : "Copia il messaggio"}
          </button>
        )}
      </div>
    </section>
  );
}
