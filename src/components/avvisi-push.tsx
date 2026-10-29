"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { accendiPush, chiavePubblica, spegniPush, statoPush, type PushStato } from "@/lib/push-client";
import { trackFeature } from "@/lib/track";

// Avvisi push (proposta 6). Due forme:
//  - "invito": sotto "Quando ci vai?" appena scelto il giorno, il momento in cui l'avviso serve
//    ("🔔 Avvisami quel giorno"); sparisce se gli avvisi sono già accesi o non disponibili;
//  - "riga": nel profilo, per accenderli o spegnerli.
// Senza chiavi VAPID sul server non compare niente.
export default function AvvisiPush({ forma, contesto }: { forma: "invito" | "riga"; contesto: string }) {
  const [stato, setStato] = useState<PushStato | null>(null);
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [appenaAcceso, setAppenaAcceso] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const key = await chiavePubblica();
      const s = key ? await statoPush().catch(() => "non_supportato" as const) : null;
      if (alive) setStato(s);
    })();
    return () => { alive = false; };
  }, []);

  if (!stato || stato === "non_supportato") return null;

  const accendi = async () => {
    setBusy(true);
    setErrore(null);
    try {
      await accendiPush();
      setStato("acceso");
      setAppenaAcceso(true);
      trackFeature("avvisi_push", { stato: "acceso", contesto });
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Non sono riuscito ad accendere gli avvisi.");
      setStato(await statoPush().catch(() => "spento" as const));
      trackFeature("avvisi_push", { stato: "rifiutato", contesto });
    } finally {
      setBusy(false);
    }
  };
  const spegni = async () => {
    setBusy(true);
    try {
      await spegniPush();
      setStato("spento");
      trackFeature("avvisi_push", { stato: "spento", contesto });
    } finally {
      setBusy(false);
    }
  };

  if (forma === "invito") {
    if (stato === "acceso" && !appenaAcceso) return null;
    // Permesso negato: il pulsante sparisce, ma il perché si legge (dal collaudo del 29/10).
    if (stato === "negato" && !errore) return null;
    return (
      <div className="mt-2" data-testid="avvisi-invito">
        {stato === "acceso" ? (
          <p className="text-xs text-text-muted" data-testid="avvisi-acceso">🔔 Te lo ricordo quel giorno nel pomeriggio.</p>
        ) : stato === "ios_da_installare" ? (
          <p className="text-xs text-text-muted">🔔 Per gli avvisi su iPhone aggiungi Mapetite alla schermata Home (Condividi → Aggiungi alla schermata Home).</p>
        ) : stato === "negato" ? null : (
          <button type="button" onClick={accendi} disabled={busy} data-testid="avvisi-accendi" className="inline-flex min-h-11 items-center gap-1.5 rounded-pill border border-border bg-white px-4 text-sm font-display font-semibold text-brand disabled:opacity-60">
            <Bell aria-hidden className="h-4 w-4" strokeWidth={2} /> Avvisami quel giorno
          </button>
        )}
        {errore && <p className="mt-1.5 text-xs text-error">{errore}</p>}
      </div>
    );
  }

  const acceso = stato === "acceso";
  return (
    <div className="border-t border-border" data-testid="avvisi-riga">
      <button
        type="button"
        role="switch"
        aria-checked={acceso}
        disabled={busy || stato === "negato" || stato === "ios_da_installare"}
        onClick={acceso ? spegni : accendi}
        className="flex min-h-14 w-full items-center gap-3 px-4 text-left font-display text-sm font-semibold text-text active:bg-surface disabled:opacity-80"
      >
        <Bell aria-hidden className="h-5 w-5 text-brand" strokeWidth={1.75} />
        <span className="flex-1">
          Avvisi
          <span className="block text-xs font-sans font-normal text-text-muted">
            {stato === "negato" ? "Bloccati nelle impostazioni del telefono"
              : stato === "ios_da_installare" ? "Su iPhone: prima aggiungi Mapetite alla schermata Home"
              : "Il giorno in cui hai deciso di andarci"}
          </span>
        </span>
        <span aria-hidden className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${acceso ? "bg-brand" : "bg-border"}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${acceso ? "left-[18px]" : "left-0.5"}`} />
        </span>
      </button>
      {errore && <p className="px-4 pb-3 text-xs text-error">{errore}</p>}
    </div>
  );
}
