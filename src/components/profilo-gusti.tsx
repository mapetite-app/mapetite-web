"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { gustoDa, type Zona } from "@/lib/gusti";
import { caricaGusti, caricaZonaAbituale, dimenticaGusto, gustiRicordati, subscribeGusti } from "@/lib/gusti-store";
import { trackFeature } from "@/lib/track";

const NONE: string[] = [];

// "Cosa so di te" (piano 1.4): i gusti che l'assistente ricorda, ognuno cancellabile con un tocco,
// e la zona abituale ricavata dai salvati (solo informazione: non si salva da nessuna parte).
export default function ProfiloGusti({ userId }: { userId: string }) {
  const ids = useSyncExternalStore(subscribeGusti, gustiRicordati, () => NONE);
  const [zona, setZona] = useState<Zona | null>(null);
  useEffect(() => {
    let alive = true;
    void caricaGusti(userId);
    caricaZonaAbituale(userId).then((z) => { if (alive) setZona(z); }, () => {});
    return () => { alive = false; };
  }, [userId]);
  const gusti = ids.flatMap((id) => { const g = gustoDa(id); return g ? [g] : []; });

  return (
    <section id="cosa-so-di-te" data-testid="cosa-so-di-te" className="mb-6 scroll-mt-20 rounded-card border border-border bg-surface px-4 py-4">
      <h2 className="font-display text-base font-semibold text-brand">Cosa so di te</h2>
      {gusti.length === 0 ? (
        <p className="mt-1 text-sm font-sans leading-relaxed text-text-muted">
          Ancora niente. Scrivilo all’<Link href="/assistente" className="font-semibold text-accent">assistente</Link>, per esempio “sono vegetariano” o “evito i posti rumorosi”: ti chiede prima di ricordarlo.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm font-sans text-text-muted">L’assistente ne tiene conto in ogni ricerca. Tocca per dimenticare.</p>
          <ul className="mt-2.5 flex flex-wrap gap-2">
            {gusti.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  data-testid="gusto-ricordato"
                  onClick={() => { void dimenticaGusto(userId, g.id); trackFeature("assistente_memoria", { contesto: "dimentica" }); }}
                  aria-label={`Dimentica “${g.label}”`}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-pill border border-border bg-white px-3.5 text-sm font-sans font-semibold text-brand active:scale-95"
                >
                  {g.label} <X size={14} aria-hidden className="text-text-muted" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {zona && (
        <p data-testid="cosa-so-zona" className="mt-3 text-sm font-sans text-text-muted">
          📍 Salvi spesso a <span className="font-semibold text-text">{zona.nome}</span>: se non scrivi una zona, l’assistente ti propone di cercare lì.
        </p>
      )}
    </section>
  );
}
