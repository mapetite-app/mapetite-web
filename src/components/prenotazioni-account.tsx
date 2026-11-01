"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { accendiPrenotazioniAccount, sincronizzaPrenotazioni, spegniPrenotazioniAccount, type StatoAccount } from "@/lib/prenotazioni-sync";
import { trackFeature } from "@/lib/track";

// "Tienile sul tuo account" (Cliente di parola, passo 2, PROPOSTE.md 3): una riga sotto l'elenco di /prenotazioni.
// Spento di base: si accende solo con il tocco della persona, dopo aver letto cosa si salva.
// Senza accesso (401) o con un errore non compare niente: le prenotazioni restano sul telefono.
export default function PrenotazioniAccount({ haPrenotazioni, onStato }: { haPrenotazioni: boolean; onStato?: (s: StatoAccount) => void }) {
  const [stato, setStato] = useState<StatoAccount | null>(null);
  const [busy, setBusy] = useState(false);
  const [chiedi, setChiedi] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void sincronizzaPrenotazioni().then((s) => { if (alive) { setStato(s); onStato?.(s); } });
    return () => { alive = false; };
  }, [onStato]);

  const imposta = (s: StatoAccount) => { setStato(s); onStato?.(s); };

  if (stato === "acceso") {
    if (chiedi) {
      return (
        <div data-testid="prenotazioni-account-spegni-conferma" className="mt-4 rounded-btn bg-accent-light p-3">
          <p className="text-sm font-sans text-text">Le togliamo dal tuo account. Su questo telefono restano.</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const ok = await spegniPrenotazioniAccount();
                setBusy(false);
                setChiedi(false);
                if (ok) { imposta("spento"); trackFeature("prenotazioni_account", { stato: "spento" }); }
                else {
                  // Spegni a metà (consenso tolto, cancellazione fallita): si rilegge lo stato vero.
                  setErrore("Non ci sono riuscito. Riprova tra poco.");
                  void sincronizzaPrenotazioni().then((s) => { if (s === "spento") imposta(s); });
                }
              }}
              className="min-h-10 flex-1 rounded-pill bg-accent px-3 text-sm font-display font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Un attimo…" : "Sì, togli"}
            </button>
            <button type="button" onClick={() => setChiedi(false)} className="min-h-10 flex-1 rounded-pill border border-border bg-white px-3 text-sm font-display font-semibold text-brand">
              No
            </button>
          </div>
        </div>
      );
    }
    return (
      <p data-testid="prenotazioni-account-acceso" className="mt-6 flex flex-wrap items-center justify-center gap-x-2 text-sm font-sans text-text-muted">
        <span className="inline-flex items-center gap-1 font-display font-semibold text-brand"><Check size={15} aria-hidden /> Sul tuo account</span>
        <span aria-hidden>·</span>
        <button type="button" data-testid="prenotazioni-account-spegni" onClick={() => { setErrore(null); setChiedi(true); }} className="min-h-10 font-display font-semibold text-text-muted underline underline-offset-2">
          Spegni
        </button>
        {errore && <span role="status" className="w-full text-xs text-accent">{errore}</span>}
      </p>
    );
  }

  // Telefono legato a un altro account (stesso telefono, accesso diverso): niente sincronizzazione,
  // ma lo si dice, altrimenti la riga sparisce senza motivo (minore del collaudo del 31/10).
  // Nessuna azione qui: spostarle su questo account mescolerebbe le prenotazioni di due persone.
  if (stato === "altro" && haPrenotazioni) {
    return (
      <div data-testid="prenotazioni-account-altro" role="note" className="mt-6 rounded-card border border-border bg-white px-4 py-2.5">
        <p className="text-sm font-display font-semibold text-brand">Legate a un altro account</p>
        <p className="mt-0.5 text-xs font-sans leading-relaxed text-text-muted">
          Restano su questo telefono. Si aggiornano solo con l&apos;account a cui sono legate.
        </p>
      </div>
    );
  }

  if (stato !== "spento" || !haPrenotazioni) return null;
  // Riga sottile sotto l'elenco (dal secondo collaudo): le prenotazioni restano la cosa principale.
  return (
    <div data-testid="prenotazioni-account" className="mt-6 flex items-center gap-3 rounded-card border border-border bg-white px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-display font-semibold text-brand">Tienile sul tuo account</p>
        <p className="mt-0.5 text-xs font-sans leading-relaxed text-text-muted">
          Non le perdi cambiando telefono e «di parola» vale ovunque.{" "}
          <Link href="/privacy#prenotazioni" className="whitespace-nowrap font-semibold text-brand underline underline-offset-2">Cosa salviamo</Link>
        </p>
        {errore && <p role="status" className="mt-1 text-xs font-sans text-accent">{errore}</p>}
      </div>
      <button
        type="button"
        data-testid="prenotazioni-account-attiva"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErrore(null);
          const ok = await accendiPrenotazioniAccount();
          setBusy(false);
          if (ok) { imposta("acceso"); trackFeature("prenotazioni_account", { stato: "acceso" }); }
          else setErrore("Non ci sono riuscito. Riprova tra poco.");
        }}
        className="min-h-10 shrink-0 rounded-pill border border-brand px-4 text-sm font-display font-semibold text-brand active:scale-[0.98] disabled:opacity-60"
      >
        {busy ? "Un attimo…" : "Attiva"}
      </button>
    </div>
  );
}
