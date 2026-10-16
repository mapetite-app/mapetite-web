"use client";

import { useContext, useEffect, useState } from "react";
import Link from "next/link";
import { browserClient } from "@/lib/supabase/client-lazy";
import { cleanDate, dayKey, isMissingVisitedAt, whenLabel } from "@/lib/diario";
import { saveVisit } from "@/lib/diario-write";
import { VisitaContext } from "@/lib/visita-context";
import { trackFeature } from "@/lib/track";
import DiarioFoglio, { type DiarioValori } from "@/components/diario-foglio";

// Nella scheda di un locale segnato "Ci sono stato" (piano 4.4): quando ci sei stato e il link
// al diario. Appena toccato "✓ Ci sono stato" apre il foglio "Com'è andata?" (saltabile).
// Senza la colonna visited_at (migrazione 20261015_diario non applicata) il foglio chiede solo
// il voto e la riga della data non compare.
type Stato = { colonna: boolean; date: string | null };

export default function DiarioScheda({ userId, place }: { userId: string; place: { id: string; name: string; category: string | null } }) {
  const ctx = useContext(VisitaContext);
  const [stato, setStato] = useState<Stato | null>(null);
  const [open, setOpen] = useState<"nuova" | "modifica" | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = await browserClient().catch(() => null);
      if (!supabase) { if (alive) setStato({ colonna: false, date: null }); return; }
      const { data, error } = await supabase.from("saved_places").select("visited_at").eq("user_id", userId).eq("place_id", place.id).maybeSingle();
      if (!alive) return;
      if (error && !isMissingVisitedAt(error)) console.warn("[diario] lettura data fallita:", error.message);
      setStato(error ? { colonna: false, date: null } : { colonna: true, date: cleanDate((data as { visited_at?: unknown } | null)?.visited_at) });
    })();
    return () => { alive = false; };
  }, [userId, place.id]);

  // Appena segnato "Ci sono stato" in questa scheda: il foglio si apre una volta sola.
  const askedAt = ctx?.askedAt ?? null;
  useEffect(() => {
    if (!stato || askedAt == null || Date.now() - askedAt > 60_000) return;
    ctx?.consume();
    setTimeout(() => setOpen("nuova"), 0);
  }, [stato, askedAt, ctx]);

  const save = async (v: DiarioValori, mode: "nuova" | "modifica") => {
    if (stato?.colonna && v.date !== stato.date) {
      const res = await saveVisit(userId, place.id, { visited_at: v.date });
      if (res === "errore") return false;
      setStato((s) => (s ? { colonna: res === "ok", date: res === "ok" ? v.date : null } : s));
    }
    if (ctx && v.voto !== ctx.voto) ctx.setVoto(v.voto);
    trackFeature("diario", { fonte: "scheda", stato: mode === "nuova" ? "nuova" : "modifica", voto: v.voto ?? "nessuno" });
    setOpen(null);
    return true;
  };

  const close = () => {
    if (open === "nuova") trackFeature("diario", { fonte: "scheda", stato: "saltato" });
    setOpen(null);
  };

  if (!stato) return null;
  const today = dayKey(new Date());
  return (
    <>
      <div data-testid="diario-scheda" className="mt-3 flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {stato.colonna && (
          <button type="button" data-testid="diario-scheda-data" onClick={() => setOpen("modifica")} className="min-h-10 text-left font-sans text-text">
            <span aria-hidden>📅 </span>
            {stato.date
              ? <>Ci sei stato <span className="font-semibold">{whenLabel(stato.date)}</span> · <span className="font-display font-semibold text-accent">Cambia</span></>
              : <span className="font-display font-semibold text-accent">Quando ci sei stato?</span>}
          </button>
        )}
        <Link href="/profilo/diario" data-testid="diario-scheda-link" className="ml-auto inline-flex min-h-10 items-center font-display font-semibold text-brand">
          📔 Diario →
        </Link>
      </div>
      {open && (
        <DiarioFoglio
          place={place}
          initial={{ date: open === "nuova" ? stato.date ?? today : stato.date, voto: ctx?.voto ?? null, note: ctx?.note ?? null }}
          withDate={stato.colonna}
          mode={open}
          onEditNote={ctx?.onEditNote ? () => { setOpen(null); ctx.onEditNote!(); } : undefined}
          onSave={(v) => save(v, open)}
          onClose={close}
          foto={{ userId, placeId: place.id, contesto: "scheda" }}
        />
      )}
    </>
  );
}
