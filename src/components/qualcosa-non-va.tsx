"use client";

import { useEffect, useState } from "react";
import { ChevronRight, MessageCircle } from "lucide-react";
import { trackFeature } from "@/lib/track";
import { feedbackMailto } from "@/lib/feedback";

// "Qualcosa non va?" (proposta 54). Revisore 18/11: era un doppione di "Dai un feedback" (mailto) nello stesso
// pannello. Ora è una riga sola, "Dai un feedback", che per chi ha l'accesso apre questo foglio (l'email resta
// come link discreto dentro il foglio). Prima: una riga nelle Impostazioni del Profilo che apre un foglio
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
        className={`${rowClass} w-full text-left text-text`}
      >
        <MessageCircle aria-hidden className="h-5 w-5 text-brand" strokeWidth={1.75} />
        <span className="flex-1">
          Dai un feedback
          <span className="block text-xs font-sans font-normal text-text-muted">Cosa ti piace, cosa non va, cosa ti manca</span>
        </span>
        <ChevronRight aria-hidden className="h-4 w-4 text-text-muted" />
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
            <h3 id="segnalazione-titolo" className="font-title text-lg font-semibold text-brand">Dai un feedback</h3>
            <p className="mt-1 text-sm text-text-muted">Cosa non va, cosa ti piace, cosa ti manca. Se è un errore, dicci dove.</p>
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
            {/* Revisore 18/11: l'errore sopra il tasto, così con la tastiera aperta resta in vista. */}
            {errore && <p role="alert" data-testid="segnalazione-errore" className="mt-1 text-sm text-error">{errore}</p>}
            <button
              type="button"
              data-testid="segnalazione-invia"
              disabled={!valido || busy}
              onClick={() => void invia()}
              className="mt-2 flex min-h-12 w-full items-center justify-center rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white active:scale-[0.99] disabled:opacity-50"
            >
              {busy ? "Invio…" : "Invia"}
            </button>
            <a
              href="mailto:"
              data-testid="segnalazione-email"
              onClick={(e) => { e.currentTarget.href = feedbackMailto(); }}
              className="mt-3 flex min-h-11 items-center justify-center text-sm font-sans text-text-muted underline underline-offset-2"
            >
              Preferisci l&apos;email?
            </a>
          </div>
        </div>
      )}
    </>
  );
}
