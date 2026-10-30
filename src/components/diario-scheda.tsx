"use client";

import { useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { browserClient } from "@/lib/supabase/client-lazy";
import { cleanDate, dayKey, isMissingVisitedAt, visiteDi, whenLabel } from "@/lib/diario";
import { saveVisit } from "@/lib/diario-write";
import { VisitaContext } from "@/lib/visita-context";
import { track, trackFeature } from "@/lib/track";
import DiarioFoglio, { type DiarioValori } from "@/components/diario-foglio";
import OmaggioScheda from "@/components/omaggio-scheda";
import { visitaVistaQui } from "@/lib/visita-vista";

// Nella scheda di un locale segnato "Ci sono stato" (piano 4.4): quando ci sei stato e il link
// al diario. Appena toccato "✓ Ci sono stato" apre il foglio "Com'è andata?" (saltabile).
// Senza la colonna visited_at (migrazione 20261015_diario non applicata) il foglio chiede solo
// il voto e la riga della data non compare.
// "Ci sono tornato" (PROPOSTE.md 8): conta le visite in saved_places.visite; senza la colonna
// (migrazione 20261020b_visite non applicata) il pulsante non compare.
// "Visita vista dal telefono" (PROPOSTE.md 28): al tocco su "Ci sono stato" / "Ci sono tornato", se il
// permesso di posizione c'è già e il telefono è entro 150 m dal locale, si salva l'ora in
// saved_places.visita_vista_al (mai la posizione). Senza la colonna non si mostra niente.
type Stato = { colonna: boolean; date: string | null; visite: number | null; vista: string | null };

export default function DiarioScheda({ userId, place, coords = null }: { userId: string; place: { id: string; name: string; category: string | null }; coords?: { lat: number; lng: number } | null }) {
  const ctx = useContext(VisitaContext);
  const [stato, setStato] = useState<Stato | null>(null);
  const [open, setOpen] = useState<"nuova" | "modifica" | null>(null);
  const [tornato, setTornato] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = await browserClient().catch(() => null);
      if (!supabase) { if (alive) setStato({ colonna: false, date: null, visite: null, vista: null }); return; }
      const read = (cols: string) => supabase.from("saved_places").select(cols).eq("user_id", userId).eq("place_id", place.id).maybeSingle();
      let conVisite = true;
      let { data, error } = await read("visited_at, visite, visita_vista_al");
      if (error && /visita_vista_al/.test(error.message ?? "")) ({ data, error } = await read("visited_at, visite"));
      if (error && /\bvisite\b/.test(error.message ?? "")) { conVisite = false; ({ data, error } = await read("visited_at")); }
      if (!alive) return;
      if (error && !isMissingVisitedAt(error)) console.warn("[diario] lettura data fallita:", error.message);
      const row = data as { visited_at?: unknown; visite?: unknown; visita_vista_al?: unknown } | null;
      // La scheda compare solo sui locali "Ci sono stato": almeno una visita.
      setStato(error ? { colonna: false, date: null, visite: null, vista: null } : { colonna: true, date: cleanDate(row?.visited_at), visite: conVisite ? visiteDi(["Già visitato"], row?.visite) : null, vista: typeof row?.visita_vista_al === "string" ? row.visita_vista_al : null });
    })();
    return () => { alive = false; };
  }, [userId, place.id]);

  // Visita vista dal telefono: si guarda la posizione una volta, nel momento del tocco.
  // "Ci sono tornato": la posizione si guarda al tocco, ma la prova si scrive solo salvando il foglio.
  const vistaTornato = useRef<Promise<boolean> | null>(null);
  const guardaVisita = async () => {
    if (!(await visitaVistaQui(coords))) return false;
    const ora = new Date().toISOString();
    if ((await saveVisit(userId, place.id, { visita_vista_al: ora })) !== "ok") return false;
    setStato((s) => (s ? { ...s, vista: ora } : s));
    trackFeature("visita_vista", { contesto: "scheda" });
    return true;
  };

  // Appena segnato "Ci sono stato" in questa scheda: il foglio si apre una volta sola.
  const askedAt = ctx?.askedAt ?? null;
  useEffect(() => {
    if (!stato || askedAt == null || Date.now() - askedAt > 60_000) return;
    ctx?.consume();
    setTimeout(() => { void guardaVisita(); setOpen("nuova"); }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stato, askedAt, ctx]);

  const save = async (v: DiarioValori, mode: "nuova" | "modifica") => {
    if (tornato != null) {
      // "Ci sono tornato": la visita si conta solo qui, salvando il foglio ("Salta" non scrive niente).
      const date = v.date ?? dayKey(new Date());
      // La prova vale solo per una visita di oggi (il telefono non ha visto i giorni passati).
      const vista = date === dayKey(new Date()) && (await vistaTornato.current?.catch(() => false)) ? new Date().toISOString() : null;
      vistaTornato.current = null;
      let res = await saveVisit(userId, place.id, { visite: tornato, visited_at: date, ...(vista ? { visita_vista_al: vista } : {}) });
      // Colonna della prova non ancora creata: si salva la visita senza.
      if (res === "errore" && vista) res = await saveVisit(userId, place.id, { visite: tornato, visited_at: date });
      if (res === "errore") return false;
      setStato((s) => (s ? { ...s, visite: tornato, date: res === "ok" ? date : s.date, vista: vista ?? s.vista } : s));
      if (vista) trackFeature("visita_vista", { contesto: "tornato" });
      track("ci_sono_stato", { id: place.id }, { fonte: "tornato", visite: tornato });
      setTornato(null);
    } else if (stato?.colonna && v.date !== stato.date) {
      const res = await saveVisit(userId, place.id, { visited_at: v.date });
      if (res === "errore") return false;
      setStato((s) => (s ? { ...s, colonna: res === "ok", date: res === "ok" ? v.date : null } : s));
    }
    if (ctx && v.voto !== ctx.voto) ctx.setVoto(v.voto);
    trackFeature("diario", { fonte: tornato != null ? "tornato" : "scheda", stato: mode === "nuova" ? "nuova" : "modifica", voto: v.voto ?? "nessuno" });
    setOpen(null);
    return true;
  };

  // "↻ Ci sono tornato": apre lo stesso "Com'è andata?" con oggi; la visita si conta salvando.
  const torna = () => {
    if (!stato || stato.visite == null) return;
    vistaTornato.current = visitaVistaQui(coords);
    setTornato(stato.visite + 1);
    setOpen("nuova");
  };

  const close = () => {
    vistaTornato.current = null;
    if (open === "nuova") trackFeature("diario", { fonte: "scheda", stato: "saltato" });
    setOpen(null);
    setTornato(null);
  };

  if (!stato) return null;
  const today = dayKey(new Date());
  // "📍 sul posto" solo se il giorno della prova è il giorno della visita segnata (dal collaudo del 30/10).
  const sulPosto = !!stato.vista && !!stato.date && dayKey(new Date(stato.vista)) === stato.date;
  return (
    <>
      <div data-testid="diario-scheda" className="mt-3 flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {stato.colonna && (
          <button type="button" data-testid="diario-scheda-data" onClick={() => setOpen("modifica")} className="min-h-10 text-left font-sans text-text">
            <span aria-hidden>📅 </span>
            {stato.date
              ? <>Ci sei stato <span className="font-semibold">{whenLabel(stato.date)}</span>{stato.visite != null && stato.visite >= 2 && <span data-testid="diario-scheda-volte"> · {stato.visite} volte</span>} · <span className="font-display font-semibold text-accent">Cambia</span></>
              : <span className="font-display font-semibold text-accent">Quando ci sei stato?</span>}
          </button>
        )}
        {/* Non lo stesso giorno della visita già segnata: due tocchi non fanno due visite. */}
        {stato.visite != null && stato.date !== today && (
          <button type="button" data-testid="diario-scheda-tornato" onClick={torna} className="min-h-10 font-display font-semibold text-brand">
            ↻ Ci sono tornato
          </button>
        )}
        <Link href="/profilo/diario" data-testid="diario-scheda-link" className="ml-auto inline-flex min-h-10 items-center font-display font-semibold text-brand">
          📔 Diario →
        </Link>
      </div>
      {/* Riga a parte, con la spiegazione già scritta: a 390 px "Cambia" resta sulla riga della data (collaudo del 30/10). */}
      {sulPosto && (
        <p data-testid="diario-scheda-vista" className="-mt-1 font-sans text-xs text-text-muted">
          <span aria-hidden>📍 </span>Sul posto: il telefono era vicino al locale quando l&apos;hai segnato
        </p>
      )}
      <OmaggioScheda place={place} visite={stato.visite} coords={coords} />
      {open && (
        <DiarioFoglio
          place={place}
          initial={{ date: open === "nuova" ? (tornato != null ? today : stato.date ?? today) : stato.date, voto: ctx?.voto ?? null, note: ctx?.note ?? null }}
          withDate={stato.colonna}
          mode={open}
          volta={open === "nuova" && tornato != null ? tornato : undefined}
          onEditNote={ctx?.onEditNote ? () => { setOpen(null); ctx.onEditNote!(); } : undefined}
          onSave={(v) => save(v, open)}
          onClose={close}
          foto={{ userId, placeId: place.id, contesto: "scheda" }}
        />
      )}
    </>
  );
}
