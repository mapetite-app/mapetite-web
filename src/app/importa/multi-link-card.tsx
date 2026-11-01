"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { browserClient } from "@/lib/supabase/client-lazy";
import { displayAddress } from "@/lib/city";
import { isStateTag } from "@/lib/tags";
import { checkCollectionName, collectionPath } from "@/lib/raccolte";
import { extractAllLinks, KIND_LABEL, roundLabel, saveLabel, suggestCollectionName, type FoundLink } from "@/lib/multi-link";
import { trackFeature } from "@/lib/track";

// "Incolla più link" (piano 3.2, rifatto il 1/11): si incolla un testo con tanti link (la chat di
// WhatsApp con sé stessi, una nota, più link di Google Maps), si vede l'elenco dei posti trovati,
// "Salva tutti" con l'avanzamento, poi il riepilogo (salvati · già nei tuoi posti · non trovati),
// la proposta di metterli in una raccolta e, per i non trovati, la ricerca a mano col nome già scritto.
//
// Costi Google: ogni link di Google Maps passa da /api/places/link-preview (di solito 1 ricerca,
// 0 se il posto è già nel catalogo, al massimo 2), al massimo 2 insieme. La quota del giorno è
// condivisa da tutti: si leggono ROUND link per volta (con un tetto di MAX_CALLS chiamate) e, se i
// link sono tanti, si chiede prima di partire. Instagram, TikTok e YouTube non partono da soli:
// costano AI e una ricerca, quindi si aprono uno alla volta con il flusso già esistente.

const ROUND = 10;
const MAX_CALLS = 12;
const CONFIRM_FROM = 6;
const CONCURRENCY = 2;
const WANT_TAG = "Da provare";

type Stato =
  | "attesa" | "dopo" | "lavoro" | "riconosciuto" | "da_confermare" | "non_riconosciuto"
  | "gia_salvato" | "doppione" | "salvato" | "errore";

type Place = { id: string; name: string; address: string };
type Item = FoundLink & {
  stato: Stato;
  place?: Place;
  motivo?: string;
  nome?: string | null;
};

type Preview =
  | { stato: "riconosciuto"; chiamate: number; place: Place }
  | { stato: "da_confermare"; chiamate: number; motivo: string; nome: string | null }
  | { stato: "non_riconosciuto"; chiamate: number; motivo: string; nome?: string | null };

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

type Phase = "idle" | "confirm" | "reading" | "ready" | "saving" | "done";

