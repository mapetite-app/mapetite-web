"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isStateTag, normalizeTagName, replaceTag } from "@/lib/tags";

// Un salvato dell'utente: placeId è l'UUID Supabase di places (non il Place ID Google).
export type RaccoltaRow = { placeId: string; name: string; address: string | null; tags: string[] };

type Sheet =
  | { kind: "menu"; tag: string }
  | { kind: "rinomina"; tag: string }
  | { kind: "unisci"; tag: string }
  | { kind: "elimina"; tag: string };

function savedHref(tag: string): string {
  return `/mappa?${new URLSearchParams({ vista: "salvati", tag }).toString()}`;
}

const plural = (n: number) => `${n} ${n === 1 ? "locale" : "locali"}`;

// "Le tue raccolte" nel profilo: le raccolte sono i tag dei salvati (esclusi i due di stato).
// Qui si possono rinominare, unire ed eliminare.
// Ogni modifica è un update per riga su saved_places con la sessione dell'utente (come la scheda).
export default function ProfiloRaccolte({ userId, initialRows }: { userId: string; initialRows: RaccoltaRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [name, setName] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const busy = progress !== null;

  const collections = useMemo(() => {
    const byTag = new Map<string, number>();
    for (const row of rows) {
      for (const tag of new Set(row.tags)) {
        if (isStateTag(tag) || !tag.trim()) continue;
        byTag.set(tag, (byTag.get(tag) ?? 0) + 1);
      }
    }
    return [...byTag.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "it"));
  }, [rows]);
  const allTags = useMemo(() => [...new Set(rows.flatMap((r) => r.tags))], [rows]);

  const open = (next: Sheet) => {
    setError(null);
    setNotice(null);
    setName(next.kind === "rinomina" ? next.tag : "");
    setSheet(next);
  };
  const close = () => { if (!busy) setSheet(null); };

  // Applica "change" a ogni salvato toccato, una riga alla volta, e aggiorna subito l'elenco.
  // Ritorna il numero di righe non aggiornate (0 = tutto ok).
  async function apply(targets: RaccoltaRow[], change: (tags: string[]) => string[]): Promise<number> {
    const supabase = createClient();
    let failed = 0;
    setError(null);
    setProgress({ done: 0, total: targets.length });
    for (const [i, row] of targets.entries()) {
      const next = change(row.tags);
      const { error: err } = await supabase
        .from("saved_places")
        .update({ tags: next.length > 0 ? next : null })
        .eq("user_id", userId)
        .eq("place_id", row.placeId);
      if (err) failed++;
      else setRows((prev) => prev.map((r) => (r.placeId === row.placeId ? { ...r, tags: next } : r)));
      setProgress({ done: i + 1, total: targets.length });
    }
    setProgress(null);
    if (failed > 0) {
      setError(`Non sono riuscito ad aggiornare ${plural(failed)}: controlla la connessione e riprova.`);
    } else {
      setSheet(null);
    }
    router.refresh();
    return failed;
  }

  const withTag = (tag: string) => rows.filter((r) => r.tags.includes(tag));

  // Nome scritto → nome definitivo, oppure messaggio d'errore.
  function checkName(raw: string, current?: string): { tag: string } | { error: string } {
    const tag = normalizeTagName(raw, allTags.filter((t) => t !== current));
    if (!tag) return { error: "Scrivi un nome per la raccolta." };
    if (isStateTag(tag)) return { error: "Questo nome è già usato per lo stato del locale (Voglio andarci / Ci sono stato): scegline un altro." };
    return { tag };
  }

  async function rename(from: string) {
    const res = checkName(name, from);
    if ("error" in res) { setError(res.error); return; }
    if (res.tag === from) { setSheet(null); return; }
    const failed = await apply(withTag(from), (tags) => replaceTag(tags, from, res.tag));
    if (failed === 0) setNotice(allTags.includes(res.tag) ? `"${from}" è confluita in "${res.tag}".` : `Raccolta rinominata in "${res.tag}".`);
  }

  async function merge(from: string, into: string) {
    const failed = await apply(withTag(from), (tags) => replaceTag(tags, from, into));
    if (failed === 0) setNotice(`"${from}" è confluita in "${into}".`);
  }

  async function remove(tag: string) {
    const failed = await apply(withTag(tag), (tags) => tags.filter((t) => t !== tag));
    if (failed === 0) setNotice(`Raccolta "${tag}" eliminata. I locali restano tra i salvati.`);
  }

  const progressText = progress && `Aggiorno ${progress.done} di ${plural(progress.total)}…`;
  const sheetTitle =
    sheet?.kind === "rinomina" ? "Rinomina raccolta"
      : sheet?.kind === "unisci" ? `Unisci "${sheet.tag}" con…`
      : sheet?.kind === "elimina" ? "Eliminare la raccolta?"
      : sheet ? sheet.tag : "";

  const primary = "flex min-h-12 w-full items-center justify-center rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white disabled:opacity-40 active:scale-[0.99]";
  const secondary = "flex min-h-12 w-full items-center justify-center rounded-pill border border-border px-5 text-sm font-display font-semibold text-brand active:scale-[0.99]";
  const inputClass = "w-full min-h-12 rounded-card border border-border bg-white px-4 text-base text-text placeholder:text-text-muted focus:border-brand focus:outline-none";

  return (
    <section className="mb-10" data-testid="raccolte">
      <h2 className="mb-3 font-title text-xl font-semibold text-brand">Le tue raccolte</h2>
      {notice && (
        <p role="status" data-testid="raccolte-avviso" className="mb-3 rounded-card bg-accent-light px-4 py-2.5 text-sm text-brand">
          {notice}
        </p>
      )}
      {collections.length === 0 && (
        <p data-testid="raccolte-vuote" className="mb-2 rounded-card border border-dashed border-border p-4 text-sm text-text-muted">
          Raggruppa i tuoi salvati per occasione o per viaggio (es. Romantico, Con amici, Weekend a Napoli): ogni raccolta è un tag.
        </p>
      )}
      <ul className="grid grid-cols-2 gap-2">
        {collections.map(([tag, count]) => (
          <li key={tag} className="relative">
            <Link
              href={savedHref(tag)}
              data-testid="raccolta"
              className="flex min-h-[72px] items-center gap-3 rounded-card bg-brand py-3 pl-3 pr-10 text-white shadow-card active:scale-[0.98] transition-transform duration-150"
            >
              <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent font-title text-base font-semibold text-white">
                {tag.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-display text-sm font-semibold">{tag}</span>
                <span className="block text-xs text-white/75">{plural(count)}</span>
              </span>
            </Link>
            <button
              type="button"
              data-testid="raccolta-menu"
              aria-label={`Gestisci la raccolta ${tag}`}
              onClick={() => open({ kind: "menu", tag })}
              className="absolute right-0 top-0 flex h-11 w-10 items-center justify-center rounded-tr-card text-lg leading-none text-white/80 active:text-white"
            >
              ⋯
            </button>
          </li>
        ))}
      </ul>

      {sheet && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center" data-testid="raccolte-sheet">
          <button type="button" aria-label="Chiudi" onClick={close} className="absolute inset-0 bg-black/40" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={sheetTitle}
            className="relative flex max-h-[88dvh] w-full max-w-2xl flex-col rounded-t-[24px] bg-white px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3 shadow-float"
          >
            <span aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="min-w-0 truncate font-title text-lg font-semibold text-brand">{sheetTitle}</h3>
              <button type="button" onClick={close} disabled={busy} className="min-h-10 shrink-0 text-sm font-display font-semibold text-text-muted disabled:opacity-40">
                Chiudi
              </button>
            </div>

            {sheet.kind === "menu" && (
              <div className="flex flex-col gap-2">
                <p className="mb-1 text-sm text-text-muted">{plural(withTag(sheet.tag).length)} in questa raccolta.</p>
                <button type="button" onClick={() => open({ kind: "rinomina", tag: sheet.tag })} className={secondary}>✏️ Rinomina</button>
                <button type="button" onClick={() => open({ kind: "unisci", tag: sheet.tag })} disabled={collections.length < 2} className={`${secondary} disabled:opacity-40`}>
                  🔗 Unisci con…
                </button>
                <button type="button" onClick={() => open({ kind: "elimina", tag: sheet.tag })} className={`${secondary} text-error`}>🗑 Elimina raccolta</button>
              </div>
            )}

            {sheet.kind === "rinomina" && (
              <form onSubmit={(e) => { e.preventDefault(); void rename(sheet.tag); }} className="flex flex-col gap-3">
                <label className="text-sm text-text-muted" htmlFor="raccolta-nome">Nuovo nome</label>
                <input id="raccolta-nome" autoFocus maxLength={40} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
                <p className="text-xs text-text-muted">Cambia su tutti i {plural(withTag(sheet.tag).length)}. Se scegli il nome di un&apos;altra raccolta, le due si uniscono.</p>
                <button type="submit" disabled={busy || !name.trim()} className={primary}>{busy ? progressText : "Salva"}</button>
              </form>
            )}

            {sheet.kind === "unisci" && (
              <div className="flex min-h-0 flex-col gap-2">
                <p className="text-sm text-text-muted">I locali di &quot;{sheet.tag}&quot; passano nella raccolta che scegli; &quot;{sheet.tag}&quot; sparisce.</p>
                <ul className="min-h-0 space-y-2 overflow-y-auto">
                  {collections.filter(([t]) => t !== sheet.tag).map(([t, n]) => (
                    <li key={t}>
                      <button
                        type="button"
                        data-testid="unisci-in"
                        disabled={busy}
                        onClick={() => void merge(sheet.tag, t)}
                        className="flex min-h-14 w-full items-center gap-3 rounded-card border border-border bg-surface px-3 text-left active:scale-[0.99] disabled:opacity-40"
                      >
                        <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand font-title text-sm font-semibold text-white">{t.charAt(0).toUpperCase()}</span>
                        <span className="min-w-0 flex-1 truncate font-display text-sm font-semibold text-text">{t}</span>
                        <span className="shrink-0 text-xs text-text-muted">{plural(n)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {busy && <p role="status" className="text-sm text-brand">{progressText}</p>}
              </div>
            )}

            {sheet.kind === "elimina" && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-text">
                  La raccolta <strong>&quot;{sheet.tag}&quot;</strong> sparisce dai tuoi {plural(withTag(sheet.tag).length)}.
                  I locali restano tra i tuoi salvati, con le loro note.
                </p>
                <button type="button" data-testid="conferma-elimina" disabled={busy} onClick={() => void remove(sheet.tag)} className={`${primary} bg-error`}>
                  {busy ? progressText : "Sì, elimina la raccolta"}
                </button>
                <button type="button" disabled={busy} onClick={() => open({ kind: "menu", tag: sheet.tag })} className={secondary}>Annulla</button>
              </div>
            )}

            {error && <p role="alert" data-testid="raccolte-errore" className="mt-3 text-sm text-error">{error}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
