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
import { grantedPosition, readLastView } from "@/lib/last-view";
import { distanceMeters } from "@/lib/distance";
import { ZONA_METERS } from "@/lib/salvati-zone";

// "Ci sei stato?" (?beta=ci-sei-stato): nel profilo, un locale "📌 Da provare" (anche senza stato) salvato da
// più di una settimana. Un tocco lo segna "✓ Ci sono stato". Le visite sono il segnale di gusto
// più forte (VISIONE.md), ma oggi quasi nessuno le segna da solo. Stessi tag di sempre,
// nessuna migrazione; "Non ancora" lo nasconde per 30 giorni (solo su questo telefono).
export type VisitCandidate = { id: string; name: string; category: string | null; tags: string[]; savedAt: string; note?: string | null; lat?: number; lng?: number };

// Revisore 2/11: proponeva un locale di Milano a chi era a Roma. Si propongono solo i posti entro 30 km
// da dove sei (posizione già permessa), o dall'ultima vista della mappa se è su una città (non sull'Italia
// intera), o dalla zona con più salvati. Nessuno vicino: niente riquadro.
const VICINO_METERS = ZONA_METERS;
const ZOOM_CITTA = 9;

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

export default function VisitPrompt({ userId, candidates, withDate = false, casa = null }: { userId: string; candidates: VisitCandidate[]; withDate?: boolean; casa?: { lat: number; lng: number } | null }) {
  const on = useOptIn("ci-sei-stato");
  const [queue, setQueue] = useState<VisitCandidate[] | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  // Diario (4.4): dopo "Sì" il foglio "Com'è andata?" (data, voto, nota), saltabile.
  const [diary, setDiary] = useState<VisitCandidate | null>(null);

  useEffect(() => {
    let alive = true;
    const s = snoozed();
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    void (async () => {
      const last = readLastView();
      const qui = (await grantedPosition()) ?? (last && last.zoom >= ZOOM_CITTA ? last : null) ?? casa;
      const vicino = (c: VisitCandidate) => !qui || (c.lat != null && c.lng != null && distanceMeters(qui, { lat: c.lat, lng: c.lng }) <= VICINO_METERS);
      if (alive) setQueue(candidates.filter((c) => new Date(c.savedAt).getTime() <= weekAgo && !(s[c.id] && now - s[c.id] < SNOOZE_MS) && vicino(c)));
    })();
    return () => { alive = false; };
  }, [candidates, casa]);

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

  // Una riga compatta (~64 px, revisore 1/11): prima era un riquadro corallo alto 160 px, il più vistoso del profilo.
  return (
    <section data-testid="ci-sei-stato" aria-label="Ci sei stato?" className="mb-6 rounded-card border border-border bg-white px-3 py-2.5">
      {done && (
        <p role="status" className={current ? "sr-only" : "text-sm font-sans text-success"}>✓ Segnato: sei stato da {done}.</p>
      )}
      {current ? (
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-btn bg-surface text-xl">
            {getCategoryEmoji(current.category, current.name)}
          </span>
          <span className="min-w-0 flex-1">
            {error ? (
              <span role="alert" className="block truncate text-[11px] font-semibold text-error">Non riuscito. Riprova.</span>
            ) : (
              <span className="block truncate text-[11px] font-display font-semibold uppercase tracking-wide text-text-muted" title={`L'hai salvato ${weeksAgo(current.savedAt)}`}>Ci sei stato?</span>
            )}
            <Link href={`/mappa?salvato=${current.id}`} className="block truncate font-sans text-[15px] font-medium leading-tight text-text">
              {current.name}
            </Link>
          </span>
          <button
            type="button"
            onClick={() => void yes()}
            disabled={busy}
            aria-label="Sì, ci sono stato"
            className="flex min-h-11 shrink-0 items-center active:scale-95 disabled:opacity-60"
          >
            <span className="flex h-8 items-center rounded-pill bg-brand px-3.5 text-[13px] font-display font-semibold text-white">Sì</span>
          </button>
          <button
            type="button"
            onClick={notYet}
            className="flex min-h-11 shrink-0 items-center active:scale-95"
          >
            <span className="flex h-8 items-center rounded-pill border border-border px-3 text-[13px] font-display font-semibold text-brand">Non ancora</span>
          </button>
        </div>
      ) : (
        null
      )}
      {foglio}
    </section>
  );
}
