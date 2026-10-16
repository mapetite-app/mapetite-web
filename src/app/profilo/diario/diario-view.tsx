"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Pencil } from "lucide-react";
import { getCategoryEmoji } from "@/lib/emoji";
import { categoryLabel } from "@/lib/category-label";
import { cityFromAddress } from "@/lib/city";
import { dayParts, groupByMonth, votoOf, withVoto } from "@/lib/diario";
import { saveVisit, type VisitPatch } from "@/lib/diario-write";
import { trackFeature } from "@/lib/track";
import type { DiaryEntry } from "@/lib/diario-server";
import DiarioFoglio, { type DiarioValori } from "@/components/diario-foglio";

// "Il mio diario" (piano 4.4): i posti provati per mese, dal più recente, con voto e nota.
// Un tocco sul nome apre la scheda; la matita apre il foglio per cambiare data, voto e nota.
export default function DiarioView({ userId, initial, withDate }: { userId: string; initial: DiaryEntry[]; withDate: boolean }) {
  const [entries, setEntries] = useState(initial);
  const [editing, setEditing] = useState<DiaryEntry | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const groups = useMemo(() => groupByMonth(entries), [entries]);
  const liked = entries.filter((e) => votoOf(e.tags) === "su").length;

  const save = async (e: DiaryEntry, v: DiarioValori): Promise<boolean> => {
    const patch: VisitPatch = {};
    const tags = withVoto(e.tags, v.voto);
    if (votoOf(e.tags) !== v.voto) patch.tags = tags;
    if ((e.note ?? "") !== v.note) patch.note = v.note || null;
    if (withDate && e.date !== v.date) patch.visited_at = v.date;
    if (Object.keys(patch).length > 0) {
      const res = await saveVisit(userId, e.id, patch);
      if (res === "errore") return false;
      setEntries((list) => list.map((x) => (x.id === e.id ? { ...x, tags, note: v.note || null, date: res === "ok" && withDate ? v.date : x.date } : x)));
    }
    trackFeature("diario", { fonte: "diario", stato: "modifica", voto: v.voto ?? "nessuno" });
    setSaved(e.name);
    setEditing(null);
    return true;
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-4">
      <Link href="/profilo" className="-ml-2 inline-flex min-h-10 items-center gap-0.5 px-2 text-sm font-display font-semibold text-brand">
        <ChevronLeft size={18} aria-hidden /> Profilo
      </Link>
      <header className="mt-1">
        <p className="text-xs font-display font-semibold uppercase tracking-wide text-accent">I posti dove sei stato</p>
        <h1 className="mt-0.5 font-title text-3xl font-semibold leading-tight text-brand">Il mio diario</h1>
        {entries.length > 0 && (
          <p data-testid="diario-riepilogo" className="mt-1 text-sm text-text-muted">
            {entries.length} {entries.length === 1 ? "posto provato" : "posti provati"}
            {liked > 0 && ` · ${liked} ti ${liked === 1 ? "è piaciuto" : "sono piaciuti"}`}
          </p>
        )}
      </header>

      {saved && <p role="status" className="mt-3 rounded-btn bg-success/10 px-3 py-2 text-sm text-success">✓ Diario aggiornato: {saved}.</p>}

      {entries.length === 0 ? (
        <div data-testid="diario-vuoto" className="mt-6 rounded-card border border-border bg-surface px-5 py-8 text-center">
          <span aria-hidden className="text-5xl">📔</span>
          <p className="mt-3 font-display text-lg font-semibold text-text">Il tuo diario è ancora vuoto</p>
          <p className="mx-auto mt-1.5 max-w-xs text-sm text-text-muted">
            Quando segni <span className="font-semibold text-text">✓ Ci sono stato</span> su un locale, lo ritrovi qui con la data, il tuo voto e una nota tua.
          </p>
          <div className="mt-5 flex flex-col items-center gap-2">
            <Link href="/mappa?vista=salvati" className="inline-flex min-h-11 items-center rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white">
              Apri i tuoi salvati
            </Link>
            <Link href="/mappa" className="inline-flex min-h-11 items-center px-4 text-sm font-display font-semibold text-brand">
              Cerca un locale
            </Link>
          </div>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.key} data-testid="diario-mese" className="mt-6">
            <h2 className="mb-2 flex items-baseline justify-between gap-2 border-b border-border pb-1.5">
              <span className="font-title text-xl font-semibold text-brand">{withDate ? g.label : "I tuoi posti provati"}</span>
              <span className="shrink-0 text-xs font-display text-text-muted">{g.items.length}</span>
            </h2>
            <ul className="divide-y divide-border">
              {g.items.map((e) => {
                const voto = votoOf(e.tags);
                const city = cityFromAddress(e.address);
                const cat = categoryLabel(e.category);
                const when = e.date ? dayParts(e.date) : null;
                return (
                  <li key={e.id} data-testid="diario-voce" className="flex items-start gap-3 py-3">
                    {withDate && (
                      <span aria-hidden className="flex w-9 shrink-0 flex-col items-center pt-0.5 text-center leading-none">
                        {when ? (
                          <>
                            <span className="font-title text-xl font-semibold text-text">{when.day}</span>
                            <span className="mt-0.5 text-[11px] font-display uppercase text-text-muted">{when.month}</span>
                          </>
                        ) : (
                          <span className="text-lg text-border">·</span>
                        )}
                      </span>
                    )}
                    <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn bg-accent-light text-2xl">
                      {getCategoryEmoji(e.category, e.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link href={`/mappa?salvato=${e.id}`} data-testid="diario-locale" className="block truncate font-display text-[15px] font-semibold text-text">
                        {e.name}
                      </Link>
                      <p className="truncate text-xs text-text-muted">{[cat, city].filter(Boolean).join(" · ") || "Locale"}</p>
                      {voto && (
                        <span data-testid="diario-voto-badge" className={`mt-1 inline-flex rounded-pill px-2 py-0.5 text-xs font-display font-semibold ${voto === "su" ? "bg-accent-light text-accent" : "bg-surface text-text-muted"}`}>
                          {voto === "su" ? "👍 Mi è piaciuto" : "👎 Non fa per me"}
                        </span>
                      )}
                      {e.note && <p data-testid="diario-nota-testo" className="mt-1 text-sm italic text-text [overflow-wrap:anywhere]">“{e.note}”</p>}
                      {withDate && !e.date && (
                        <button type="button" onClick={() => setEditing(e)} className="mt-0.5 min-h-9 text-xs font-display font-semibold text-accent">
                          + Aggiungi la data
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      data-testid="diario-modifica"
                      onClick={() => setEditing(e)}
                      aria-label={`Modifica ${e.name} nel diario`}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text-muted active:bg-surface"
                    >
                      <Pencil size={16} aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      {editing && (
        <DiarioFoglio
          place={editing}
          initial={{ date: editing.date, voto: votoOf(editing.tags), note: editing.note }}
          withDate={withDate}
          mode="modifica"
          onSave={(v) => save(editing, v)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
