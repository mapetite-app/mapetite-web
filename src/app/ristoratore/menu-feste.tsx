"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { FESTE_PREZZO_MAX, GIORNI_FESTE, dataFeste, oggiRomaFeste, pulisciMenuFeste, rigaMenuFeste, stagioneMenu, type GiornoFeste, type MenuFeste } from "@/lib/menu-feste";

// "Menu delle feste" nel pannello del ristoratore (PROPOSTE.md, proposta 90): giorni, prezzo a persona, bevande
// (revisore 26/11: i gruppi tolti, la riga della scheda resta corta). Chi apre la scheda vede "🎄 Menu feste 65 €, bevande incluse · … · dice il locale",
// solo fino all'ultimo giorno indicato. Niente testo libero. Nell'esempio dimostrativo si prova ma non si salva.
const cifre = (v: string, n: number) => v.replace(/[^0-9]/g, "").slice(0, n);
const chiave = (m: Pick<MenuFeste, "prezzo" | "bevande" | "giorni"> | null) => (m ? `${m.prezzo}|${m.bevande}|${m.giorni.join()}` : "");

export default function MenuFesteModulo({ placeId, iniziale, verificato, demo }: { placeId: string; iniziale: MenuFeste | null; verificato: boolean; demo: boolean }) {
  const oggi = oggiRomaFeste();
  // Un menu dell'anno scorso non si ripropone: si riparte vuoti.
  const valido0 = iniziale && stagioneMenu(oggiRomaFeste(new Date(iniziale.at || 0))) === stagioneMenu(oggi) ? iniziale : null;
  const [giorni, setGiorni] = useState<GiornoFeste[]>(valido0?.giorni ?? []);
  const [prezzo, setPrezzo] = useState(valido0 ? String(valido0.prezzo) : "");
  const [bevande, setBevande] = useState(valido0?.bevande ?? false);
  const [salvato, setSalvato] = useState<MenuFeste | null>(valido0);
  const [stato, setStato] = useState<"fermo" | "salvo" | "fatto" | "errore">("fermo");
  const [errore, setErrore] = useState<string | null>(null);
  const [uscito, setUscito] = useState(false);

  if (!verificato) return <p className="text-sm font-sans text-text-muted">Si accende quando il locale è verificato.</p>;
  if (!demo && stagioneMenu(oggi) == null) return <p data-testid="menu-feste-chiuso" className="text-sm font-sans text-text-muted">Si apre dal 1 novembre.</p>;

  // Giorni già passati in questa stagione: spenti (revisore 26/11: un menu solo per il 24 salvato il 27 non si vede).
  const s0 = stagioneMenu(oggi);
  const passato = (k: GiornoFeste) => s0 != null && dataFeste(k, s0) < oggi;
  const vuoto = giorni.length === 0 && prezzo === "";
  const pulito = vuoto ? null : pulisciMenuFeste(prezzo, bevande, giorni.filter((k) => !passato(k)), null, new Date().toISOString());
  const valido = vuoto || pulito != null;
  // Il salvato si confronta senza i giorni già passati, come il modulo (revisore 26/11 (2): il 25/12 "Salva" si accendeva da solo).
  const salvatoOggi = salvato ? { ...salvato, giorni: salvato.giorni.filter((k) => !passato(k)) } : null;
  const cambiato = valido && chiave(pulito) !== chiave(salvatoOggi?.giorni.length ? salvatoOggi : null);
  const avviso = !valido && uscito ? (giorni.length === 0 ? "Scegli almeno un giorno." : `Prezzo a persona tra 1 e ${FESTE_PREZZO_MAX} €.`) : null;

  const tocca = (k: GiornoFeste) => {
    setStato("fermo");
    setGiorni((prev) => GIORNI_FESTE.map((g) => g.k).filter((x) => (x === k ? !prev.includes(x) : prev.includes(x))));
  };

  const salva = async (m: MenuFeste | null) => {
    // Revisore 27/11: anche nell'esempio "Togli" svuota il modulo, come il pannello vero.
    if (demo) {
      setSalvato(m);
      setGiorni(m?.giorni ?? []);
      setPrezzo(m ? String(m.prezzo) : "");
      setBevande(m?.bevande ?? false);
      setStato("fatto");
      return;
    }
    setStato("salvo");
    setErrore(null);
    try {
      const r = await fetch("/api/ristoratore/serate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: placeId, feste: m ? { prezzo: m.prezzo, bevande: m.bevande, giorni: m.giorni } : null }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "Non sono riuscito a salvare.");
      const f = j.feste ? pulisciMenuFeste(j.feste.prezzo, j.feste.bevande, j.feste.giorni, j.feste.gruppi, j.feste.at) : null;
      setSalvato(f);
      setGiorni(f?.giorni ?? []);
      setPrezzo(f ? String(f.prezzo) : "");
      setBevande(f?.bevande ?? false);
      setStato("fatto");
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Non sono riuscito a salvare.");
      setStato("errore");
    }
  };

  const campo = "min-h-11 rounded-card border border-border bg-white px-3 text-sm font-sans text-text";
  // Anteprima con la stessa riga della scheda; nell'esempio anche fuori stagione si vede come verrebbe.
  const daMostrare = cambiato ? pulito : salvato;
  // Fuori stagione (solo nell'esempio) data finta del 1/12 e menu scritto il 15/11 della stessa stagione (revisore 27/11).
  const fuori = stagioneMenu(oggi) == null;
  const annoFinto = new Date().getFullYear();
  const riga = daMostrare ? rigaMenuFeste({ ...daMostrare, at: fuori ? `${annoFinto}-11-15T12:00:00Z` : new Date().toISOString() }, fuori ? `${annoFinto}-12-01` : oggi) : null;
  return (
    <div data-testid="menu-feste">
      <div className="grid grid-cols-5 gap-1" role="group" aria-label="Giorni con il menu delle feste">
        {GIORNI_FESTE.map((g) => {
          const on = giorni.includes(g.k) && !passato(g.k);
          return (
            <button key={g.k} type="button" aria-pressed={on} disabled={passato(g.k)} aria-label={`${g.nome}, ${g.n} ${g.mese === "dic" ? "dicembre" : "gennaio"}`} data-testid="feste-giorno" onClick={() => tocca(g.k)}
              className={`flex min-h-11 min-w-0 flex-col items-center justify-center rounded-btn border px-0.5 leading-tight active:scale-95 disabled:opacity-40 ${on ? "border-brand bg-brand text-white" : "border-border bg-white text-brand"}`}>
              <span className="text-sm font-display font-semibold">{g.n} {g.mese}</span>
              <span className={`truncate text-[10px] font-sans ${on ? "text-white/80" : "text-text-muted"}`}>{g.nome}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex items-center gap-2 text-sm font-sans text-text">
          A persona
          <input type="text" inputMode="numeric" pattern="[0-9]*" data-testid="feste-prezzo" aria-label="Prezzo a persona del menu delle feste (euro)" value={prezzo} onChange={(e) => { setPrezzo(cifre(e.target.value, 3)); setStato("fermo"); setUscito(false); }} onBlur={() => setUscito(true)} className={`${campo} w-20`} />
          €
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm font-sans text-text">
          <input type="checkbox" data-testid="feste-bevande" checked={bevande} onChange={(e) => { setBevande(e.target.checked); setStato("fermo"); }} className="h-5 w-5 accent-brand" />
          Bevande incluse
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" data-testid="feste-salva" disabled={!cambiato || stato === "salvo"} onClick={() => salva(pulito)}
          className="min-h-11 rounded-pill bg-accent px-5 text-sm font-display font-semibold text-white active:scale-95 disabled:opacity-40">
          {stato === "salvo" ? "Salvo…" : "Salva"}
        </button>
        {/* Solo con il modulo uguale al salvato (revisore 26/11: mentre si corregge non si toglie per sbaglio). */}
        {salvato && valido && !cambiato && stato !== "salvo" && (
          <button type="button" data-testid="feste-togli" onClick={() => salva(null)} className="min-h-11 px-2 text-sm font-display font-semibold text-text-muted underline underline-offset-2">
            Togli
          </button>
        )}
        {stato === "fatto" && !cambiato && (
          <span role="status" className="inline-flex items-center gap-1 text-sm font-sans text-success">
            <Check size={16} aria-hidden /> {demo ? "Fatto (esempio: non si salva)" : "Salvato"}
          </span>
        )}
        {stato === "errore" && errore && <span role="alert" className="text-sm font-sans text-error">{errore}</span>}
        {avviso && <span role="alert" className="text-sm font-sans text-error">{avviso}</span>}
      </div>
      <p data-testid="feste-anteprima" className="mt-3 text-xs font-sans leading-snug text-text-muted">
        {riga ? (
          <>Nella tua scheda: <strong className="font-display text-text">🎄 {riga.prezzo}, {riga.dettagli.join(" · ")}</strong> · dice il locale. Sparisce da sola dopo l&apos;ultimo giorno.</>
        ) : (
          "Nessun menu delle feste: nella tua scheda non compare niente."
        )}
      </p>
    </div>
  );
}
