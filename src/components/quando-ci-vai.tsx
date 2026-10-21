"use client";

import { useState } from "react";
import { browserClient } from "@/lib/supabase/client-lazy";
import { oggiRoma, sabatoDi } from "@/lib/stasera";
import { trackFeature } from "@/lib/track";

// "Quando ci vai?" appena salvato (proposta 17, PROBLEMI.md n. 9: si salva e non si va mai).
// Un tocco mette un giorno nel salvato (saved_places.piano_al): quel giorno il locale va in cima a
// "Stasera dove andiamo?". Toccato di nuovo, il giorno si toglie. Nessuna notifica, nessun costo.
type Scelta = "stasera" | "weekend";

export default function QuandoCiVai({ userId, placeId }: { userId: string; placeId: string }) {
  const [scelta, setScelta] = useState<Scelta | null>(null);
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState(false);

  const scegli = async (s: Scelta) => {
    const next = scelta === s ? null : s;
    const oggi = oggiRoma();
    const giorno = next === "stasera" ? oggi : next === "weekend" ? sabatoDi(oggi) : null;
    setBusy(true);
    setErrore(false);
    try {
      const client = await browserClient();
      const { error } = await client.from("saved_places").update({ piano_al: giorno }).eq("user_id", userId).eq("place_id", placeId);
      if (error) throw error;
      setScelta(next);
      trackFeature("quando_ci_vai", { scelta: next ?? "tolto" });
    } catch {
      setErrore(true);
    } finally {
      setBusy(false);
    }
  };

  const chip = (s: Scelta, label: string) => (
    <button
      type="button"
      onClick={() => scegli(s)}
      disabled={busy}
      aria-pressed={scelta === s}
      data-testid={`quando-${s}`}
      className={`inline-flex min-h-11 items-center rounded-pill px-4 text-sm font-display font-semibold disabled:opacity-60 ${scelta === s ? "bg-accent text-white" : "border border-border bg-white text-brand"}`}
    >
      {scelta === s ? `✓ ${label}` : label}
    </button>
  );

  return (
    <div className="mt-3" data-testid="quando-ci-vai">
      <p className="text-sm font-semibold text-text">Quando ci vai?</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {chip("stasera", "Stasera")}
        {chip("weekend", "Nel weekend")}
      </div>
      {scelta && <p className="mt-2 text-xs text-text-muted" data-testid="quando-detto">Te lo ripropongo in cima a «Stasera dove andiamo?».</p>}
      {errore && <p className="mt-2 text-xs text-error">Non sono riuscito a segnarlo: riprova.</p>}
    </div>
  );
}
