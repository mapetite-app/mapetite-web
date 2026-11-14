"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { nuovoInvito } from "@/app/amici/actions";
import { trackFeature } from "@/lib/track";

// "Nuovo link" sotto il proprio link d'invito (revisore 14/11, terzo giro): se il link è girato troppo se ne
// fa uno nuovo e il vecchio smette di funzionare. Discreto, e con una conferma: chi ha già il link lo perde.
export default function NuovoLink({ chiaro = false }: { chiaro?: boolean }) {
  const router = useRouter();
  const [stato, setStato] = useState<"idle" | "conferma" | "salvo" | "fatto" | "errore">("idle");
  const testo = chiaro ? "text-text-muted" : "text-white/70";
  if (stato === "fatto") return <p data-testid="nuovo-link-fatto" role="status" className={`relative mt-1 text-center text-xs font-sans ${testo}`}>Fatto: il link di prima non funziona più.</p>;
  if (stato === "conferma" || stato === "salvo") {
    return (
      <div data-testid="nuovo-link-conferma" className={`relative mt-1 flex flex-wrap items-center justify-center gap-x-2 text-xs font-sans ${testo}`}>
        <span>Il link di prima smetterà di funzionare.</span>
        <button
          type="button"
          data-testid="nuovo-link-si"
          disabled={stato === "salvo"}
          onClick={async () => {
            setStato("salvo");
            const codice = await nuovoInvito().catch(() => null);
            trackFeature("invito_nuovo_link", { stato: codice ? "ok" : "errore" });
            if (!codice) { setStato("errore"); return; }
            setStato("fatto");
            router.refresh();
          }}
          className={`min-h-11 px-1 font-semibold underline underline-offset-2 ${chiaro ? "text-brand" : "text-white"}`}
        >
          {stato === "salvo" ? "Un attimo…" : "Crea il nuovo link"}
        </button>
        <button type="button" onClick={() => setStato("idle")} className="min-h-11 px-1">Annulla</button>
      </div>
    );
  }
  return (
    <div className="relative mt-1 flex justify-center">
      <button type="button" data-testid="nuovo-link" onClick={() => setStato("conferma")} className={`min-h-11 px-2 text-xs font-sans underline underline-offset-2 ${testo}`}>
        {stato === "errore" ? "Non ci sono riuscito: riprova" : "Nuovo link"}
      </button>
    </div>
  );
}
