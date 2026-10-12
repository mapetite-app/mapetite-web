"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getCategoryEmoji } from "@/lib/emoji";
import { useOptIn } from "@/lib/beta";
import { track } from "@/lib/track";

// "Ci sei stato?" (?beta=ci-sei-stato): nel profilo, un locale "📌 Voglio andarci" salvato da
// più di una settimana. Un tocco lo segna "✓ Ci sono stato". Le visite sono il segnale di gusto
// più forte (VISIONE.md), ma oggi quasi nessuno le segna da solo. Stessi tag di sempre,
// nessuna migrazione; "Non ancora" lo nasconde per 30 giorni (solo su questo telefono).
export type VisitCandidate = { id: string; name: string; category: string | null; tags: string[]; savedAt: string };

const WANT = "Da provare";
const DONE = "Già visitato";
const SNOOZE_KEY = "mapetite.ci-sei-stato";
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;

function snoozed(): Record<string, number> {
  try {
    const v = JSON.parse(localStorage.getItem(SNOOZE_KEY) ?? "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

function weeksAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 14) return "una settimana fa";
  if (days < 60) return `${Math.floor(days / 7)} settimane fa`;
  return `${Math.floor(days / 30)} mesi fa`;
}

export default function VisitPrompt({ userId, candidates }: { userId: string; candidates: VisitCandidate[] }) {
  const on = useOptIn("ci-sei-stato");
  const [queue, setQueue] = useState<VisitCandidate[] | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const s = snoozed();
    const now = Date.now();
    setTimeout(() => setQueue(candidates.filter((c) => !(s[c.id] && now - s[c.id] < SNOOZE_MS))), 0);
  }, [candidates]);

  if (!on || queue === null) return null;
  const current = queue[0];
  if (!current && !done) return null;

  const next = () => setQueue((q) => (q ?? []).slice(1));

  const yes = async () => {
    if (!current || busy) return;
    setBusy(true);
    setError(false);
    const tags = [...current.tags.filter((t) => t !== WANT && t !== DONE), DONE];
    const { error: err } = await createClient().from("saved_places").update({ tags }).eq("user_id", userId).eq("place_id", current.id);
    setBusy(false);
    if (err) { setError(true); return; }
    track("ci_sono_stato", { id: current.id }, { fonte: "ci-sei-stato" });
    setDone(current.name);
    next();
  };

  const notYet = () => {
    if (!current) return;
    try { localStorage.setItem(SNOOZE_KEY, JSON.stringify({ ...snoozed(), [current.id]: Date.now() })); } catch { /* niente */ }
    next();
  };

  return (
    <section data-testid="ci-sei-stato" className="mb-8 rounded-card border border-accent/30 bg-accent-light/60 p-4">
      {done && (
        <p role="status" className="mb-2 text-sm font-sans text-success">✓ Segnato: sei stato da {done}.</p>
      )}
      {current ? (
        <>
          <p className="text-xs font-display font-semibold uppercase tracking-wide text-accent">Ci sei stato?</p>
          <div className="mt-2 flex items-center gap-3">
            <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn bg-white text-2xl">
              {getCategoryEmoji(current.category, current.name)}
            </span>
            <span className="min-w-0">
              <Link href={`/mappa?salvato=${current.id}`} className="block truncate font-display text-base font-semibold text-text">
                {current.name}
              </Link>
              <span className="block text-xs text-text-muted">L&apos;hai salvato {weeksAgo(current.savedAt)}</span>
            </span>
          </div>
          {error && <p role="alert" className="mt-2 text-sm text-error">Non sono riuscito a segnarlo. Riprova.</p>}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void yes()}
              disabled={busy}
              className="min-h-11 flex-1 rounded-pill bg-brand px-4 text-sm font-display font-semibold text-white active:scale-95 disabled:opacity-60"
            >
              ✓ Sì, ci sono stato
            </button>
            <button
              type="button"
              onClick={notYet}
              className="min-h-11 rounded-pill border border-border bg-white px-4 text-sm font-display font-semibold text-brand active:scale-95"
            >
              Non ancora
            </button>
          </div>
        </>
      ) : (
        <p className="text-sm text-text-muted">Per ora è tutto: i tuoi salvati sono aggiornati.</p>
      )}
    </section>
  );
}
