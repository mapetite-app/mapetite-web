"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { fraseApertura, pulisciApertoDal } from "@/lib/aperto-dal";

// "Aperto da poco" nel pannello del ristoratore (PROPOSTE.md, proposta 7): il titolare sceglie il mese
// di apertura; nei primi 12 mesi chi apre la scheda del locale vede "🆕 Aperto da 3 mesi".
// Nell'esempio dimostrativo si prova tutto ma non si salva niente.
export default function ApertoDal({ placeId, iniziale, verificato, demo }: { placeId: string; iniziale: string | null; verificato: boolean; demo: boolean }) {
  const [valore, setValore] = useState(iniziale ?? "");
  const [salvato, setSalvato] = useState(iniziale ?? "");
  const [stato, setStato] = useState<"fermo" | "salvo" | "fatto" | "errore">("fermo");
  const [errore, setErrore] = useState<string | null>(null);
  const oggi = new Date();
  const max = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, "0")}`;
  const pulito = valore ? pulisciApertoDal(valore) : null;
  const cambiato = valore !== salvato && (valore === "" || pulito != null);

  const salva = async () => {
    if (demo) { setSalvato(valore); setStato("fatto"); return; }
    setStato("salvo");
    setErrore(null);
    try {
      const r = await fetch("/api/ristoratore/serate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: placeId, apertoDal: pulito }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "Non sono riuscito a salvare.");
      setSalvato(j.apertoDal ?? "");
      setValore(j.apertoDal ?? "");
      setStato("fatto");
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Non sono riuscito a salvare.");
      setStato("errore");
    }
  };

  if (!verificato) return <p className="text-sm font-sans text-text-muted">Si accende quando il locale è verificato.</p>;

  const anteprima = fraseApertura(cambiato ? pulito : salvato || null);
  return (
    <div data-testid="aperto-dal">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-sans text-text">
          Aperto da
          <input
            type="month"
            data-testid="aperto-dal-mese"
            value={valore}
            max={max}
            min="1900-01"
            onChange={(e) => { setValore(e.target.value); setStato("fermo"); }}
            className="min-h-11 rounded-card border border-border bg-white px-3 text-sm font-sans text-text"
          />
        </label>
        <button
          type="button"
          data-testid="aperto-dal-salva"
          disabled={!cambiato || stato === "salvo"}
          onClick={salva}
          className="min-h-11 rounded-pill bg-accent px-5 text-sm font-display font-semibold text-white active:scale-95 disabled:opacity-40"
        >
          {stato === "salvo" ? "Salvo…" : "Salva"}
        </button>
        {stato === "fatto" && !cambiato && (
          <span role="status" className="inline-flex items-center gap-1 text-sm font-sans text-success">
            <Check size={16} aria-hidden /> {demo ? "Fatto (esempio: non si salva)" : "Salvato"}
          </span>
        )}
        {stato === "errore" && errore && <span role="alert" className="text-sm font-sans text-error">{errore}</span>}
        {valore !== "" && !pulito && <span role="alert" className="text-sm font-sans text-error">Il mese non può essere nel futuro.</span>}
      </div>
      <p data-testid="aperto-dal-anteprima" className="mt-3 text-xs font-sans leading-snug text-text-muted">
        {anteprima ? (
          <>Nella tua scheda: <strong className="font-display text-text">🆕 {anteprima}</strong> · per il primo anno.</>
        ) : (
          "Aperto da più di un anno (o mese non indicato): nella tua scheda non compare niente."
        )}
      </p>
    </div>
  );
}
