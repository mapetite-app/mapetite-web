"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { cityFromAddress, displayAddress } from "@/lib/city";
import { replaceTag } from "@/lib/tags";
import { getCategoryEmoji } from "@/lib/emoji";
import { useOptIn } from "@/lib/beta";
import { checkCollectionName, collectionPath, summarizeCollections } from "@/lib/raccolte";
import { updateTags } from "@/lib/raccolte-write";
import RaccoltaCopertina from "@/components/raccolta-copertina";

// Un salvato dell'utente: placeId è l'UUID Supabase di places (non il Place ID Google).
export type RaccoltaRow = { placeId: string; name: string; address: string | null; category?: string | null; tags: string[] };

type Sheet =
  | { kind: "menu"; tag: string }
  | { kind: "rinomina"; tag: string }
  | { kind: "unisci"; tag: string }
  | { kind: "elimina"; tag: string }
  | { kind: "nuova" };

const plural = (n: number) => `${n} ${n === 1 ? "locale" : "locali"}`;

// "Le tue raccolte" nel profilo: le raccolte sono i tag dei salvati (esclusi i due di stato),
// mostrate come cartelle (piano 4.1) che aprono la pagina della raccolta (/raccolte/<nome>).
// Qui si possono rinominare, unire, eliminare e crearne di nuove scegliendo tra i salvati.
// Ogni modifica è un update per riga su saved_places con la sessione dell'utente (come la scheda).
export default function ProfiloRaccolte({ userId, initialRows }: { userId: string; initialRows: RaccoltaRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const busy = progress !== null;

  const covers = useOptIn("copertine");
  // Cartelle: nome, numero di locali e i primi locali (i più recenti) per la copertina.
  const summaries = useMemo(() => summarizeCollections(rows), [rows]);
  const collections = useMemo(() => summaries.map((c) => [c.name, c.count] as const), [summaries]);
  const allTags = useMemo(() => [...new Set(rows.flatMap((r) => r.tags))], [rows]);

  const open = (next: Sheet) => {
    setError(null);
    setNotice(null);
    setName(next.kind === "rinomina" ? next.tag : "");
    setQuery("");
    setPicked(new Set());
    setSheet(next);
  };
  const close = () => { if (!busy) setSheet(null); };

  // Applica "change" a ogni salvato toccato, una riga alla volta, e aggiorna subito l'elenco.
  // Ritorna il numero di righe non aggiornate (0 = tutto ok).
  async function apply(targets: RaccoltaRow[], change: (tags: string[]) => string[]): Promise<number> {
    setError(null);
    setProgress({ done: 0, total: targets.length });
    const failed = await updateTags(userId, targets, change, (placeId, tags, done) => {
      if (tags) setRows((prev) => prev.map((r) => (r.placeId === placeId ? { ...r, tags } : r)));
      setProgress({ done, total: targets.length });
    });
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
  const checkName = (raw: string, current?: string) => checkCollectionName(raw, allTags, current);

  async function rename(from: string) {
    const res = checkName(name, from);
    if ("error" in res) { setError(res.error); return; }
    if (res.tag === from) { setSheet(null); return; }
    const failed = await apply(withTag(from), (tags) => replaceTag(tags, from, res.tag));
    if (failed === 0) setNotice(allTags.includes(res.tag) ? `“${from}” è confluita in “${res.tag}”.` : `Raccolta rinominata in “${res.tag}”.`);
  }

  async function merge(from: string, into: string) {
    const failed = await apply(withTag(from), (tags) => replaceTag(tags, from, into));
    if (failed === 0) setNotice(`“${from}” è confluita in “${into}”.`);
  }

  async function remove(tag: string) {
    const failed = await apply(withTag(tag), (tags) => tags.filter((t) => t !== tag));
    if (failed === 0) setNotice(`Raccolta “${tag}” eliminata. I locali restano tra i salvati.`);
  }

  async function create() {
    const res = checkName(name);
    if ("error" in res) { setError(res.error); return; }
    if (picked.size === 0) { setError("Scegli almeno un locale."); return; }
    const targets = rows.filter((r) => picked.has(r.placeId) && !r.tags.includes(res.tag));
    const failed = await apply(targets, (tags) => [...tags, res.tag]);
    if (failed === 0) setNotice(`Raccolta “${res.tag}” pronta: ${plural(picked.size)}.`);
  }

  // Salvati per la scelta in "Nuova raccolta": filtro per nome/indirizzo, raggruppati per città.
  const pickGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const groups = new Map<string, RaccoltaRow[]>();
    for (const r of rows) {
      if (q && !`${r.name} ${r.address ?? ""}`.toLowerCase().includes(q)) continue;
      const city = cityFromAddress(r.address) ?? "Altre zone";
      groups.set(city, [...(groups.get(city) ?? []), r]);
    }
    return [...groups.entries()].sort((a, b) =>
      a[0] === "Altre zone" ? 1 : b[0] === "Altre zone" ? -1 : b[1].length - a[1].length || a[0].localeCompare(b[0], "it"),
    );
  }, [rows, query]);

  const progressText = progress && `Aggiorno ${progress.done} di ${plural(progress.total)}…`;
  const sheetTitle =
    sheet?.kind === "nuova" ? "Nuova raccolta"
      : sheet?.kind === "rinomina" ? "Rinomina raccolta"
      : sheet?.kind === "unisci" ? `Unisci “${sheet.tag}” con…`
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
      <ul className="grid grid-cols-2 gap-3">
        {summaries.map((c) => (
          <li key={c.name} className="relative">
            <Link
              href={collectionPath(c.name)}
              data-testid="raccolta"
              className="block h-full active:scale-[0.98] transition-transform duration-150"
            >
              <RaccoltaCopertina
                name={c.name}
                count={c.count}
                covers={covers}
                emojis={c.preview.map((row) => getCategoryEmoji(row.category ?? null, row.name))}
                names={c.preview.slice(0, 3).map((row) => row.name)}
              />
            </Link>
            <button
              type="button"
              data-testid="raccolta-menu"
              aria-label={`Gestisci la raccolta ${c.name}`}
              onClick={() => open({ kind: "menu", tag: c.name })}
              className="absolute bottom-1 right-0 flex h-11 w-10 items-center justify-center text-lg leading-none text-text-muted active:text-brand"
            >
              ⋯
            </button>
          </li>
        ))}
        {rows.length > 0 && (
          <li className="flex">
            <button
              type="button"
              data-testid="nuova-raccolta"
              onClick={() => open({ kind: "nuova" })}
              className="flex h-full min-h-[160px] w-full flex-col items-center justify-center gap-2 rounded-card border border-dashed border-brand/40 p-3 text-center text-brand active:scale-[0.98] transition-transform duration-150"
            >
              <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-light font-title text-2xl font-semibold text-accent">+</span>
              <span className="font-display text-sm font-semibold">Nuova raccolta</span>
            </button>
          </li>
        )}
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
                <input id="raccolta-nome" autoFocus maxLength={24} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
                <p className="text-xs text-text-muted">Cambia su tutti i {plural(withTag(sheet.tag).length)}. Se scegli il nome di un&apos;altra raccolta, le due si uniscono.</p>
                <button type="submit" disabled={busy || !name.trim()} className={primary}>{busy ? progressText : "Salva"}</button>
              </form>
            )}

            {sheet.kind === "unisci" && (
              <div className="flex min-h-0 flex-col gap-2">
                <p className="text-sm text-text-muted">I locali di “{sheet.tag}” passano nella raccolta che scegli; “{sheet.tag}” sparisce.</p>
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
                  La raccolta <strong>“{sheet.tag}”</strong> sparisce dai tuoi {plural(withTag(sheet.tag).length)}.
                  I locali restano tra i tuoi salvati, con le loro note.
                </p>
                <button type="button" data-testid="conferma-elimina" disabled={busy} onClick={() => void remove(sheet.tag)} className={`${primary} bg-error`}>
                  {busy ? progressText : "Sì, elimina la raccolta"}
                </button>
                <button type="button" disabled={busy} onClick={() => open({ kind: "menu", tag: sheet.tag })} className={secondary}>Annulla</button>
              </div>
            )}

            {sheet.kind === "nuova" && (
              <form onSubmit={(e) => { e.preventDefault(); void create(); }} className="flex min-h-0 flex-col gap-3">
                <input
                  aria-label="Nome della raccolta"
                  placeholder="Nome (es. Weekend a Napoli)"
                  autoFocus
                  maxLength={24}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                />
                <input
                  type="search"
                  aria-label="Cerca tra i salvati"
                  placeholder="🔎 Cerca tra i tuoi salvati"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className={`${inputClass} min-h-11 bg-surface text-sm`}
                />
                <div className="min-h-0 flex-1 overflow-y-auto" data-testid="nuova-raccolta-lista">
                  {pickGroups.length === 0 && <p className="py-4 text-center text-sm text-text-muted">Nessun salvato con questo nome.</p>}
                  {pickGroups.map(([city, list]) => (
                    <div key={city} className="mb-3">
                      <p className="mb-1.5 text-xs font-display font-semibold uppercase tracking-wider text-text-muted">📍 {city} · {list.length}</p>
                      <ul className="space-y-1.5">
                        {list.map((r) => {
                          const on = picked.has(r.placeId);
                          return (
                            <li key={r.placeId}>
                              <label className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-card border px-3 py-2 ${on ? "border-brand bg-brand/5" : "border-border"}`}>
                                <input
                                  type="checkbox"
                                  checked={on}
                                  onChange={() => setPicked((prev) => { const n = new Set(prev); if (n.has(r.placeId)) n.delete(r.placeId); else n.add(r.placeId); return n; })}
                                  className="h-5 w-5 shrink-0 accent-[var(--color-brand)]"
                                />
                                <span className="min-w-0">
                                  <span className="block truncate font-display text-sm font-semibold text-text">{r.name}</span>
                                  {r.address && <span className="block truncate text-xs text-text-muted">{displayAddress(r.address)}</span>}
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
                <button type="submit" data-testid="crea-raccolta" disabled={busy || !name.trim() || picked.size === 0} className={primary}>
                  {busy ? progressText : picked.size === 0 ? "Scegli i locali" : `Crea raccolta · ${plural(picked.size)}`}
                </button>
              </form>
            )}

            {error && <p role="alert" data-testid="raccolte-errore" className="mt-3 text-sm text-error">{error}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
