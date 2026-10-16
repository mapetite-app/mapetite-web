"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { trackFeature } from "@/lib/track";

// "Condividi": l'immagine PNG della carta con la condivisione del telefono (Instagram, WhatsApp…).
// Dove non si possono condividere file (computer, alcuni browser) l'immagine si scarica.
export default function CartaGustoCondividi() {
  const [stato, setStato] = useState<"pronto" | "attendi" | "scaricata" | "errore">("pronto");

  async function condividi() {
    setStato("attendi");
    try {
      const res = await fetch("/profilo/gusto/immagine", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const file = new File([blob], "carta-del-gusto-mapetite.png", { type: "image/png" });
      const text = "La mia carta del gusto su Mapetite";
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "Mapetite", text });
          trackFeature("carta_gusto_condividi", { contesto: "condivisa" });
        } catch (e) {
          // L'utente ha chiuso il foglio di condivisione: nessun errore da mostrare.
          trackFeature("carta_gusto_condividi", { contesto: (e as Error)?.name === "AbortError" ? "annullata" : "errore" });
        }
        setStato("pronto");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      trackFeature("carta_gusto_condividi", { contesto: "scaricata" });
      setStato("scaricata");
    } catch {
      trackFeature("carta_gusto_condividi", { contesto: "errore" });
      setStato("errore");
    }
  }

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={condividi}
        disabled={stato === "attendi"}
        data-testid="carta-condividi"
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-pill bg-accent px-5 font-display text-base font-semibold text-white active:scale-[0.98] transition-transform duration-150 disabled:opacity-70"
      >
        <Share2 size={18} strokeWidth={2} aria-hidden />
        {stato === "attendi" ? "Preparo l’immagine…" : "Condividi"}
      </button>
      <p aria-live="polite" data-testid="carta-condividi-esito" className="mt-2 min-h-5 text-center text-xs text-text-muted">
        {stato === "scaricata" && "Immagine salvata: pubblicala dove vuoi."}
        {stato === "errore" && "Non sono riuscito a preparare l’immagine. Riprova tra poco."}
      </p>
    </div>
  );
}
