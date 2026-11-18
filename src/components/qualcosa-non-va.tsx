"use client";

import { useEffect, useState } from "react";
import { ChevronRight, LifeBuoy } from "lucide-react";
import { trackFeature } from "@/lib/track";

// "Qualcosa non va?" (proposta 54): una riga nelle Impostazioni del Profilo che apre un foglio
// dal basso per segnalare un difetto. Il testo va a /api/segnalazioni con la pagina (solo il
// percorso) e la larghezza dello schermo; lo legge Lorenzo in /admin/numeri. Niente screenshot.
const MIN = 5;
const MAX = 1000;

export default function QualcosaNonVa({ rowClass }: { rowClass: string }) {
  const [open, setOpen] = useState(false);
  const [testo, setTesto] = useState("");
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [grazie, setGrazie] = useState(false);

  const close = () => { if (!busy) { setOpen(false); setErrore(null); } };

  useEffect(() => {
    if (!open || busy) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setErrore(null); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy]);

  useEffect(() => {
    if (!grazie) return;
    const t = window.setTimeout(() => setGrazie(false), 4000);
    return () => window.clearTimeout(t);
  }, [grazie]);

  const pulito = testo.trim();
  const valido = pulito.length >= MIN && pulito.length <= MAX;

  async function invia() {
    if (!valido || busy) return;
    setBusy(true);
    setErrore(null);
    try {
      const res = await fetch("/api/segnalazioni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testo: pulito, pagina: window.location.pathname, larghezza: Math.round(window.innerWidth) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.ok) {
        setErrore(typeof body?.error === "string" ? body.error : "Non sono riuscito a inviarla. Riprova tra poco.");
        setBusy(false);
        return;
      }
    } catch {
      setErrore("Connessione assente: riprova quando sei online.");
      setBusy(false);
      return;
    }
    trackFeature("segnalazione", { contesto: "inviata" });
    setBusy(false);
    setTesto("");
    setOpen(false);
    setGrazie(true);
  }

  return (
    <>
      <button
        type="button"
        data-testid="profilo-qualcosa-non-va"
        onClick={() => { setOpen(true); setGrazie(false); }}
        className={`${rowClass} w-full text-left`}
      >
        <LifeBuoy size={18} strokeWidth={1.75} aria-hidden className="shrink-0 text-brand" />
        <span className="min-w-0 flex-1">
          <span className="block font-sans text-[15px] font-medium text-text">Qualcosa non va?</span>
          <span className="block truncate text-xs text-text-muted">Scrivici cosa è successo</span>
        </span>
        <ChevronRight aria-hidden size={16} className="text-text-muted" />
      </button>
      {grazie && (
        <p role="status" data-testid="segnalazione-grazie" className="fixed inset-x-4 bottom-[calc(88px+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-md rounded-pill bg-brand px-4 py-3 text-center text-sm font-display font-semibold text-white shadow-float">
          Grazie, l&apos;abbiamo ricevuto.
        </p>
      )}
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center" data-testid="segnalazione-foglio">
          <button type="button" aria-label="Chiudi" onClick={close} className="absolute inset-0 bg-black/40" />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="segnalazione-titolo"
            className="relative flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-y-auto rounded-t-[24px] bg-white px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3 shadow-float"
          >
            <span aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
            <h3 id="segnalazione-titolo" className="font-title text-lg font-semibold text-brand">Qualcosa non va?</h3>
            <p className="mt-1 text-sm text-text-muted">Dicci cosa è successo e dove: ci aiuti a sistemarlo.</p>
            <textarea
              data-testid="segnalazione-testo"
              value={testo}
              onChange={(e) => setTesto(e.target.value.slice(0, MAX))}
              maxLength={MAX}
              rows={5}
              autoFocus
              aria-label="Cosa è successo"
              placeholder="Es. ho salvato un locale ma non lo trovo nei Salvati"
              className="mt-3 w-full resize-none rounded-card border border-border bg-surface px-3 py-2.5 text-[16px] text-text placeholder:text-text-muted focus:border-brand focus:outline-none"
            />
            <p className="mt-1 text-right text-xs tabular-nums text-text-muted">{testo.length}/{MAX}</p>
            <button
              type="button"
              data-testid="segnalazione-invia"
              disabled={!valido || busy}
              onClick={() => void invia()}
              className="mt-2 flex min-h-12 w-full items-center justify-center rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white active:scale-[0.99] disabled:opacity-50"
            >
              {busy ? "Invio…" : "Invia"}
            </button>
            {errore && <p role="alert" data-testid="segnalazione-errore" className="mt-3 text-sm text-error">{errore}</p>}
          </div>
        </div>
      )}
    </>
  );
}
