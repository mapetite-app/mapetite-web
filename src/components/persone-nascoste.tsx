"use client";

import { useState } from "react";
import { trackFeature } from "@/lib/track";
import type { PersonaNascosta } from "@/lib/moderazione-server";

// Proposta 82, minore (24/11): Impostazioni → "Persone nascoste". Chi ha toccato "Non mostrarmi più i
// contenuti di…" può tornare indietro. Il nome c'è solo per i profili pubblici; gli altri restano
// "Un membro di Mapetite", come nelle recensioni.

const giorno = (iso: string) => new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "long", timeZone: "Europe/Rome" });

export default function PersoneNascoste({ iniziali }: { iniziali: PersonaNascosta[] }) {
  const [righe, setRighe] = useState(iniziali);
  const [busy, setBusy] = useState<string | null>(null);
  const [errore, setErrore] = useState<{ chiave: string; testo: string } | null>(null);

  async function mostra(chiave: string) {
    if (busy) return;
    setBusy(chiave);
    setErrore(null);
    try {
      const r = await fetch("/api/moderazione", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ azione: "mostra", chiave }) });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!r.ok || !j?.ok) throw new Error(j?.error ?? "Non ci sono riuscito. Riprova tra poco.");
      trackFeature("contenuto_mostrato");
      setRighe((rs) => rs.filter((x) => x.chiave !== chiave));
    } catch (e) {
      setErrore({ chiave, testo: e instanceof Error ? e.message : "Non ci sono riuscito. Riprova tra poco." });
    } finally {
      setBusy(null);
    }
  }

  if (righe.length === 0) {
    return <p data-testid="nascosti-vuoto" className="text-sm font-sans text-text-muted">Nessuna persona nascosta. Rivedi le loro recensioni e foto.</p>;
  }
  return (
    <div data-testid="persone-nascoste">
      <p className="text-sm font-sans text-text-muted">Non vedi le loro recensioni e foto.</p>
      <ul className="mt-2 divide-y divide-border">
        {righe.map((p) => (
          <li key={p.chiave} data-testid="persona-nascosta" className="py-2.5">
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-sans text-[15px] font-medium text-text">{p.nome ?? "Un membro di Mapetite"}</span>
                <span className="block text-xs text-text-muted">Nascosta il {giorno(p.quando)}</span>
              </span>
              <button
                type="button"
                onClick={() => mostra(p.chiave)}
                disabled={busy !== null}
                aria-label={`Mostra di nuovo ${p.nome ?? "questo membro"}`}
                className="inline-flex min-h-11 shrink-0 items-center rounded-pill border border-border bg-white px-3.5 font-display text-sm font-semibold text-brand active:scale-95 disabled:opacity-60"
              >
                {busy === p.chiave ? "Un attimo…" : "Mostra di nuovo"}
              </button>
            </div>
            {errore?.chiave === p.chiave && <p role="alert" className="mt-1 text-xs font-sans text-red-700">{errore.testo}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
