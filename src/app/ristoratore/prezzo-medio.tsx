"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { frasePrezzo, pulisciPrezzo, type Prezzo } from "@/lib/prezzo-locale";

// "Fascia di prezzo confermata dal locale" nel pannello del ristoratore (PROPOSTE.md, proposta 65):
// il titolare dice quanto si spende a testa (da/a, in euro) e se le bevande sono incluse; chi apre la
// scheda vede "💶 25–35 € a testa · dice il locale". Nell'esempio dimostrativo si prova tutto ma non si salva.
const chiave = (p: Prezzo | null) => (p ? `${p.min}|${p.max}|${p.bevande}` : "");

export default function PrezzoMedio({ placeId, iniziale, verificato, demo }: { placeId: string; iniziale: Prezzo | null; verificato: boolean; demo: boolean }) {
  const [da, setDa] = useState(iniziale ? String(iniziale.min) : "");
  const [a, setA] = useState(iniziale ? String(iniziale.max) : "");
  const [bevande, setBevande] = useState(iniziale?.bevande ?? false);
  const [salvato, setSalvato] = useState<Prezzo | null>(iniziale);
  const [stato, setStato] = useState<"fermo" | "salvo" | "fatto" | "errore">("fermo");
  const [errore, setErrore] = useState<string | null>(null);
  // L'avviso compare solo con i due campi pieni o uscendo da un campo (revisore 17/11: sgridava mentre si scriveva).
  const [uscito, setUscito] = useState(false);
  const vuoto = da.trim() === "" && a.trim() === "";
  // Un solo campo pieno = prezzo unico (menu fisso da 30 €: "30 € a testa").
  const pulito = vuoto ? null : pulisciPrezzo(da.trim() || a, a.trim() || da, bevande);
  const valido = vuoto || pulito != null;
  const cambiato = valido && chiave(pulito) !== chiave(salvato);
  const mostraAvviso = !valido && ((da.trim() !== "" && a.trim() !== "") || uscito);
  // Solo cifre (su "number" la virgola di "25,5" diventava "255").
  const cifre = (v: string) => v.replace(/[^0-9]/g, "").slice(0, 3);

  const salva = async () => {
    if (demo) { setSalvato(pulito); setStato("fatto"); return; }
    setStato("salvo");
    setErrore(null);
    try {
      const r = await fetch("/api/ristoratore/serate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: placeId, prezzo: pulito }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "Non sono riuscito a salvare.");
      const p = j.prezzo ? pulisciPrezzo(j.prezzo.min, j.prezzo.max, j.prezzo.bevande) : null;
      setSalvato(p);
      setDa(p ? String(p.min) : "");
      setA(p ? String(p.max) : "");
      setBevande(p?.bevande ?? false);
      setStato("fatto");
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Non sono riuscito a salvare.");
      setStato("errore");
    }
  };

  if (!verificato) return <p className="text-sm font-sans text-text-muted">Si accende quando il locale è verificato.</p>;

  const campo = "min-h-11 w-20 rounded-card border border-border bg-white px-3 text-sm font-sans text-text";
  const anteprima = frasePrezzo(cambiato ? pulito : salvato);
  return (
    <div data-testid="prezzo-medio">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-sans text-text">
          Da
          <input type="text" inputMode="numeric" pattern="[0-9]*" data-testid="prezzo-da" aria-label="Prezzo a testa, da (euro)" value={da} onChange={(e) => { setDa(cifre(e.target.value)); setStato("fermo"); setUscito(false); }} onBlur={() => setUscito(true)} className={campo} />
        </label>
        <label className="flex items-center gap-2 text-sm font-sans text-text">
          a
          <input type="text" inputMode="numeric" pattern="[0-9]*" data-testid="prezzo-a" aria-label="Prezzo a testa, a (euro)" value={a} onChange={(e) => { setA(cifre(e.target.value)); setStato("fermo"); setUscito(false); }} onBlur={() => setUscito(true)} className={campo} />
          €
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm font-sans text-text">
          <input type="checkbox" data-testid="prezzo-bevande" checked={bevande} onChange={(e) => { setBevande(e.target.checked); setStato("fermo"); }} className="h-5 w-5 accent-brand" />
          Bevande incluse
        </label>
        <button
          type="button"
          data-testid="prezzo-salva"
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
        {mostraAvviso && <span role="alert" className="text-sm font-sans text-error">Euro tra 1 e 500, "da" non più alto di "a".</span>}
      </div>
      <p data-testid="prezzo-anteprima" className="mt-3 text-xs font-sans leading-snug text-text-muted">
        {anteprima ? (
          <>Nella tua scheda: <strong className="font-display text-text">💶 {anteprima}</strong> · dice il locale.</>
        ) : (
          "Prezzo non indicato: nella tua scheda non compare niente."
        )}
      </p>
    </div>
  );
}
