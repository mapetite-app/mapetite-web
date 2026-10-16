"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { browserClient } from "@/lib/supabase/client-lazy";
import { getCategoryEmoji } from "@/lib/emoji";
import { useOptIn } from "@/lib/beta";
import { track, trackFeature } from "@/lib/track";
import { dayKey, withVoto } from "@/lib/diario";
import { saveVisit } from "@/lib/diario-write";
import DiarioFoglio from "@/components/diario-foglio";

// "Ci sei stato?" (?beta=ci-sei-stato): nel profilo, un locale "📌 Voglio andarci" salvato da
// più di una settimana. Un tocco lo segna "✓ Ci sono stato". Le visite sono il segnale di gusto
// più forte (VISIONE.md), ma oggi quasi nessuno le segna da solo. Stessi tag di sempre,
// nessuna migrazione; "Non ancora" lo nasconde per 30 giorni (solo su questo telefono).
export type VisitCandidate = { id: string; name: string; category: string | null; tags: string[]; savedAt: string; note?: string | null };

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

export default function VisitPrompt({ userId, candidates, withDate = false }: { userId: string; candidates: VisitCandidate[]; withDate?: boolean }) {
  const on = useOptIn("ci-sei-stato");
  const [queue, setQueue] = useState<VisitCandidate[] | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  // Diario (4.4): dopo "Sì" il foglio "Com'è andata?" (data, voto, nota), saltabile.
  const [diary, setDiary] = useState<VisitCandidate | null>(null);

  useEffect(() => {
    const s = snoozed();
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    setTimeout(() => setQueue(candidates.filter((c) => new Date(c.savedAt).getTime() <= weekAgo && !(s[c.id] && now - s[c.id] < SNOOZE_MS))), 0);
  }, [candidates]);

  if (!on || queue === null) return null;
  const current = queue[0];
  const foglio = diary && (
    <DiarioFoglio
      place={diary}
      initial={{ date: dayKey(new Date()), voto: null, note: diary.note ?? null }}
      withDate={withDate}
      mode="nuova"
      onSave={async (v) => {
        const res = await saveVisit(userId, diary.id, { tags: withVoto(diary.tags, v.voto), ...(v.note !== (diary.note ?? "") ? { note: v.note || null } : {}), ...(withDate ? { visited_at: v.date } : {}) });
        if (res === "errore") return false;
        trackFeature("diario", { fonte: "ci-sei-stato", stato: "nuova", voto: v.voto ?? "nessuno" });
        setDiary(null);
        return true;
      }}
      onClose={() => { trackFeature("diario", { fonte: "ci-sei-stato", stato: "saltato" }); setDiary(null); }}
      foto={{ userId, placeId: diary.id, contesto: "ci-sei-stato" }}
    />
  );
  if (!current && !done) return foglio || null;

  const next = () => setQueue((q) => (q ?? []).slice(1));

  const yes = async () => {
    if (!current || busy) return;
    setBusy(true);
    setError(false);
    const tags = [...current.tags.filter((t) => t !== WANT && t !== DONE), DONE];
    // Senza rete il codice di Supabase potrebbe non essere ancora scaricato: errore, non pulsante bloccato.
    const client = await browserClient().catch(() => null);
    if (!client) { setBusy(false); setError(true); return; }
    const { error: err } = await client.from("saved_places").update({ tags }).eq("user_id", userId).eq("place_id", current.id);
    setBusy(false);
    if (err) { setError(true); return; }
    track("ci_sono_stato", { id: current.id }, { fonte: "ci-sei-stato" });
    setDone(current.name);
    setDiary({ ...current, tags });
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
      {foglio}
    </section>
  );
}
