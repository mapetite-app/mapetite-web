"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { browserClient } from "@/lib/supabase/client-lazy";
import { displayAddress } from "@/lib/city";
import { isStateTag } from "@/lib/tags";
import { checkCollectionName, collectionPath } from "@/lib/raccolte";
import { extractAllLinks, KIND_LABEL, saveLabel, type FoundLink } from "@/lib/multi-link";
import { trackFeature } from "@/lib/track";

// "Incolla più link" (piano 3.2, stile "Aggiungi qualsiasi cosa" di Albo): si incolla un testo con
// tanti link (la chat di WhatsApp con sé stessi, una nota), si vede lo stato di ciascuno e si
// salvano tutti i riconosciuti con un tocco, anche dentro una raccolta.
//
// Costi Google: i link di Google Maps passano da /api/places/link-preview uno alla volta, al massimo
// 2 insieme. Il tetto è MAX_CALLS chiamate per import: finite quelle, i link restano "da confermare"
// e si riconoscono con un tocco, uno per uno. Instagram, TikTok e YouTube non partono da soli:
// costano AI e una ricerca, quindi si aprono uno alla volta con il flusso già esistente.

const MAX_CALLS = 10;
const CONCURRENCY = 2;
const WANT_TAG = "Da provare";

type Stato =
  | "attesa" | "lavoro" | "riconosciuto" | "da_confermare" | "non_riconosciuto"
  | "gia_salvato" | "doppione" | "salvato" | "errore";

type Item = FoundLink & {
  stato: Stato;
  place?: { id: string; name: string; address: string };
  motivo?: string;
  nome?: string | null;
};

type Preview =
  | { stato: "riconosciuto"; chiamate: number; place: { id: string; name: string; address: string } }
  | { stato: "da_confermare"; chiamate: number; motivo: string; nome: string | null }
  | { stato: "non_riconosciuto"; chiamate: number; motivo: string };

async function previewLink(link: string, budget: number): Promise<Preview> {
  try {
    const res = await fetch("/api/places/link-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ link, budget }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.stato) {
      return { stato: "da_confermare", chiamate: 0, motivo: data?.error ?? "Non sono riuscito a leggerlo: riprova.", nome: null };
    }
    return data as Preview;
  } catch {
    return { stato: "da_confermare", chiamate: 0, motivo: "Errore di rete: riprova.", nome: null };
  }
}

// Esegue fn su ogni elemento con al massimo `n` richieste insieme.
async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await fn(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
}

const NEW_COLLECTION = "__nuova__";

