"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { OMAGGIO_MAX, OMAGGIO_OGNI_GIORNI, pulisciOmaggio, type Omaggio } from "@/lib/omaggio";

// "Omaggio a chi torna" nel pannello del ristoratore (PROPOSTE.md 12): il titolare scrive un piccolo
// omaggio (un caffè, il dolce) e da quale visita vale. Chi torna lo vede nella scheda e lo mostra al
// tavolo con il codice del giorno, che il personale trova qui. Niente sconti in denaro.
// Nell'esempio dimostrativo si prova tutto ma non si salva niente.
export default function OmaggioRitorno({ placeId, iniziale, verificato, demo, codice, mostrati }: { placeId: string; iniziale: Omaggio | null; verificato: boolean; demo: boolean; codice: string | null; mostrati: number }) {
  const [testo, setTesto] = useState(iniziale?.testo ?? "");
  const [soglia, setSoglia] = useState<2 | 3>(iniziale?.soglia ?? 2);
  const [salvato, setSalvato] = useState<Omaggio | null>(iniziale);
  const [stato, setStato] = useState<"fermo" | "salvo" | "fatto" | "errore">("fermo");
  const [errore, setErrore] = useState<string | null>(null);
  const pulito = pulisciOmaggio(testo, soglia);
  const cambiato = testo.trim() === "" ? salvato != null : pulito != null && (pulito.testo !== salvato?.testo || pulito.soglia !== salvato?.soglia);

  const salva = async (valore: Omaggio | null) => {
    if (demo) { setSalvato(valore); setStato("fatto"); if (!valore) setTesto(""); return; }
    setStato("salvo");
    setErrore(null);
    try {
      const r = await fetch("/api/ristoratore/serate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: placeId, omaggio: valore }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "Non sono riuscito a salvare.");
      const nuovo = pulisciOmaggio(j.omaggio?.testo, j.omaggio?.soglia);
      setSalvato(nuovo);
      setTesto(nuovo?.testo ?? "");
      setStato("fatto");
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Non sono riuscito a salvare.");
      setStato("errore");
    }
  };

  if (!verificato) return <p className="text-sm font-sans text-text-muted">Si accende quando il locale è verificato.</p>;

  const nonValido = testo.trim() !== "" && !pulito;
  return (
    <div data-testid="pannello-omaggio-form">
      <label className="block text-xs font-display font-semibold text-text" htmlFor="omaggio-testo">Cosa offri</label>
      <input
        id="omaggio-testo"
        data-testid="omaggio-testo"
        value={testo}
        maxLength={OMAGGIO_MAX}
        onChange={(e) => { setTesto(e.target.value); setStato("fermo"); }}
        placeholder="un caffè, il dolce, un amaro"
        className="mt-1 min-h-11 w-full rounded-btn border border-border bg-white px-3 text-base font-sans text-text"
      />
      {nonValido && <p className="mt-1 text-xs font-sans text-error">Scrivi una cosa breve, senza sconti né euro.</p>}
      <div className="mt-3 flex items-center gap-2" role="group" aria-label="Da quale visita">
        <span className="text-xs font-display font-semibold text-text">Dalla</span>
        {([2, 3] as const).map((n) => (
          <button key={n} type="button" aria-pressed={soglia === n} onClick={() => { setSoglia(n); setStato("fermo"); }} className={`min-h-10 rounded-pill border px-4 text-sm font-display font-semibold active:scale-95 ${soglia === n ? "border-brand bg-brand text-white" : "border-border bg-white text-brand"}`}>
            {n}ª visita
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" data-testid="omaggio-salva" disabled={!cambiato || stato === "salvo" || nonValido} onClick={() => salva(testo.trim() === "" ? null : pulito)} className="min-h-11 rounded-pill bg-accent px-5 text-sm font-display font-semibold text-white active:scale-95 disabled:opacity-40">
          {stato === "salvo" ? "Salvo…" : "Salva"}
        </button>
        {salvato && !cambiato && (
          <button type="button" data-testid="omaggio-spegni" onClick={() => salva(null)} className="min-h-11 px-2 text-sm font-display font-semibold text-brand">Spegni</button>
        )}
        {stato === "fatto" && !cambiato && (
          <span role="status" className="inline-flex items-center gap-1 text-sm font-sans text-success">
            <Check size={16} aria-hidden /> {demo ? "Fatto (esempio: non si salva)" : "Salvato"}
          </span>
        )}
        {stato === "errore" && errore && <span role="alert" className="text-sm font-sans text-error">{errore}</span>}
      </div>
      <p data-testid="omaggio-anteprima" className="mt-3 text-xs font-sans leading-snug text-text-muted">
        {salvato && !cambiato ? (
          <>Nella scheda di chi torna: <strong className="font-display text-text">🎁 Il locale ti offre {salvato.testo}</strong> · dalla {salvato.soglia}ª visita, una volta ogni {OMAGGIO_OGNI_GIORNI} giorni.</>
        ) : (
          "Spento: nella tua scheda non compare niente."
        )}
      </p>
      {salvato && !cambiato && (
        <div data-testid="omaggio-codice-oggi" className="mt-3 flex items-center gap-3 rounded-card border border-border bg-white px-3 py-2">
          <p className="min-w-0 flex-1 text-xs font-sans text-text-muted">Codice di oggi: chi te lo mostra al tavolo ha diritto all&apos;omaggio. Mostrati negli ultimi 30 giorni: <strong className="font-display text-text">{mostrati}</strong></p>
          {codice && <p className="font-mono text-xl font-bold tracking-[0.2em] text-brand">{codice}</p>}
        </div>
      )}
    </div>
  );
}
