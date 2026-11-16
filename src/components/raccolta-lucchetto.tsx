"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Lock } from "lucide-react";
import { cambiaRaccoltePrivate } from "@/lib/raccolte-private";
import { trackFeature } from "@/lib/track";

// Lucchetto "Solo per me" su una raccolta intera (resto della proposta 59): stesso interruttore del singolo
// posto. Vale anche per i posti aggiunti dopo; un posto che sta qui sparisce da profilo e mappa degli amici
// anche se sta in altre raccolte.
export default function RaccoltaLucchetto({ userId, name, initial, className = "mt-3" }: { userId: string; name: string; initial: boolean; className?: string }) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function toggle() {
    const next = !on;
    setOn(next);
    setBusy(true);
    setError(false);
    const ok = await cambiaRaccoltePrivate(userId, (nomi) => (next ? [...nomi, name] : nomi.filter((n) => n !== name)));
    setBusy(false);
    if (!ok) { setOn(!next); setError(true); return; }
    trackFeature("raccolta_modifica", { contesto: next ? "lucchetto" : "lucchetto_tolto" });
    router.refresh();
  }

  return (
    <div className={className}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={busy}
        data-testid="raccolta-solo-per-me"
        onClick={() => void toggle()}
        className="flex min-h-11 w-full items-center gap-3 rounded-btn border border-border bg-white px-3 py-2 text-left disabled:opacity-70"
      >
        <Lock size={16} aria-hidden className={`shrink-0 ${on ? "text-brand" : "text-text-muted"}`} />
        <span className="min-w-0 flex-1">
          <span className="block font-display text-sm font-semibold text-brand">Solo per me</span>
          <span className="block text-xs font-sans text-text-muted">{on ? "Nascosta agli amici, anche i posti che aggiungi" : "Tutta la raccolta fuori dal profilo e dalla mappa degli amici"}</span>
        </span>
        <span aria-hidden className={`relative h-6 w-10 shrink-0 rounded-pill transition-colors ${on ? "bg-brand" : "bg-border"}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
        </span>
      </button>
      {error && <p role="alert" data-testid="raccolta-solo-errore" className="mt-1 text-xs text-error">Non sono riuscito a cambiarlo: controlla la connessione e riprova.</p>}
    </div>
  );
}