export default function MultiLinkCard({
  userId,
  onScreenshot,
  onSearch,
  onReadVideo,
}: {
  userId: string | null;
  onScreenshot: () => void;
  onSearch: (q: string) => void;
  onReadVideo: (url: string) => void;
}) {
  const [text, setText] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);
  const [oltre, setOltre] = useState(0);
  const [phase, setPhase] = useState<"idle" | "reading" | "ready" | "saving" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [collections, setCollections] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [target, setTarget] = useState("");
  const [newName, setNewName] = useState("");
  const [savedCount, setSavedCount] = useState(0);
  const [savedInto, setSavedInto] = useState<string | null>(null);
  const savedIds = useRef<Set<string>>(new Set());
  const calls = useRef(0);

  const patch = (url: string, p: Partial<Item>) =>
    setItems((list) => list?.map((it) => (it.url === url ? { ...it, ...p } : it)) ?? null);

  // Esito di un link di Google Maps: già salvato o doppione di un altro link della lista?
  const settle = (url: string, r: Preview, seenPlaces: Set<string>) => {
    if (r.stato !== "riconosciuto") {
      patch(url, { stato: r.stato, motivo: r.motivo, nome: r.stato === "da_confermare" ? r.nome : null });
      return;
    }
    if (savedIds.current.has(r.place.id)) return patch(url, { stato: "gia_salvato", place: r.place });
    if (seenPlaces.has(r.place.id)) return patch(url, { stato: "doppione", place: r.place });
    seenPlaces.add(r.place.id);
    patch(url, { stato: "riconosciuto", place: r.place });
  };
  const seen = useRef<Set<string>>(new Set());

  const loadSaved = async () => {
    if (!userId) return;
    try {
      const { data } = await (await browserClient()).from("saved_places").select("place_id, tags").eq("user_id", userId);
      const rows = (data ?? []) as { place_id: string; tags: string[] | null }[];
      savedIds.current = new Set(rows.map((r) => r.place_id));
      const tags = [...new Set(rows.flatMap((r) => r.tags ?? []))];
      setAllTags(tags);
      setCollections(tags.filter((t) => t.trim() && !isStateTag(t)).sort((a, b) => a.localeCompare(b, "it")));
    } catch {
      // Senza lettura dei salvati: i doppioni li ferma comunque il database (23505 → "Già salvato").
    }
  };

  const read = async (value: string) => {
    if (!userId || phase === "reading" || phase === "saving") return;
    const { links, oltre: fuori } = extractAllLinks(value);
    if (links.length === 0) {
      setItems(null);
      setError("Non vedo link nel testo. Incolla la chat o la nota con i link dei locali.");
      return;
    }
    setError(null);
    setOltre(fuori);
    setPhase("reading");
    setSavedCount(0);
    setSavedInto(null);
    calls.current = 0;
    seen.current = new Set();
    const initial: Item[] = links.map((l) => {
      if (l.kind === "maps") return { ...l, stato: "attesa" };
      if (l.kind === "instagram") return { ...l, stato: "da_confermare", motivo: "Instagram non lascia leggere il post: usa uno screenshot." };
      if (l.kind === "tiktok" || l.kind === "youtube") return { ...l, stato: "da_confermare", motivo: "Leggo la descrizione del video quando lo tocchi." };
      return { ...l, stato: "non_riconosciuto", motivo: "Non è un link di Google Maps, Instagram, TikTok o YouTube." };
    });
    setItems(initial);
    await loadSaved();

    const maps = initial.filter((l) => l.kind === "maps");
    let reserved = 0;
    await pool(maps, CONCURRENCY, async (l) => {
      // Al massimo 2 chiamate per link, mai oltre il tetto dell'import (contando quelle in corso).
      const budget = Math.max(0, Math.min(2, MAX_CALLS - calls.current - reserved));
      reserved += budget;
      patch(l.url, { stato: "lavoro" });
      const r = await previewLink(l.url, budget);
      reserved -= budget;
      calls.current += r.chiamate;
      settle(l.url, r, seen.current);
    });
    setPhase("ready");
    trackFeature("import_multiplo", { risultati: links.length, contesto: "letti" });
  };

  // "Da confermare" di Google Maps: un tocco = un link riconosciuto (fino a 2 chiamate, chieste dall'utente).
  const confirmOne = async (it: Item) => {
    patch(it.url, { stato: "lavoro" });
    const r = await previewLink(it.url, 2);
    calls.current += r.chiamate;
    settle(it.url, r, seen.current);
  };

  const pasteFromClipboard = async () => {
    let clip = "";
    try {
      clip = (await navigator.clipboard?.readText?.()) ?? "";
    } catch {
      // permesso negato: si incolla a mano nel campo
    }
    if (clip.trim()) {
      setText(clip);
      await read(clip);
    } else {
      setError("Non riesco a leggere gli appunti: tieni premuto nel campo qui sotto e scegli Incolla.");
    }
  };

  const toSave = items?.filter((it) => it.stato === "riconosciuto") ?? [];

  const saveAll = async () => {
    if (!userId || toSave.length === 0) return;
    let raccolta: string | null = null;
    if (target === NEW_COLLECTION) {
      const check = checkCollectionName(newName, allTags);
      if ("error" in check) { setError(check.error); return; }
      raccolta = check.tag;
    } else if (target) {
      raccolta = target;
    }
    setError(null);
    setPhase("saving");
    const supabase = await browserClient().catch(() => null);
    if (!supabase) {
      setError("Errore di rete. Controlla la connessione e riprova.");
      setPhase("ready");
      return;
    }
    const tags = raccolta ? [WANT_TAG, raccolta] : [WANT_TAG];
    let saved = 0;
    await pool(toSave, CONCURRENCY, async (it) => {
      const { error: e } = await supabase
        .from("saved_places")
        .insert({ user_id: userId, place_id: it.place!.id, tags, note: null });
      if (!e) { saved++; savedIds.current.add(it.place!.id); patch(it.url, { stato: "salvato" }); }
      else if (e.code === "23505") patch(it.url, { stato: "gia_salvato" });
      else patch(it.url, { stato: "errore", motivo: "Non salvato: riprova." });
    });
    setSavedCount((c) => c + saved); // anche un secondo giro dopo "Riconosci"
    setSavedInto(raccolta);
    setPhase("done");
    trackFeature("import_multiplo", { risultati: saved, contesto: raccolta ? "salvati_raccolta" : "salvati" });
  };

  const reset = () => {
    setItems(null);
    setText("");
    setPhase("idle");
    setError(null);
    setOltre(0);
  };

  const done = items?.filter((it) => it.stato !== "attesa" && it.stato !== "lavoro").length ?? 0;
  const total = items?.length ?? 0;
  const count = (s: Stato[]) => items?.filter((it) => s.includes(it.stato)).length ?? 0;

  return (
    <section className="rounded-card border border-border bg-surface p-5" data-testid="importa-multi">
      <h2 className="font-display text-lg font-semibold text-brand">
        <span aria-hidden>🔗 </span>Incolla più link
      </h2>
      <p className="mt-1 text-sm text-text-muted">
        Hai una chat con te stesso piena di posti, o una nota? Incollala tutta: trovo io i link e li salvo insieme.
      </p>

      {!userId ? (
        <p className="mt-4 text-sm text-text-muted">
          <Link href="/login?next=%2Fimporta" className="underline text-text">Accedi</Link> per salvare i locali.
        </p>
      ) : (
        <>
          {phase !== "done" && (
            <div className="mt-4 space-y-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                placeholder={"Incolla qui la chat o la nota\nes. Da provare! https://maps.app.goo.gl/…"}
                aria-label="Testo con i link"
                className="w-full rounded-btn border border-border bg-white px-3 py-2 text-base focus:border-brand focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={pasteFromClipboard}
                  disabled={phase === "reading" || phase === "saving"}
                  className="min-h-12 flex-1 rounded-pill border border-brand bg-white px-3 text-sm font-display font-semibold text-brand disabled:opacity-60"
                >
                  📋 Incolla
                </button>
                <button
                  type="button"
                  onClick={() => read(text)}
                  disabled={!text.trim() || phase === "reading" || phase === "saving"}
                  data-testid="multi-leggi"
                  className="min-h-12 flex-[1.4] rounded-pill bg-brand px-3 text-sm font-display font-semibold text-white disabled:opacity-60"
                >
                  {phase === "reading" ? "Leggo…" : "Trova i locali"}
                </button>
              </div>
            </div>
          )}

          {error && <p className="mt-3 rounded-btn bg-error/10 px-4 py-3 text-sm text-error" data-testid="multi-errore">{error}</p>}

          {items && (
            <div className="mt-4">
              {phase === "reading" && (
                <div className="mb-3" data-testid="multi-avanzamento">
                  <p className="text-sm text-text">Leggo i link… {done} di {total}</p>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border">
                    <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
                  </div>
                </div>
              )}
              {phase !== "reading" && (
                <p className="mb-3 text-sm text-text" data-testid="multi-riepilogo">
                  <b>{total} link</b>: {count(["riconosciuto", "salvato"])} riconosciuti
                  {count(["gia_salvato", "doppione"]) > 0 && `, ${count(["gia_salvato", "doppione"])} già salvati`}
                  {count(["da_confermare"]) > 0 && `, ${count(["da_confermare"])} da confermare`}
                  {count(["non_riconosciuto"]) > 0 && `, ${count(["non_riconosciuto"])} non riconosciuti`}
                </p>
              )}
              {oltre > 0 && <p className="mb-3 text-xs text-text-muted">Altri {oltre} link restano fuori: incollali in un secondo giro.</p>}

              <ul className="space-y-2" data-testid="multi-lista">
                {items.map((it) => (
                  <Row
                    key={it.url}
                    it={it}
                    onConfirm={() => confirmOne(it)}
                    onScreenshot={onScreenshot}
                    onSearch={onSearch}
                    onReadVideo={() => onReadVideo(it.url)}
                    busy={phase === "saving"}
                  />
                ))}
              </ul>

              {(phase === "ready" || phase === "done") && toSave.length > 0 && (
                <div className="mt-4 space-y-2 rounded-card border border-border bg-white p-4">
                  <label className="block text-sm font-medium text-text" htmlFor="multi-raccolta">Dove li metto?</label>
                  <select
                    id="multi-raccolta"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    className="min-h-11 w-full rounded-btn border border-border bg-white px-3 text-base focus:border-brand focus:outline-none"
                  >
                    <option value="">📌 Voglio andarci (nessuna raccolta)</option>
                    {collections.map((c) => <option key={c} value={c}>📁 {c}</option>)}
                    <option value={NEW_COLLECTION}>＋ Nuova raccolta…</option>
                  </select>
                  {target === NEW_COLLECTION && (
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      maxLength={24}
                      placeholder="Es. Viaggio a Milano"
                      aria-label="Nome della nuova raccolta"
                      className="min-h-11 w-full rounded-btn border border-border bg-white px-3 text-base focus:border-brand focus:outline-none"
                    />
                  )}
                  <button
                    type="button"
                    onClick={saveAll}
                    data-testid="multi-salva"
                    className="min-h-14 w-full rounded-pill bg-brand px-4 text-base font-display font-semibold text-white"
                  >
                    {saveLabel(toSave.length)}
                  </button>
                </div>
              )}
              {phase === "saving" && <p className="mt-4 text-sm text-text">Salvo…</p>}

              {phase === "done" && (
                <div className="mt-4 rounded-card border border-success/30 bg-success/10 p-4 text-center" data-testid="multi-fatto">
                  <p className="text-base font-semibold text-text">
                    <span aria-hidden>✅ </span>
                    {savedCount === 1 ? "1 locale salvato" : `${savedCount} locali salvati`}
                    {savedInto ? ` in “${savedInto}”` : ""}
                  </p>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    <Link
                      href={savedInto ? collectionPath(savedInto) : "/miei-locali"}
                      className="inline-flex min-h-11 items-center rounded-pill bg-brand px-4 text-sm font-display font-semibold text-white"
                    >
                      {savedInto ? "Apri la raccolta" : "Vedi i salvati"}
                    </Link>
                    <button
                      type="button"
                      onClick={reset}
                      className="min-h-11 rounded-pill border border-border bg-white px-4 text-sm font-medium text-text"
                    >
                      Incolla altri link
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

const BADGE: Record<Stato, { label: string; cls: string }> = {
  attesa: { label: "In coda", cls: "bg-border text-text-muted" },
  lavoro: { label: "Leggo…", cls: "bg-border text-text-muted" },
  riconosciuto: { label: "Riconosciuto", cls: "bg-success/15 text-success" },
  salvato: { label: "✓ Salvato", cls: "bg-success/15 text-success" },
  gia_salvato: { label: "Già salvato", cls: "bg-brand/10 text-brand" },
  doppione: { label: "Già in lista", cls: "bg-brand/10 text-brand" },
  da_confermare: { label: "Da confermare", cls: "bg-accent/15 text-accent" },
  non_riconosciuto: { label: "Non riconosciuto", cls: "bg-error/10 text-error" },
  errore: { label: "Non salvato", cls: "bg-error/10 text-error" },
};

function shortUrl(u: string): string {
  try {
    const url = new URL(u);
    const s = url.hostname.replace(/^www\./, "") + url.pathname;
    return s.length > 38 ? `${s.slice(0, 37)}…` : s;
  } catch {
    return u.slice(0, 38);
  }
}

function Row({
  it, onConfirm, onScreenshot, onSearch, onReadVideo, busy,
}: {
  it: Item;
  onConfirm: () => void;
  onScreenshot: () => void;
  onSearch: (q: string) => void;
  onReadVideo: () => void;
  busy: boolean;
}) {
  const badge = BADGE[it.stato];
  const title = it.place?.name ?? it.nome ?? KIND_LABEL[it.kind];
  const sub = it.place ? (displayAddress(it.place.address) || "Posizione dal link di Google Maps") : shortUrl(it.url);
  const pill = "min-h-10 max-w-full truncate rounded-pill border border-brand bg-white px-3 text-xs font-display font-semibold text-brand disabled:opacity-60";
  return (
    <li className="rounded-card border border-border bg-white p-3" data-testid="multi-riga" data-stato={it.stato}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-text">{title}</p>
          <p className="truncate text-xs text-text-muted">{sub}</p>
        </div>
        <span className={`shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}>{badge.label}</span>
      </div>
      {it.motivo && (it.stato === "da_confermare" || it.stato === "non_riconosciuto" || it.stato === "errore") && (
        <p className="mt-1.5 text-xs text-text-muted">{it.motivo}</p>
      )}
      {it.stato === "da_confermare" && (
        <div className="mt-2 flex flex-wrap gap-2">
          {it.kind === "maps" && (
            <button type="button" onClick={onConfirm} disabled={busy} className={pill} data-testid="multi-conferma">Riconosci</button>
          )}
          {(it.kind === "tiktok" || it.kind === "youtube") && (
            <button type="button" onClick={onReadVideo} disabled={busy} className={pill}>✨ Trova dal video</button>
          )}
          {it.kind === "instagram" && (
            <button type="button" onClick={onScreenshot} disabled={busy} className={pill}>Carica uno screenshot</button>
          )}
          {it.kind !== "maps" && it.hint && (
            <button type="button" onClick={() => onSearch(it.hint!)} disabled={busy} className={pill}>Cerca “{it.hint}”</button>
          )}
        </div>
      )}
    </li>
  );
}