export default function MultiLinkCard({
  userId,
  onScreenshot,
  onSearch,
  onReadVideo,
  incoming,
  onAgain,
}: {
  userId: string | null;
  onScreenshot: () => void;
  onSearch: (q: string) => void;
  onReadVideo: (url: string) => void;
  // Testo incollato con "Incolla un link" (n cambia a ogni incolla): qui si legge e si mostra la lista.
  incoming: { text: string; n: number } | null;
  // "Incolla altri link": si torna al pulsante unico in cima.
  onAgain?: () => void;
}) {
  const [items, setItems] = useState<Item[] | null>(null);
  const itemsRef = useRef<Item[] | null>(null);
  const [oltre, setOltre] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [collections, setCollections] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [round, setRound] = useState<string[]>([]);
  const [saveProgress, setSaveProgress] = useState({ done: 0, total: 0 });
  const [savedCount, setSavedCount] = useState(0);
  // Posti salvati da questo import (per la raccolta proposta dopo) e la raccolta scelta.
  const [savedNow, setSavedNow] = useState<Place[]>([]);
  const [savedInto, setSavedInto] = useState<string | null>(null);
  const [collName, setCollName] = useState("");
  const [collBusy, setCollBusy] = useState(false);
  const savedIds = useRef<Set<string>>(new Set());
  const seen = useRef<Set<string>>(new Set());
  const calls = useRef(0);
  const tracked = useRef(false);

  const update = (fn: (list: Item[]) => Item[]) => {
    itemsRef.current = fn(itemsRef.current ?? []);
    setItems(itemsRef.current);
  };
  const patch = (url: string, p: Partial<Item>) => update((list) => list.map((it) => (it.url === url ? { ...it, ...p } : it)));

  // Esito di un link di Google Maps: già salvato o doppione di un altro link della lista?
  const settle = (url: string, r: Preview) => {
    if (r.stato !== "riconosciuto") {
      patch(url, { stato: r.stato, motivo: r.motivo, nome: r.nome ?? null });
      return;
    }
    if (savedIds.current.has(r.place.id)) return patch(url, { stato: "gia_salvato", place: r.place });
    if (seen.current.has(r.place.id)) return patch(url, { stato: "doppione", place: r.place });
    seen.current.add(r.place.id);
    patch(url, { stato: "riconosciuto", place: r.place });
  };

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

  // Un giro: i primi ROUND link di Google Maps ancora da leggere; gli altri aspettano il giro dopo.
  const readRound = async () => {
    const queue = (itemsRef.current ?? []).filter((it) => it.kind === "maps" && (it.stato === "attesa" || it.stato === "dopo"));
    if (queue.length === 0) { setPhase("ready"); return; }
    const now = new Set(queue.slice(0, ROUND).map((it) => it.url));
    update((list) => list.map((it) => (it.kind === "maps" && (it.stato === "attesa" || it.stato === "dopo") ? { ...it, stato: now.has(it.url) ? "attesa" : "dopo" } : it)));
    setRound([...now]);
    setPhase("reading");
    calls.current = 0;
    let reserved = 0;
    await pool([...now], CONCURRENCY, async (url) => {
      // Al massimo 2 chiamate per link, mai oltre il tetto del giro (contando quelle in corso).
      const budget = Math.max(0, Math.min(2, MAX_CALLS - calls.current - reserved));
      reserved += budget;
      patch(url, { stato: "lavoro" });
      const r = await previewLink(url, budget);
      reserved -= budget;
      calls.current += r.chiamate;
      settle(url, r);
    });
    setPhase("ready");
    if (!tracked.current) {
      tracked.current = true;
      trackFeature("import_multiplo", { risultati: itemsRef.current?.length ?? 0, contesto: "letti" });
    }
  };

  const read = async (value: string) => {
    if (!userId || phase === "reading" || phase === "saving") return;
    const { links, oltre: fuori } = extractAllLinks(value);
    if (links.length === 0) {
      itemsRef.current = null;
      setItems(null);
      setError("Non vedo link nel testo. Incolla la chat o la nota con i link dei locali.");
      return;
    }
    setError(null);
    setOltre(fuori);
    setSavedCount(0);
    setSavedNow([]);
    setSavedInto(null);
    setCollName("");
    seen.current = new Set();
    tracked.current = false;
    const initial: Item[] = links.map((l) => {
      if (l.kind === "maps") return { ...l, stato: "attesa" };
      if (l.kind === "instagram") return { ...l, stato: "da_confermare", motivo: "Instagram non lascia leggere il post: usa uno screenshot." };
      if (l.kind === "tiktok" || l.kind === "youtube") return { ...l, stato: "da_confermare", motivo: "Leggo la descrizione del video quando lo tocchi." };
      return { ...l, stato: "non_riconosciuto", motivo: "Non è un link di Google Maps, Instagram, TikTok o YouTube." };
    });
    itemsRef.current = initial;
    setItems(initial);
    // Tanti link di Google Maps: prima si avvisa (usano la quota di ricerche del giorno), poi si parte.
    const maps = initial.filter((l) => l.kind === "maps").length;
    setPhase(maps >= CONFIRM_FROM ? "confirm" : "reading");
    await loadSaved();
    if (maps < CONFIRM_FROM) await readRound();
  };

  // "Da confermare" di Google Maps: un tocco = un link riconosciuto (fino a 2 chiamate, chieste dall'utente).
  const confirmOne = async (it: Item) => {
    patch(it.url, { stato: "lavoro" });
    const r = await previewLink(it.url, 2);
    settle(it.url, r);
  };

  // Ogni nuovo incolla del pulsante unico avvia la lettura (fuori dal ciclo dell'effetto).
  const lastN = useRef(0);
  useEffect(() => {
    if (!incoming || incoming.n === lastN.current) return;
    lastN.current = incoming.n;
    const t = setTimeout(() => {
      void read(incoming.text);
      // Dopo il disegno della lista: la si porta in vista.
      window.setTimeout(() => document.getElementById("importa-multi")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming]);

  const toSave = items?.filter((it) => it.stato === "riconosciuto") ?? [];

  const saveAll = async () => {
    if (!userId || toSave.length === 0) return;
    setError(null);
    setPhase("saving");
    setSaveProgress({ done: 0, total: toSave.length });
    const supabase = await browserClient().catch(() => null);
    if (!supabase) {
      setError("Errore di rete. Controlla la connessione e riprova.");
      setPhase("ready");
      return;
    }
    // Dopo aver scelto una raccolta, anche quelli salvati in un secondo giro ci finiscono dentro.
    const tags = savedInto ? [WANT_TAG, savedInto] : [WANT_TAG];
    const fresh: Place[] = [];
    await pool(toSave, CONCURRENCY, async (it) => {
      const { error: e } = await supabase
        .from("saved_places")
        .insert({ user_id: userId, place_id: it.place!.id, tags, note: null });
      if (!e) { fresh.push(it.place!); savedIds.current.add(it.place!.id); patch(it.url, { stato: "salvato" }); }
      else if (e.code === "23505") patch(it.url, { stato: "gia_salvato" });
      else patch(it.url, { stato: "errore", motivo: "Non salvato: riprova." });
      setSaveProgress((p) => ({ ...p, done: p.done + 1 }));
    });
    setSavedCount((c) => c + fresh.length); // anche un secondo giro dopo "Riconosci"
    const all = [...savedNow, ...fresh];
    setSavedNow(all);
    if (!savedInto) setCollName((n) => n || suggestCollectionName(all.map((p) => p.address), new Date()));
    setPhase("done");
    trackFeature("import_multiplo", { risultati: fresh.length, contesto: savedInto ? "salvati_raccolta" : "salvati" });
  };

  // "Mettili in una raccolta": un tocco, facoltativo, sui posti appena salvati da questo import.
  const exists = collections.find((c) => c.toLocaleLowerCase("it") === collName.trim().toLocaleLowerCase("it"));
  const intoCollection = async () => {
    if (!userId || savedNow.length === 0 || collBusy) return;
    const check = checkCollectionName(collName, allTags);
    if ("error" in check) { setError(check.error); return; }
    setError(null);
    setCollBusy(true);
    try {
      const { error: e } = await (await browserClient())
        .from("saved_places")
        .update({ tags: [WANT_TAG, check.tag] })
        .eq("user_id", userId)
        .in("place_id", savedNow.map((p) => p.id));
      if (e) throw e;
      setSavedInto(check.tag);
      setAllTags((t) => [...new Set([...t, check.tag])]);
      trackFeature("import_multiplo", { risultati: savedNow.length, contesto: "salvati_raccolta" });
    } catch {
      setError("Raccolta non creata: riprova.");
    } finally {
      setCollBusy(false);
    }
  };

  const reset = () => {
    itemsRef.current = null;
    setItems(null);
    onAgain?.();
    setPhase("idle");
    setError(null);
    setOltre(0);
  };

  const total = items?.length ?? 0;
  const count = (s: Stato[]) => items?.filter((it) => s.includes(it.stato)).length ?? 0;
  const readDone = items?.filter((it) => round.includes(it.url) && it.stato !== "attesa" && it.stato !== "lavoro").length ?? 0;
  const mapsCount = items?.filter((it) => it.kind === "maps").length ?? 0;
  const later = count(["dopo"]);
  const gia = count(["gia_salvato"]);
  const nonTrovati = count(["non_riconosciuto", "errore"]);
  const daConfermare = count(["da_confermare"]);
  // Dopo il salvataggio l'elenco mostra solo quello che resta da sistemare.
  const rows = phase === "done" ? (items ?? []).filter((it) => !["salvato", "gia_salvato", "doppione"].includes(it.stato)) : items ?? [];

  if (!userId || (!items && !error)) return null;

  const pill = "inline-flex min-h-11 items-center rounded-pill px-4 text-sm font-display font-semibold";
  const bar = (done: number, all: number) => (
    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border">
      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${all ? (done / all) * 100 : 0}%` }} />
    </div>
  );
  const saveButton = (phase === "ready" || phase === "done") && toSave.length > 0 && (
    <button
      type="button"
      onClick={saveAll}
      data-testid="multi-salva"
      className="mt-3 min-h-14 w-full rounded-pill bg-brand px-4 text-base font-display font-semibold text-white shadow-float active:scale-[0.99]"
    >
      {saveLabel(toSave.length)}
    </button>
  );

  return (
    <section id="importa-multi" className="mt-4 scroll-mt-4 rounded-card border border-border bg-white p-5" data-testid="importa-multi">
      <h2 className="font-display text-lg font-semibold text-brand">
        {phase === "done" ? "Fatto" : mapsCount === total && total > 0 ? `${total} posti da Google Maps` : "I link che hai incollato"}
      </h2>
      {error && <p className="mt-3 rounded-btn bg-error/10 px-4 py-3 text-sm text-error" data-testid="multi-errore">{error}</p>}

      {items && (
        <div className="mt-3">
          {phase === "confirm" && (
            <div className="rounded-card bg-accent-light p-4" data-testid="multi-avviso">
              <p className="text-sm text-text">
                Ogni posto usa una delle ricerche su Google del giorno, che sono poche e condivise: ne leggo {ROUND} per volta.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => void readRound()} data-testid="multi-avvia" className={`${pill} min-h-12 flex-1 justify-center bg-brand text-white`}>
                  {roundLabel(mapsCount, ROUND)}
                </button>
                <button type="button" onClick={reset} className={`${pill} min-h-12 border border-border bg-white text-text`}>Annulla</button>
              </div>
            </div>
          )}

          {phase === "reading" && (
            <div data-testid="multi-avanzamento">
              <p className="text-sm text-text">Leggo i posti… {readDone} di {round.length}</p>
              {bar(readDone, round.length)}
            </div>
          )}

          {phase === "ready" && (
            <p className="text-sm text-text" data-testid="multi-riepilogo">
              {[
                `${toSave.length} da salvare`,
                gia > 0 && `${gia} già nei tuoi posti`,
                nonTrovati > 0 && `${nonTrovati} non ${nonTrovati === 1 ? "trovato" : "trovati"}`,
                daConfermare > 0 && `${daConfermare} da guardare`,
                later > 0 && `${later} al prossimo giro`,
              ].filter(Boolean).join(" · ")}
            </p>
          )}

          {phase === "saving" && (
            <div data-testid="multi-salvataggio">
              <p className="text-sm text-text">Salvo… {saveProgress.done} di {saveProgress.total}</p>
              {bar(saveProgress.done, saveProgress.total)}
            </div>
          )}

          {phase === "done" && (
            <div className="rounded-card border border-success/30 bg-success/10 p-4" data-testid="multi-fatto">
              <p className="text-base font-semibold text-text" data-testid="multi-fatto-riepilogo">
                <span aria-hidden>✅ </span>
                {[
                  `Salvati ${savedCount}`,
                  gia > 0 && `Già nei tuoi posti ${gia}`,
                  nonTrovati > 0 && `Non ${nonTrovati === 1 ? "trovato" : "trovati"} ${nonTrovati}`,
                ].filter(Boolean).join(" · ")}
              </p>

              {savedNow.length >= 2 && !savedInto && (
                <div className="mt-3" data-testid="multi-raccolta-proposta">
                  <label htmlFor="multi-raccolta-nome" className="text-sm text-text">Li metto anche in una raccolta?</label>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      id="multi-raccolta-nome"
                      value={collName}
                      onChange={(e) => setCollName(e.target.value)}
                      maxLength={24}
                      list="multi-raccolte"
                      aria-label="Nome della raccolta"
                      className="min-h-11 min-w-0 flex-1 rounded-btn border border-border bg-white px-3 text-base focus:border-brand focus:outline-none"
                    />
                    <datalist id="multi-raccolte">
                      {collections.map((c) => <option key={c} value={c} />)}
                    </datalist>
                    <button
                      type="button"
                      onClick={intoCollection}
                      disabled={collBusy || !collName.trim()}
                      data-testid="multi-raccolta-crea"
                      className={`${pill} shrink-0 bg-brand text-white disabled:opacity-60`}
                    >
                      {collBusy ? "…" : exists ? "Aggiungi" : "Crea"}
                    </button>
                  </div>
                </div>
              )}
              {savedInto && (
                <p className="mt-2 text-sm text-text" data-testid="multi-raccolta-fatta">
                  Nella raccolta <b>“{savedInto}”</b>.
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={savedInto ? collectionPath(savedInto) : "/miei-locali"} className={`${pill} bg-white text-brand border border-brand`}>
                  {savedInto ? "Apri la raccolta" : "Vedi i salvati"}
                </Link>
                <button type="button" onClick={reset} className={`${pill} border border-border bg-white font-medium text-text`}>
                  Incolla altri link
                </button>
              </div>
            </div>
          )}

          {saveButton}

          {(phase === "ready" || phase === "done") && later > 0 && (
            <div className="mt-3 rounded-btn bg-surface px-3 py-2" data-testid="multi-prossimo-giro">
              <p className="text-xs text-text-muted">Ne restano {later}: li leggo {ROUND} per volta, per non finire le ricerche del giorno.</p>
              <button type="button" onClick={() => void readRound()} data-testid="multi-altri" className={`${pill} mt-2 border border-brand bg-white text-brand`}>
                {roundLabel(later, ROUND, true)}
              </button>
            </div>
          )}
          {oltre > 0 && <p className="mt-3 text-xs text-text-muted">Altri {oltre} link restano fuori: incollali in un secondo giro.</p>}

          {phase === "done" && rows.length > 0 && (
            <p className="mt-4 text-sm font-semibold text-text" data-testid="multi-da-sistemare">
              Da sistemare: {rows.length === 1 ? "cercalo" : "cercali"} a mano, il nome è già scritto.
            </p>
          )}
          {rows.length > 0 && (
            <ul className="mt-3 space-y-2" data-testid="multi-lista">
              {rows.map((it) => (
                <Row
                  key={it.url}
                  it={it}
                  onConfirm={() => confirmOne(it)}
                  onScreenshot={onScreenshot}
                  onSearch={onSearch}
                  onReadVideo={() => onReadVideo(it.url)}
                  busy={phase === "saving" || phase === "reading"}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

const BADGE: Record<Stato, { label: string; cls: string }> = {
  attesa: { label: "In coda", cls: "bg-border text-text-muted" },
  dopo: { label: "Prossimo giro", cls: "bg-border text-text-muted" },
  lavoro: { label: "Leggo…", cls: "bg-border text-text-muted" },
  riconosciuto: { label: "Trovato", cls: "bg-success/15 text-success" },
  salvato: { label: "✓ Salvato", cls: "bg-success/15 text-success" },
  gia_salvato: { label: "Già salvato", cls: "bg-brand/10 text-brand" },
  doppione: { label: "Già in lista", cls: "bg-brand/10 text-brand" },
  da_confermare: { label: "Da confermare", cls: "bg-accent/15 text-accent" },
  non_riconosciuto: { label: "Non trovato", cls: "bg-error/10 text-error" },
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
  // Prima della lettura il nome è il testo scritto accanto al link nella chat, se c'è.
  const guess = it.nome ?? it.hint;
  const title = it.place?.name ?? guess ?? KIND_LABEL[it.kind];
  const sub = it.place ? (displayAddress(it.place.address) || "Posizione dal link di Google Maps") : shortUrl(it.url);
  const pill = "min-h-10 max-w-full truncate rounded-pill border border-brand bg-white px-3 text-xs font-display font-semibold text-brand disabled:opacity-60";
  const notFound = it.stato === "non_riconosciuto" || it.stato === "errore";
  return (
    <li className="rounded-card border border-border bg-white p-3" data-testid="multi-riga" data-stato={it.stato}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-text">{title}</p>
          <p className="truncate text-xs text-text-muted">{sub}</p>
        </div>
        <span className={`shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}>{badge.label}</span>
      </div>
      {it.motivo && (it.stato === "da_confermare" || notFound) && (
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
      {notFound && (
        // Non trovato: si cerca a mano, con il nome già scritto se lo conosciamo (dal link o dalla chat).
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => onSearch(guess ?? "")} disabled={busy} className={pill} data-testid="multi-cerca">
            {guess ? `Cerca “${guess}”` : "Cerca a mano"}
          </button>
        </div>
      )}
    </li>
  );
}
