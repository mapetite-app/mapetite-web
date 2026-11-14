"use client";

import { useState } from "react";
import { accettaInvito } from "@/app/onboarding/actions";
import { clearStoredInvite } from "@/lib/invito";
import { trackFeature } from "@/lib/track";

// Chi ha già un account e apre il link personale di un amico (revisore 14/11: prima "sei dentro" e basta,
// e i 7 utenti di oggi non potevano diventare amici di nessuno). Un tasto, e il nome se manca.
export default function InvitoAccetta({ codice, nome, chiediNome }: { codice: string; nome: string | null; chiediNome: boolean }) {
  const [mio, setMio] = useState("");
  const [stato, setStato] = useState<"idle" | "salvo" | "amici" | "scaduto" | "errore">("idle");
  if (stato === "amici") {
    return <p data-testid="invito-accettato" className="mb-3 rounded-card bg-accent-light p-3 text-center text-[15px] font-sans text-text">🤝 Tu e {nome ?? "il tuo amico"} siete amici: vi trovate in Amici.</p>;
  }
  if (stato === "scaduto") {
    return <p data-testid="invito-scaduto" className="mb-3 text-center text-sm font-sans text-text-muted">Questo invito non vale più: chiedi un link nuovo.</p>;
  }
  return (
    <div data-testid="invito-accetta" className="mb-3">
      {chiediNome && (
        <input
          data-testid="invito-mio-nome"
          value={mio}
          onChange={(e) => setMio(e.target.value)}
          maxLength={40}
          autoComplete="name"
          placeholder={`Il tuo nome (lo vedrà ${nome ?? "il tuo amico"})`}
          aria-label="Il tuo nome"
          className="mb-2 block min-h-11 w-full rounded-pill border border-border bg-white px-4 text-[16px] font-sans text-text outline-none focus:border-brand"
        />
      )}
      <button
        type="button"
        data-testid="invito-si"
        disabled={stato === "salvo" || (chiediNome && !mio.trim())}
        onClick={async () => {
          setStato("salvo");
          const r = await accettaInvito(codice, mio).catch(() => ({ stato: "rete" as const }));
          trackFeature("invito_amico", { stato: r.stato === "ok" ? "amici" : r.stato, contesto: "gia_iscritto" });
          if (r.stato === "rete") { setStato("errore"); return; }
          clearStoredInvite();
          setStato(r.stato === "ok" ? "amici" : "scaduto");
        }}
        className="flex min-h-13 w-full items-center justify-center rounded-pill bg-accent px-6 py-3.5 font-display text-base font-semibold text-white shadow-float active:scale-[0.98] disabled:opacity-60"
      >
        {stato === "salvo" ? "Un attimo…" : `Diventa amico di ${nome ?? "chi ti ha invitato"}`}
      </button>
      {stato === "errore" && <p role="alert" className="mt-2 text-center text-sm text-error">Non ci sono riuscito: riprova.</p>}
    </div>
  );
}
