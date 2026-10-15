"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { replaceTag } from "@/lib/tags";
import { checkCollectionName, collectionPath, placesLabel } from "@/lib/raccolte";
import { updateTags } from "@/lib/raccolte-write";
import { trackFeature } from "@/lib/track";

// "⋯" nella pagina di una raccolta: rinomina, unisci con un'altra, elimina. Stessa scrittura
// del profilo (updateTags: un update per salvato, tag riletti prima di scrivere).
type Mode = "menu" | "rinomina" | "unisci" | "elimina";

export default function RaccoltaAzioni({
  userId,
  name,
  rows,
  allTags,
  others,
}: {
  userId: string;
  name: string;
  rows: { placeId: string; tags: string[] }[]; // i salvati di questa raccolta
  allTags: string[]; // tutti i tag usati dall'utente (per riconoscere un nome già esistente)
  others: { name: string; count: number }[]; // le altre raccolte (per "Unisci con…")
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(null);
  const [text, setText] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = (m: Mode) => { setError(null); setText(name); setMode(m); };
  const close = () => { if (!busy) setMode(null); };

  async function run(change: (tags: string[]) => string[], then: string, contesto: "rinomina" | "unisci" | "elimina") {
    setBusy(true);
    setError(null);
    const failed = await updateTags(userId, rows, change);
    setBusy(false);
    if (failed > 0) {
      setError(`Non sono riuscito ad aggiornare ${placesLabel(failed)}: controlla la connessione e riprova.`);
      return;
    }
    trackFeature("raccolta_modifica", { contesto });
    setMode(null);
    router.replace(then);
    router.refresh();
  }

  const rename = () => {
    const res = checkCollectionName(text, allTags, name);
    if ("error" in res) { setError(res.error); return; }
    if (res.tag === name) { setMode(null); return; }
    void run((tags) => replaceTag(tags, name, res.tag), collectionPath(res.tag), "rinomina");
  };

  const primary = "flex min-h-12 w-full items-center justify-center rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white disabled:opacity-40 active:scale-[0.99]";
  const secondary = "flex min-h-12 w-full items-center justify-center rounded-pill border border-border px-5 text-sm font-display font-semibold text-brand active:scale-[0.99] disabled:opacity-40";
  const title = mode === "rinomina" ? "Rinomina raccolta" : mode === "unisci" ? `Unisci “${name}” con…` : mode === "elimina" ? "Eliminare la raccolta?" : name;

  return (
    <>
      <button
        type="button"
        data-testid="raccolta-pagina-menu"
        aria-label={`Gestisci la raccolta ${name}`}
        onClick={() => open("menu")}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-white text-brand active:scale-95"
      >
        <MoreHorizontal size={20} aria-hidden />
      </button>
      {mode && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center" data-testid="raccolta-pagina-sheet">
          <button type="button" aria-label="Chiudi" onClick={close} className="absolute inset-0 bg-black/40" />
          <div role="dialog" aria-modal="true" aria-label={title} className="relative flex max-h-[88dvh] w-full max-w-2xl flex-col rounded-t-[24px] bg-white px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3 shadow-float">
            <span aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="min-w-0 truncate font-title text-lg font-semibold text-brand">{title}</h3>
              <button type="button" onClick={close} disabled={busy} className="min-h-10 shrink-0 text-sm font-display font-semibold text-text-muted disabled:opacity-40">Chiudi</button>
            </div>
            {mode === "menu" && (
              <div className="flex flex-col gap-2">
                <button type="button" onClick={() => open("rinomina")} className={secondary}>✏️ Rinomina</button>
                <button type="button" onClick={() => open("unisci")} disabled={others.length === 0} className={secondary}>🔗 Unisci con…</button>
                <button type="button" onClick={() => open("elimina")} className={`${secondary} text-error`}>🗑 Elimina raccolta</button>
              </div>
            )}
            {mode === "rinomina" && (
              <form onSubmit={(e) => { e.preventDefault(); rename(); }} className="flex flex-col gap-3">
                <label className="text-sm text-text-muted" htmlFor="raccolta-pagina-nome">Nuovo nome</label>
                <input id="raccolta-pagina-nome" autoFocus maxLength={24} value={text} onChange={(e) => setText(e.target.value)} className="w-full min-h-12 rounded-card border border-border bg-white px-4 text-base text-text focus:border-brand focus:outline-none" />
                <p className="text-xs text-text-muted">Se scegli il nome di un&apos;altra raccolta, le due si uniscono.</p>
                <button type="submit" disabled={busy || !text.trim()} className={primary}>{busy ? "Aggiorno…" : "Salva"}</button>
              </form>
            )}
            {mode === "unisci" && (
              <ul className="min-h-0 space-y-2 overflow-y-auto">
                {others.map((o) => (
                  <li key={o.name}>
                    <button
                      type="button"
                      data-testid="raccolta-pagina-unisci"
                      disabled={busy}
                      onClick={() => void run((tags) => replaceTag(tags, name, o.name), collectionPath(o.name), "unisci")}
                      className="flex min-h-14 w-full items-center gap-3 rounded-card border border-border bg-surface px-3 text-left active:scale-[0.99] disabled:opacity-40"
                    >
                      <span className="min-w-0 flex-1 truncate font-display text-sm font-semibold text-text">{o.name}</span>
                      <span className="shrink-0 text-xs text-text-muted">{placesLabel(o.count)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {mode === "elimina" && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-text">
                  La raccolta <strong>“{name}”</strong> sparisce dai tuoi {placesLabel(rows.length)}. I locali restano tra i tuoi salvati, con le loro note.
                </p>
                <button type="button" data-testid="raccolta-pagina-elimina" disabled={busy} onClick={() => void run((tags) => tags.filter((t) => t !== name), "/profilo", "elimina")} className={`${primary} bg-error`}>
                  {busy ? "Aggiorno…" : "Sì, elimina la raccolta"}
                </button>
                <button type="button" disabled={busy} onClick={() => open("menu")} className={secondary}>Annulla</button>
              </div>
            )}
            {error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}
