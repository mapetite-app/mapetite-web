"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { accendiPush, chiavePubblica, statoPush, type PushStato } from "@/lib/push-client";
import { trackFeature } from "@/lib/track";

// "Avvisami quando c'è posto" su un salvato (PROPOSTE.md 72). Solo nei salvati di un locale VERIFICATO
// (solo il titolare può dire "c'è posto") e solo se gli avvisi push esistono sul server (chiavi VAPID):
// senza, non compare niente. Il primo tocco accende anche gli avvisi del telefono, se spenti.
// L'avviso parte quando il titolare segna giorni nuovi con posto; mai stimato.
export default function AvvisoPosto({ venueId }: { venueId: string }) {
  const [push, setPush] = useState<PushStato | null>(null);
  const [attivo, setAttivo] = useState<{ id: string; on: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const key = await chiavePubblica();
      if (!key) return;
      const s = await statoPush().catch(() => "non_supportato" as const);
      const r = await fetch(`/api/avvisi-posto?id=${encodeURIComponent(venueId)}`).then((x) => (x.ok ? x.json() : null)).catch(() => null);
      if (!vivo) return;
      setPush(s);
      setAttivo({ id: venueId, on: r?.attivo === true });
    })();
    return () => { vivo = false; };
  }, [venueId]);

  if (!push || push === "non_supportato" || attivo?.id !== venueId) return null;
  const on = attivo.on;

  const cambia = async () => {
    setBusy(true);
    setErrore(null);
    try {
      if (!on && push !== "acceso") {
        await accendiPush();
        setPush("acceso");
      }
      const res = await fetch("/api/avvisi-posto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: venueId, attivo: !on }) });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof j?.error === "string" ? j.error : "Non ci sono riuscito: riprova.");
      setAttivo({ id: venueId, on: !on });
      trackFeature("avviso_posto", { stato: on ? "spento" : "acceso" });
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Non ci sono riuscito: riprova.");
      setPush(await statoPush().catch(() => "spento" as const));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="avviso-posto" className="mt-2">
      {push === "ios_da_installare" ? (
        <p className="text-xs text-text-muted">🔔 Per sapere quando c&apos;è posto, su iPhone aggiungi Mapetite alla schermata Home.</p>
      ) : push === "negato" && !on ? (
        <p className="text-xs text-text-muted">🔔 Avvisi bloccati nelle impostazioni del telefono.</p>
      ) : on ? (
        <p className="flex min-h-11 items-center gap-1.5 text-sm font-sans text-text-muted">
          <Bell size={14} className="shrink-0 text-brand" aria-hidden />
          <span data-testid="avviso-posto-acceso" className="min-w-0 flex-1">Ti avviso quando il locale dice che c&apos;è posto</span>
          <button type="button" onClick={cambia} disabled={busy} data-testid="avviso-posto-togli" aria-label="Togli l'avviso" className="inline-flex min-h-11 min-w-11 items-center justify-center text-text-muted disabled:opacity-60">
            <BellOff size={16} aria-hidden />
          </button>
        </p>
      ) : (
        <button type="button" onClick={cambia} disabled={busy} data-testid="avviso-posto-accendi" className="inline-flex min-h-11 items-center gap-1.5 rounded-pill border border-border bg-white px-4 text-sm font-display font-semibold text-brand active:scale-[0.98] disabled:opacity-60">
          <Bell size={15} aria-hidden /> Avvisami quando c&apos;è posto
        </button>
      )}
      {errore && <p className="mt-1 text-xs text-error">{errore}</p>}
    </div>
  );
}
