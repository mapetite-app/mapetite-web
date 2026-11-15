"use client";

import { useState, type ReactNode } from "react";
import { accettaInvito } from "@/app/onboarding/actions";
import { clearStoredInvite, testoInvitoNo } from "@/lib/invito";
import { trackFeature } from "@/lib/track";

// Chi ha già un account e apre il link personale di un amico (revisore 14/11: prima "sei dentro" e basta,
// e i 7 utenti di oggi non potevano diventare amici di nessuno). Un tasto, e il nome se manca.
// Usato anche in Amici per l'invito rimasto senza risposta nel primo accesso ("contesto": "amici", con "Non ora").
// "className": il margine sotto (in Amici il riquadro ha già il suo spazio: niente vuoto in fondo).
// "riga": la frase sopra il tasto ("Da amici vi vedete per nome…"): solo finché si può ancora accettare, mai dopo
// un esito negativo (revisore 15/11: restava sotto "Vi eravate tolti dagli amici").
export default function InvitoAccetta({ codice, nome, chiediNome, contesto = "gia_iscritto", nonOra, className = "mb-3", riga }: { codice: string; nome: string | null; chiediNome: boolean; contesto?: string; nonOra?: () => void; className?: string; riga?: ReactNode }) {
  const [mio, setMio] = useState("");
  // Il server può chiedere il nome anche se la pagina pensava di averlo (revisore 14/11, terzo giro).
  const [serveNome, setServeNome] = useState(chiediNome);
  const [stato, setStato] = useState<"idle" | "salvo" | "amici" | "no" | "errore" | "nome">("idle");
  // Perché l'invito non è andato: link scaduto, già usato tra voi due, o troppi amici da invito.
  const [motivo, setMotivo] = useState("");
  if (stato === "amici") {
    return <p data-testid="invito-accettato" className={`${className} rounded-card bg-accent-light p-3 text-center text-[15px] font-sans text-text`}>🤝 Tu e {nome ?? "il tuo amico"} siete amici: vi trovate in Amici.</p>;
  }
  if (stato === "no") {
    return <p data-testid="invito-scaduto" data-motivo={motivo} className={`${className} text-center text-sm font-sans text-text-muted`}>{testoInvitoNo(motivo, nome)}</p>;
  }
  const senzaNome = serveNome && !mio.trim();
  return (
    <div data-testid="invito-accetta" className={className}>
      {riga}
      {serveNome && (
        <input
          data-testid="invito-mio-nome"
          value={mio}
          onChange={(e) => { setMio(e.target.value); if (stato === "nome") setStato("idle"); }}
          maxLength={40}
          autoComplete="name"
          placeholder={`Il tuo nome (lo vedrà ${nome ?? "il tuo amico"})`}
          aria-label="Il tuo nome"
          aria-invalid={stato === "nome"}
          className="mb-2 block min-h-11 w-full rounded-pill border border-border bg-white px-4 text-[16px] font-sans text-text outline-none focus:border-brand aria-[invalid=true]:border-error"
        />
      )}
      <button
        type="button"
        data-testid="invito-si"
        disabled={stato === "salvo" || senzaNome}
        onClick={async () => {
          setStato("salvo");
          const r = await accettaInvito(codice, mio).catch(() => ({ stato: "rete" as const }));
          trackFeature("invito_amico", { stato: r.stato === "ok" ? "amici" : r.stato === "no" ? r.motivo : r.stato, contesto });
          if (r.stato === "rete") { setStato("errore"); return; }
          if (r.stato === "nome") { setServeNome(true); setStato("nome"); return; }
          clearStoredInvite();
          if (r.stato === "no") setMotivo(r.motivo);
          setStato(r.stato === "ok" ? "amici" : "no");
        }}
        // Spento finché manca il nome: grigio chiaro con testo scuro, leggibile (prima corallo sbiadito, revisore 14/11).
        className={`flex min-h-13 w-full items-center justify-center rounded-pill px-6 py-3.5 font-display text-base font-semibold active:scale-[0.98] ${senzaNome ? "bg-[#e3e7e7] text-text-muted" : "bg-accent text-white shadow-float disabled:opacity-80"}`}
      >
        {stato === "salvo" ? "Un attimo…" : `Diventa amico di ${nome ?? "chi ti ha invitato"}`}
      </button>
      {nonOra && (
        <button type="button" data-testid="invito-no" onClick={nonOra} disabled={stato === "salvo"} className="mt-1 flex min-h-11 w-full items-center justify-center font-display text-sm font-semibold text-text-muted">
          Non ora
        </button>
      )}
      {stato === "errore" && <p role="alert" className="mt-2 text-center text-sm text-error">Non ci sono riuscito: riprova.</p>}
      {stato === "nome" && <p role="alert" data-testid="invito-serve-nome" className="mt-2 text-center text-sm text-error">Prima scrivi il tuo nome: lo vedrà {nome ?? "il tuo amico"}.</p>}
    </div>
  );
}
