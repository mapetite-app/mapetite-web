"use client";

import Link from "next/link";
import { trackFeature } from "@/lib/track";
import { gemmeLabel, livelloScopritore, type Gemme } from "@/lib/scopritori";

// Scopritori (piano 5.6): una riga compatta nel profilo. Toccandola si apre la spiegazione
// e quanto manca al livello dopo. Gioco leggero: nessun confronto, solo i propri numeri.
export function ScopritoreRiga({ gemme, provate }: Gemme) {
  const l = livelloScopritore({ gemme, provate });
  const progress = l.mancano == null ? 1 : l.punti / (l.punti + l.mancano);
  return (
    <details
      data-testid="scopritore-riga"
      className="group mt-3 rounded-card border border-border bg-white"
      onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open) trackFeature("scopritore_apri", { contesto: `livello-${l.livello}` }); }}
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-2 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="text-xl">💎</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-sm font-semibold text-brand">
            {l.livello === 0 ? "Diventa Scopritore" : `Scopritore · ${l.nome}`}
          </span>
          <span className="block truncate text-xs text-text-muted">
            {l.livello === 0 ? "Salva un posto 💎 poco conosciuto" : `${gemmeLabel(gemme)}${provate > 0 ? `, ${provate} ${provate === 1 ? "provato" : "provati"}` : ""}`}
          </span>
        </span>
        {l.livello > 0 && (
          <span data-testid="scopritore-livello" className="shrink-0 rounded-pill bg-accent-light px-2.5 py-0.5 font-display text-xs font-semibold text-accent">Liv. {l.livello}</span>
        )}
      </summary>
      <div className="border-t border-border px-4 pb-4 pt-3">
        <p className="text-sm text-text-muted">
          Conta i posti 💎 poco conosciuti che salvi: molto amati ma fuori dai giri di massa. Se ci vai, valgono doppio.
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-pill bg-surface" aria-hidden>
          <div className="h-full rounded-pill bg-accent" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <p data-testid="scopritore-mancano" className="mt-1.5 text-xs text-text-muted">
          {l.mancano == null ? "Livello massimo: sei un vero cacciatore di gemme." : `Ancora ${l.mancano} ${l.mancano === 1 ? "punto" : "punti"} per il livello ${l.livello + 1}.`}
        </p>
        <Link href="/sorprendimi" data-testid="scopritore-cerca" className="mt-3 inline-flex min-h-10 items-center text-sm font-display font-semibold text-accent">
          Scopri un posto poco conosciuto →
        </Link>
      </div>
    </details>
  );
}

// Badge da mettere accanto al nome (profilo pubblico, classifica amici). Niente se livello 0.
export function ScopritoreBadge({ gemme, provate }: Gemme) {
  const l = livelloScopritore({ gemme, provate });
  if (l.livello === 0) return null;
  return (
    <span data-testid="scopritore-badge" title={`${l.nome}: ${gemmeLabel(gemme)}`} className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-accent-light px-2.5 py-0.5 font-display text-xs font-semibold text-accent">
      💎 Scopritore · liv. {l.livello}
    </span>
  );
}
