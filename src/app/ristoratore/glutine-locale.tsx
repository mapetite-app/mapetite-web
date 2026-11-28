"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { fraseGlutineLocale, pulisciGlutineLocale, type GlutineLocale, type PiattiGlutine } from "@/lib/glutine-locale";

// "Il locale dice: senza glutine" nel pannello del ristoratore (PROPOSTE.md, proposta 92): tre scelte a tocco,
// niente testo libero. Chi apre la scheda vede "🌾 Senza glutine su richiesta, preparati a parte · dice il locale",
// accanto a quello che dicono le recensioni (proposta 91): il locale non copre mai una recensione.
// Toccare di nuovo una scelta già premuta la toglie ("non lo dico"). Nell'esempio dimostrativo si prova ma non si salva.
type Stato = { piatti: PiattiGlutine | null; separati: boolean | null; afc: boolean | null };
const chiave = (g: Stato | GlutineLocale | null) => (g?.piatti ? `${g.piatti}|${g.piatti === "no" ? "" : g.separati}|${g.piatti === "no" ? "" : g.afc}` : "");

function Scelte<T extends string | boolean>({ etichetta, valore, opzioni, onScegli, testId }: { etichetta: string; valore: T | null; opzioni: { v: T; testo: string }[]; onScegli: (v: T | null) => void; testId: string }) {
  return (
    <div className="mt-3 first:mt-0">
      <p className="text-sm font-sans text-text">{etichetta}</p>
      <div role="group" aria-label={etichetta} className={`mt-1.5 grid gap-1.5 ${opzioni.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {opzioni.map((o) => {
          const on = valore === o.v;
          return (
            <button key={String(o.v)} type="button" aria-pressed={on} data-testid={`${testId}-${String(o.v)}`} onClick={() => onScegli(on ? null : o.v)}
              className={`min-h-11 min-w-0 rounded-btn border px-2 text-sm font-display font-semibold active:scale-95 ${on ? "border-brand bg-brand text-white" : "border-border bg-white text-brand"}`}>
              {o.testo}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function GlutineModulo({ placeId, iniziale, verificato, demo }: { placeId: string; iniziale: GlutineLocale | null; verificato: boolean; demo: boolean }) {
  const [scelta, setScelta] = useState<Stato>({ piatti: iniziale?.piatti ?? null, separati: iniziale?.separati ?? null, afc: iniziale?.afc ?? null });
  const [salvato, setSalvato] = useState<GlutineLocale | null>(iniziale);
  const [stato, setStato] = useState<"fermo" | "salvo" | "fatto" | "errore">("fermo");
  const [errore, setErrore] = useState<string | null>(null);

  if (!verificato) return <p className="text-sm font-sans text-text-muted">Si accende quando il locale è verificato.</p>;

  const pulito = scelta.piatti ? pulisciGlutineLocale(scelta.piatti, scelta.separati, scelta.afc, new Date().toISOString()) : null;
  const cambiato = chiave(pulito) !== chiave(salvato);
  const cambia = (x: Partial<Stato>) => { setScelta((p) => ({ ...p, ...x })); setStato("fermo"); };

  const salva = async (g: GlutineLocale | null) => {
    const metti = (f: GlutineLocale | null) => {
      setSalvato(f);
      setScelta({ piatti: f?.piatti ?? null, separati: f?.separati ?? null, afc: f?.afc ?? null });
      setStato("fatto");
    };
    if (demo) { metti(g); return; }
    setStato("salvo");
    setErrore(null);
    try {
      const r = await fetch("/api/ristoratore/serate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: placeId, glutine: g ? { piatti: g.piatti, separati: g.separati, afc: g.afc } : null }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "Non sono riuscito a salvare.");
      metti(j.glutine ? pulisciGlutineLocale(j.glutine.piatti, j.glutine.separati, j.glutine.afc, j.glutine.at) : null);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Non sono riuscito a salvare.");
      setStato("errore");
    }
  };

  const daMostrare = cambiato ? pulito : salvato;
  const frase = fraseGlutineLocale(daMostrare);
  return (
    <div data-testid="glutine-modulo">
      <Scelte etichetta="Piatti senza glutine" testId="glutine-piatti" valore={scelta.piatti} onScegli={(v) => cambia({ piatti: v })}
        opzioni={[{ v: "si", testo: "Sì" }, { v: "richiesta", testo: "Su richiesta" }, { v: "no", testo: "No" }]} />
      {scelta.piatti && scelta.piatti !== "no" && (
        <>
          <Scelte etichetta="Preparati a parte" testId="glutine-separati" valore={scelta.separati} onScegli={(v) => cambia({ separati: v })}
            opzioni={[{ v: true, testo: "Sì" }, { v: false, testo: "No" }]} />
          <Scelte etichetta="Socio AFC di AIC" testId="glutine-afc" valore={scelta.afc} onScegli={(v) => cambia({ afc: v })}
            opzioni={[{ v: true, testo: "Sì" }, { v: false, testo: "No" }]} />
        </>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" data-testid="glutine-salva" disabled={!cambiato || stato === "salvo" || !pulito} onClick={() => salva(pulito)}
          className="min-h-11 rounded-pill bg-accent px-5 text-sm font-display font-semibold text-white active:scale-95 disabled:opacity-40">
          {stato === "salvo" ? "Salvo…" : "Salva"}
        </button>
        {salvato && !cambiato && stato !== "salvo" && (
          <button type="button" data-testid="glutine-togli" onClick={() => salva(null)} className="min-h-11 px-2 text-sm font-display font-semibold text-text-muted underline underline-offset-2">
            Togli
          </button>
        )}
        {stato === "fatto" && !cambiato && (
          <span role="status" className="inline-flex items-center gap-1 text-sm font-sans text-success">
            <Check size={16} aria-hidden /> {demo ? "Fatto (esempio: non si salva)" : "Salvato"}
          </span>
        )}
        {stato === "errore" && errore && <span role="alert" className="text-sm font-sans text-error">{errore}</span>}
      </div>
      <p data-testid="glutine-anteprima" className="mt-3 text-xs font-sans leading-snug text-text-muted">
        {frase ? (
          <>Nella tua scheda: <strong className="font-display text-text">🌾 {frase}</strong> · dice il locale. Accanto restano le recensioni che ne parlano.</>
        ) : (
          "Niente detto: nella tua scheda compare solo quello che dicono le recensioni."
        )}
      </p>
    </div>
  );
}
