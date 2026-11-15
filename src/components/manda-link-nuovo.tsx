"use client";

import { useState } from "react";
import CondividiLink from "@/components/condividi-link";
import { nuovoInvito } from "@/app/amici/actions";
import { invitePath } from "@/lib/invito";
import { trackFeature } from "@/lib/track";

// Chi aveva tolto l'amicizia e apre il link dell'altro ("tolto-da-te", revisore 15/11 settimo giro): prima il tasto
// portava al profilo, dove "Condividi" mandava il link VECCHIO (che non rifà amici) e il "Nuovo link" vero era una
// scritta piccola. Qui si crea il link nuovo con un tocco e con il secondo lo si manda (la condivisione del telefono
// vuole un tocco suo).
export default function MandaLinkNuovo({ nome, className }: { nome: string | null; className: string }) {
  const [codice, setCodice] = useState<string | null>(null);
  const [stato, setStato] = useState<"idle" | "salvo" | "errore">("idle");
  if (codice) {
    return (
      <div data-testid="manda-link-nuovo" className="mt-4">
        <CondividiLink
          path={invitePath(codice)}
          title="Mapetite"
          text={`Torniamo amici su Mapetite? Ecco il mio link.`}
          cosa="invito"
          label={`Manda il link a ${nome ?? "il tuo amico"}`}
          testId="manda-link-nuovo-condividi"
          className={`${className} border-0 bg-accent! text-white!`}
        />
        <p className="mt-2 text-center text-xs font-sans text-text-muted">Link nuovo creato: quello di prima non funziona più.</p>
      </div>
    );
  }
  return (
    <div className="mt-4">
      <button
        type="button"
        data-testid="invito-apri"
        disabled={stato === "salvo"}
        onClick={async () => {
          setStato("salvo");
          const c = await nuovoInvito().catch(() => null);
          trackFeature("invito_nuovo_link", { stato: c ? "ok" : "errore", contesto: "tolto_da_te" });
          if (!c) { setStato("errore"); return; }
          setCodice(c);
        }}
        className={className}
      >
        {stato === "salvo" ? "Un attimo…" : "Crea un link nuovo"}
      </button>
      <p className="mt-2 text-center text-xs font-sans text-text-muted">{stato === "errore" ? "Non ci sono riuscito: riprova." : "Il tuo link di prima smetterà di funzionare."}</p>
    </div>
  );
}
