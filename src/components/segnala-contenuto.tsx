"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import { trackFeature } from "@/lib/track";
import { MOTIVI, type Motivo, type TipoContenuto } from "@/lib/moderazione";

// Proposta 82 "Segnala e nascondi" (23/11, regola 1.2 dell'App Store): il "⋯" accanto a una recensione o
// a una foto di un altro membro apre un foglio con due gesti: segnalarla (con un motivo) o non vedere più
// i contenuti di quella persona. Una sola azione principale per foglio: il motivo, poi "Segnala".
// Il foglio va in un portale: la scheda del locale ha trasformazioni che rompono il "fixed". Sta sopra
// anche la foto a schermo intero (z 80), da dove si apre dal 24/11.

type Props = {
  tipo: TipoContenuto;
  id: string;
  nome: string | null; // nome dell'autore se il profilo è pubblico; null = "questa persona"
  onFatto: (azione: "segnala" | "nascondi") => void;
  className?: string;
  sopraFoto?: boolean; // "⋯" bianco nell'angolo della foto (non toglie spazio all'etichetta)
};

export default function SegnalaContenuto({ tipo, id, nome, onFatto, className = "", sopraFoto = false }: Props) {
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState<Motivo | null>(null);
  const [busy, setBusy] = useState<"segnala" | "nascondi" | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const cosa = tipo === "recensione" ? "recensione" : "foto";

  const close = () => { if (!busy) { setOpen(false); setErrore(null); setMotivo(null); } };

  useEffect(() => {
    if (!open || busy) return;
    // In cattura (revisore 24/11): dalla foto a schermo intero il keydown si ferma prima di arrivare a window.
    // Escape chiude solo il foglio, non anche la foto sotto.
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); setErrore(null); setMotivo(null); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, busy]);

  async function invia(azione: "segnala" | "nascondi") {
    if (busy || (azione === "segnala" && !motivo)) return;
    setBusy(azione);
    setErrore(null);
    try {
      const r = await fetch("/api/moderazione", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ azione, tipo, id, motivo: azione === "segnala" ? motivo : undefined }),
      });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!r.ok || !j?.ok) throw new Error(j?.error ?? "Non ci sono riuscito. Riprova tra poco.");
      trackFeature(azione === "segnala" ? "contenuto_segnalato" : "contenuto_nascosto", { contesto: tipo, ...(motivo && azione === "segnala" ? { stato: motivo } : {}) });
      setOpen(false);
      setMotivo(null);
      onFatto(azione);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Non ci sono riuscito. Riprova tra poco.");
    } finally {
      setBusy(null);
    }
  }

  const titoloId = `segnala-${id}`;
  return (
    <>
      <button
        type="button"
        data-testid="segnala-apri"
        aria-label={`Segnala o nascondi questa ${cosa}`}
        onClick={() => { setOpen(true); trackFeature("segnala_apri", { contesto: tipo }); }}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${sopraFoto ? "" : "text-text-muted active:bg-surface"} ${className}`}
      >
        {sopraFoto ? (
          <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white">
            <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
          </span>
        ) : (
          <MoreHorizontal aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        )}
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[90] flex items-end justify-center" data-testid="segnala-foglio">
          <button type="button" aria-label="Chiudi" onClick={close} className="absolute inset-0 bg-black/40" />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titoloId}
            className="relative flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-y-auto rounded-t-[24px] bg-white px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3 shadow-float"
          >
            <span aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
            <h3 id={titoloId} className="font-title text-lg font-semibold text-brand">Cosa non va in questa {cosa}?</h3>
            <div role="radiogroup" aria-label="Motivo" className="mt-3 flex flex-wrap gap-2">
              {MOTIVI.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={motivo === m.id}
                  data-testid={`segnala-motivo-${m.id}`}
                  onClick={() => setMotivo(m.id)}
                  className={`min-h-11 rounded-pill border px-4 text-sm font-display font-semibold ${motivo === m.id ? "border-brand bg-brand text-white" : "border-border bg-white text-text"}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              data-testid="segnala-invia"
              disabled={!motivo || busy != null}
              onClick={() => void invia("segnala")}
              className="mt-4 flex min-h-12 w-full items-center justify-center rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white active:scale-[0.99] disabled:opacity-40"
            >
              {busy === "segnala" ? "Invio…" : "Segnala"}
            </button>
            {errore ? <p role="alert" data-testid="segnala-errore" className="mt-2 text-sm font-sans text-error">{errore}</p>
              : <p className="mt-2 text-xs font-sans text-text-muted">La controlliamo noi. Intanto non la vedi più.</p>}
            <button
              type="button"
              data-testid="segnala-nascondi"
              disabled={busy != null}
              onClick={() => void invia("nascondi")}
              className="mt-4 flex min-h-12 w-full items-center justify-center border-t border-border px-2 pt-2 text-sm font-display font-semibold text-error disabled:opacity-40"
            >
              {busy === "nascondi" ? "Un attimo…" : `Non mostrarmi più ${nome ? `i contenuti di ${nome}` : "i contenuti di questa persona"}`}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
