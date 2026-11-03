"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { APRI_FILE_EVENT } from "@/lib/apri-file-google";
import Link from "next/link";
import { browserClient } from "@/lib/supabase/client-lazy";
import RaccoltaCopertina from "@/components/raccolta-copertina";
import { collectionPath } from "@/lib/raccolte";
import { getCategoryEmoji } from "@/lib/emoji";
import { isStateTag } from "@/lib/tags";
import { updateTags } from "@/lib/raccolte-write";
import { trackFeature } from "@/lib/track";
import {
  kmzToKml, listMapping, parseTakeout, zoneCounts, SENZA_POSIZIONE,
  type TakeoutItem, type TakeoutSkipped,
} from "@/lib/takeout";

// "Carica il file di Google Maps" (piano 3.2): tutto quello che uno ha salvato in Google Maps negli anni,
// in un colpo. Il file si legge NEL TELEFONO (non va al server). Costi Google:
//  - posti con nome e coordinate (Saved Places.json, KML/KMZ): ZERO chiamate (/api/places/import-file);
//  - posti dei .csv (solo titolo e link): al massimo MAX_CALLS chiamate per import con /api/places/link-preview
//    (stesso tetto per link di "Incolla più link"); gli altri restano "da completare" in questo telefono e
//    si completano MAX_CALLS alla volta, una volta al giorno. Mai una chiamata per riga.

const MAX_CALLS = 10;
const CHUNK = 40;
const QUEUE_KEY = "mapetite.takeout.da-completare";
const LAST_KEY = "mapetite.takeout.ultimo-completamento";
const DAY = 20 * 60 * 60 * 1000;

type Pending = { name: string; url: string; tags: string[]; note: string | null };
// Raccolta nata dal file (una per lista): posti davvero salvati con quel nome, per le copertine del "fatto".
type Nata = { tag: string; count: number; emojis: string[]; names: string[]; ids: Set<string> };
// I salvati che ci sono già: place_id → tag attuali (per aggiungere la lista senza toglierne nessuno).
type SavedMap = Map<string, string[]>;
type Row = { place_id: string; tags: string[]; note: string | null; name?: string };
type Preview =
  | { stato: "riconosciuto"; chiamate: number; place: { id: string } }
  | { stato: "da_confermare" | "non_riconosciuto"; chiamate: number };

function readQueue(): Pending[] {
  try { const q = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]"); return Array.isArray(q) ? q : []; } catch { return []; }
}
function writeQueue(q: Pending[]) {
  try { if (q.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(0, 2000))); else localStorage.removeItem(QUEUE_KEY); } catch { /* privata */ }
  window.dispatchEvent(new Event("mapetite-takeout"));
}
const subscribeQueue = (cb: () => void) => { window.addEventListener("mapetite-takeout", cb); return () => window.removeEventListener("mapetite-takeout", cb); };
const queueLength = () => readQueue().length;
function stampRun() { try { localStorage.setItem(LAST_KEY, String(Date.now())); } catch { /* privata */ } }
function lastRun(): number { try { return Number(localStorage.getItem(LAST_KEY) ?? 0) || 0; } catch { return 0; } }

// Tag di tutte le liste in cui c'è il posto (stato e raccolta), senza doppioni.
const tagsOf = (it: { lista: string; altreListe?: string[] }) => [
  ...new Set([it.lista, ...(it.altreListe ?? [])].flatMap((l) => {
    const m = listMapping(l);
    return [m.stato, m.tag].filter((t): t is string => Boolean(t));
  })),
];

async function previewLink(link: string, budget: number): Promise<Preview> {
  try {
    const res = await fetch("/api/places/link-preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ link, budget }) });
    const data = await res.json().catch(() => ({}));
    return res.ok && data?.stato ? (data as Preview) : { stato: "da_confermare", chiamate: 0 };
  } catch {
    return { stato: "da_confermare", chiamate: 0 };
  }
}

const STEPS: React.ReactNode[] = [
  <>Apri <a href="https://takeout.google.com/" target="_blank" rel="noopener noreferrer" className="font-semibold text-brand underline">takeout.google.com</a>, tocca <b>Deseleziona tutto</b> e scegli solo <b>Salvati</b> e <b>Maps (i tuoi luoghi)</b>.</>,
  <>Tocca <b>Passaggio successivo</b> → <b>Crea esportazione</b>. Google ti manda un’email con il file, di solito in pochi minuti.</>,
  <>Apri lo zip e carica qui <b>Saved Places.json</b> e i file <b>.csv</b> della cartella <b>Salvati</b> (uno per lista), anche tutti insieme: ogni lista diventa una raccolta. Vale per le liste create da te.</>,
];

export default function TakeoutCard({ userId, titolo = true }: { userId: string | null; titolo?: boolean }) {
  const [items, setItems] = useState<TakeoutItem[] | null>(null);
  const [skipped, setSkipped] = useState<TakeoutSkipped[]>([]);
  const [off, setOff] = useState<Set<string>>(new Set()); // zone escluse
  const [phase, setPhase] = useState<"idle" | "ready" | "saving" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState({ salvati: 0, gia: 0, attesa: 0, persi: 0 });
  const [progress, setProgress] = useState(0);
  const [help, setHelp] = useState(false);
  const [now] = useState(() => Date.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const nate = useRef<Map<string, Nata>>(new Map());
  const [raccolte, setRaccolte] = useState<Nata[]>([]);
  const queued = useSyncExternalStore(subscribeQueue, queueLength, () => 0);
  // Arrivati da una lista di Google Maps incollata: i passi per scaricare il file già aperti.
  useEffect(() => {
    const open = () => setHelp(true);
    window.addEventListener(APRI_FILE_EVENT, open);
    return () => window.removeEventListener(APRI_FILE_EVENT, open);
  }, []);

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    const seen = new Map<string, TakeoutItem | null>();
    const all: TakeoutItem[] = [];
    const out: TakeoutSkipped[] = [];
    const formats = new Set<string>();
    for (const f of Array.from(files).slice(0, 30)) {
      if (f.size > 15 * 1024 * 1024) continue;
      let text: string | null;
      try {
        text = /\.kmz$/i.test(f.name) ? await kmzToKml(await f.arrayBuffer()) : await f.text();
      } catch { text = null; }
      if (!text) continue;
      const r = parseTakeout(f.name, text, seen);
      if (r.formato !== "sconosciuto") formats.add(r.formato);
      all.push(...r.items);
      out.push(...r.scartati);
    }
    if (all.length === 0) {
      setItems(null);
      setPhase("idle");
      setError("Non trovo posti in questo file. Carica Saved Places.json o i file .csv delle liste salvate (dentro la cartella Takeout).");
      return;
    }
    setItems(all);
    setSkipped(out);
    setOff(new Set());
    setPhase("ready");
    trackFeature("import_file", { contesto: "letti", risultati: all.length, fonte: [...formats].join("+") });
  };

  const zones = items ? zoneCounts(items) : [];
  const chosen = items?.filter((it) => !off.has(it.zona)) ?? [];
  const noCoords = chosen.filter((it) => it.lat == null).length;

  const toggle = (z: string) => setOff((s) => { const n = new Set(s); if (n.has(z)) n.delete(z); else n.add(z); return n; });

  // Raccolte nate dal file: si contano solo i posti che hanno davvero quel nome (mai una stima), una volta sola.
  const countInto = (r: Row, tags: string[]) => {
    for (const tag of tags) {
      if (isStateTag(tag)) continue;
      const n = nate.current.get(tag) ?? { tag, count: 0, emojis: [], names: [], ids: new Set<string>() };
      if (n.ids.has(r.place_id)) continue;
      n.ids.add(r.place_id);
      n.count++;
      if (r.name && n.names.length < 3) n.names.push(r.name);
      const emoji = r.name ? getCategoryEmoji(null, r.name) : null;
      if (emoji && n.emojis.length < 4 && !n.emojis.includes(emoji)) n.emojis.push(emoji);
      nate.current.set(tag, n);
    }
  };

  // Salva le righe in saved_places saltando quelle già salvate (il vincolo unico fermerebbe tutto il gruppo).
  // Un posto già salvato prende comunque la raccolta della lista: il tag si AGGIUNGE ai suoi, mai tolto niente
  // (updateTags rilegge i tag dal database prima di scrivere, come la scheda e il profilo).
  const insertSaved = async (rows: Row[], saved: SavedMap) => {
    const fresh = rows.filter((r) => !saved.has(r.place_id) && (saved.set(r.place_id, r.tags), true));
    const old = rows.filter((r) => !fresh.includes(r));
    if (fresh.length > 0) {
      const { error: e } = await (await browserClient()).from("saved_places").insert(fresh.map((r) => ({ user_id: userId, place_id: r.place_id, tags: r.tags, note: r.note })));
      if (e) throw new Error("Non sono riuscito a salvare tutti i posti. Riprova: quelli già salvati non si doppiano.");
      for (const r of fresh) countInto(r, r.tags);
    }
    for (const r of old) {
      const add = r.tags.filter((t) => !isStateTag(t));
      if (add.length === 0 || !userId) continue;
      const current = saved.get(r.place_id) ?? [];
      const missing = add.filter((t) => !current.includes(t));
      if (missing.length === 0) { countInto(r, add); continue; } // c'era già: nella raccolta, niente da scrivere
      await updateTags(userId, [{ placeId: r.place_id, tags: current }], (t) => [...t, ...missing.filter((m) => !t.includes(m))], (_id, next) => {
        if (!next) return; // non riuscito: resta salvato com'era, non si conta
        saved.set(r.place_id, next);
        countInto(r, add);
      });
    }
    return { ok: fresh.length, gia: old.length };
  };

  const loadSaved = async (): Promise<SavedMap> => {
    try {
      const { data } = await (await browserClient()).from("saved_places").select("place_id, tags").eq("user_id", userId);
      return new Map(((data ?? []) as { place_id: string; tags: string[] | null }[]).map((r) => [r.place_id, r.tags ?? []]));
    } catch { return new Map(); }
  };

  // Posti senza coordinate: link-preview con un tetto di MAX_CALLS chiamate; gli altri in coda nel telefono.
  const resolveLinks = async (list: Pending[], saved: SavedMap) => {
    let calls = 0, ok = 0, gia = 0, persi = 0;
    const rest: Pending[] = [];
    for (const p of list) {
      const budget = Math.min(2, MAX_CALLS - calls);
      if (budget <= 0) { rest.push(p); continue; }
      const r = await previewLink(p.url, budget);
      calls += r.chiamate;
      if (r.stato === "riconosciuto") {
        const s = await insertSaved([{ place_id: r.place.id, tags: p.tags, note: p.note, name: p.name }], saved);
        ok += s.ok; gia += s.gia;
      } else if (r.stato === "da_confermare") rest.push(p);
      else persi++;
    }
    return { ok, gia, persi, rest, calls };
  };

  const saveAll = async () => {
    if (!userId || chosen.length === 0) return;
    setPhase("saving");
    setError(null);
    setProgress(0);
    nate.current = new Map();
    let salvati = 0, gia = 0, persi = 0;
    try {
      const saved = await loadSaved();
      const withCoords = chosen.filter((it) => it.lat != null && it.lng != null);
      for (let i = 0; i < withCoords.length; i += CHUNK) {
        const chunk = withCoords.slice(i, i + CHUNK);
        const res = await fetch("/api/places/import-file", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: chunk.map((it) => ({ name: it.name, address: it.address, lat: it.lat, lng: it.lng, googlePlaceId: it.googlePlaceId })) }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error ?? "Qualcosa è andato storto, riprova.");
        const rows: Row[] = [];
        (data.risultati as ({ id?: string } | null)[] ?? []).forEach((r, j) => {
          if (r?.id) rows.push({ place_id: r.id, tags: tagsOf(chunk[j]), note: chunk[j].note, name: chunk[j].name });
          else persi++;
        });
        const s = await insertSaved(rows, saved);
        salvati += s.ok; gia += s.gia;
        setProgress(Math.min(withCoords.length, i + CHUNK) / chosen.length);
      }
      const pending: Pending[] = chosen.filter((it) => it.lat == null && it.url).map((it) => ({ name: it.name, url: it.url!, tags: tagsOf(it), note: it.note }));
      let attesa = 0;
      if (pending.length) {
        const r = await resolveLinks(pending, saved);
        salvati += r.ok; gia += r.gia; persi += r.persi;
        attesa = r.rest.length;
        writeQueue([...readQueue(), ...r.rest]);
        stampRun();
      }
      setDone({ salvati, gia, attesa, persi });
      setRaccolte([...nate.current.values()].sort((a, b) => b.count - a.count));
      setPhase("done");
      // L'esito in vista (revisore 2/11: restava sotto la piega).
      window.setTimeout(() => document.getElementById("file-esito")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      trackFeature("import_file", { contesto: "salvati", risultati: salvati, stato: attesa ? "in_attesa" : "completo" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Qualcosa è andato storto, riprova.");
      setPhase("ready");
    }
  };

  const completeQueue = async () => {
    if (!userId) return;
    setPhase("saving");
    nate.current = new Map();
    const saved = await loadSaved();
    const r = await resolveLinks(readQueue(), saved);
    writeQueue(r.rest);
    stampRun();
    setDone({ salvati: r.ok, gia: r.gia, attesa: r.rest.length, persi: r.persi });
    setRaccolte([...nate.current.values()].sort((a, b) => b.count - a.count));
    setPhase("done");
    trackFeature("import_file", { contesto: "completati", risultati: r.ok });
  };

  const canComplete = now - lastRun() > DAY;
  const skippedWhy = [...new Set(skipped.map((s) => s.motivo))].slice(0, 4).join(", ");

  return (
    <section className="rounded-card border border-border bg-white p-5" data-testid="importa-file">
      {/* Dentro "Altri modi" il titolo c'è già sulla riga che apre il pannello (revisore 2/11: niente doppione). */}
      {titolo && (
        <h2 className="font-title text-xl text-text">
          <span aria-hidden>🗂️ </span>Tutti i salvati di Google Maps
        </h2>
      )}
      {/* A lavoro fatto la presentazione non serve più: parla l'esito (revisore 3/11). */}
      {phase !== "done" && (
        <p className={`${titolo ? "mt-1 " : ""}text-sm text-text-muted`} data-testid="file-intro">Tutti i posti che hai salvato in Google Maps, in un colpo solo. Il file resta nel telefono.</p>
      )}

      {!userId ? (
        <p className="mt-4 text-sm text-text-muted">
          <Link href="/login?next=%2Fimporta" className="underline text-text">Accedi</Link> per importare i tuoi posti.
        </p>
      ) : (
        <>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".json,.geojson,.csv,.kml,.kmz,application/json,text/csv,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz"
            className="sr-only"
            data-testid="file-input"
            onChange={(e) => { void onFiles(e.target.files); e.target.value = ""; }}
          />

          {phase === "idle" && (
            <>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="mt-4 min-h-14 w-full rounded-pill bg-brand px-4 text-base font-display font-semibold text-white"
              >
                Scegli il file
              </button>
              <button type="button" onClick={() => setHelp((h) => !h)} aria-expanded={help} className="mt-1 min-h-11 w-full text-center text-sm text-text-muted underline" data-testid="file-aiuto">
                Come lo scarico da Google?
              </button>
              {help && (
                <ol className="mt-2 space-y-2" data-testid="file-passi">
                  {STEPS.map((s, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-text">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">{i + 1}</span>
                      <span className="pt-0.5">{s}</span>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}

          {phase === "ready" && items && (
            <div className="mt-4" data-testid="file-anteprima">
              <p className="text-base font-semibold text-text" data-testid="file-riepilogo">
                {items.length === 1 ? "Trovato 1 posto" : `Trovati ${items.length} posti`}
                {/* Con più zone i numeri ci sono già sui chip qui sotto (revisore 3/11: detti due volte). */}
                {zones.length === 1 && (zones[0][0] === SENZA_POSIZIONE ? " dalle liste" : ` a ${zones[0][0]}`)}
              </p>

              {/* Una zona sola: niente scelta (revisore 2/11: un filtro per un solo gruppo è rumore). */}
              {zones.length > 1 && (<>
              <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Scegli le zone">
                {zones.map(([z, n]) => {
                  const on = !off.has(z);
                  return (
                    <button
                      key={z}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(z)}
                      data-testid="file-zona"
                      className={`min-h-10 rounded-pill border px-3 text-sm font-medium ${on ? "border-brand bg-brand text-white" : "border-border bg-white text-text-muted"}`}
                    >
                      {z === SENZA_POSIZIONE ? "Dalle liste" : z} · {n}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-4 text-sm">
                <button type="button" className="min-h-10 text-brand underline" onClick={() => setOff(new Set())}>Tutti</button>
                <button type="button" className="min-h-10 text-brand underline" onClick={() => setOff(new Set(zones.map(([z]) => z)))}>Nessuno</button>
              </div>
              </>)}

              <ul className="mt-2 space-y-1 text-xs text-text-muted" data-testid="file-liste">
                {[...new Set(chosen.flatMap((it) => [it.lista, ...it.altreListe]))].slice(0, 5).map((l) => (
                  <li key={l}>«{l}» → {listMapping(l).tag && listMapping(l).tag !== "Viaggi" && listMapping(l).tag !== "Preferiti" ? "diventa una raccolta" : listMapping(l).label}</li>
                ))}
              </ul>

              {skipped.length > 0 && (
                <details className="mt-3 text-xs text-text-muted" data-testid="file-scartati">
                  <summary className="min-h-10 cursor-pointer py-2">Lasciati fuori {skipped.length} ({skippedWhy})</summary>
                  <p className="pb-1">{skipped.slice(0, 30).map((s) => s.name).join(" · ")}{skipped.length > 30 ? " …" : ""}</p>
                </details>
              )}

              {noCoords > 0 && (
                <p className="mt-3 text-xs text-text-muted" data-testid="file-avviso-csv">
                  La posizione dei posti delle liste la cerco io su Google: al massimo {MAX_CALLS} ora, gli altri domani.
                </p>
              )}

              {error && <p className="mt-3 rounded-btn bg-error/10 px-4 py-3 text-sm text-error">{error}</p>}

              <button
                type="button"
                onClick={saveAll}
                disabled={chosen.length === 0}
                data-testid="file-salva"
                className="mt-4 min-h-14 w-full rounded-pill bg-brand px-4 text-base font-display font-semibold text-white disabled:opacity-60"
              >
                {chosen.length === 0 ? "Scegli almeno una zona" : `Salva ${chosen.length} ${chosen.length === 1 ? "posto" : "posti"}`}
              </button>
              <button type="button" onClick={() => { setItems(null); setPhase("idle"); }} className="mt-1 min-h-11 w-full text-center text-sm text-text-muted underline">
                Annulla
              </button>
            </div>
          )}

          {phase === "saving" && (
            <div className="mt-4" data-testid="file-salvataggio">
              <p className="text-sm text-text">Salvo i tuoi posti…</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.max(5, progress * 100)}%` }} />
              </div>
            </div>
          )}

          {phase === "done" && (
            <>
              <div id="file-esito" className={`${titolo ? "mt-4 " : ""}scroll-mt-4 rounded-card bg-success/10 px-4 py-3`} data-testid="file-fatto">
                <p className="text-[15px] font-semibold text-text">
                  <span aria-hidden>✅ </span>{done.salvati > 0 ? `${done.salvati === 1 ? "Salvato" : "Salvati"} ${done.salvati} ${done.salvati === 1 ? "posto" : "posti"}` : "Nessun posto nuovo"}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  {[done.gia ? `${done.gia} li avevi già` : "", done.attesa && queued === 0 ? `${done.attesa} da completare` : "", done.persi ? `${done.persi} non trovati` : ""].filter(Boolean).join(" · ")}
                </p>
                {raccolte.length === 0 && (
                  <Link href="/mappa?vista=salvati" className="mt-3 inline-flex min-h-11 items-center rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white">
                    Vedili sulla mappa
                  </Link>
                )}
              </div>
              {raccolte.length > 0 && (
                // Proposta 39: le liste di Google diventate raccolte, come copertine fuori dal riquadro dell'esito
                // (revisore 2/11: niente tre livelli annidati). Una raccolta sola: "Apri la raccolta" è l'azione principale.
                <div className="mt-4" data-testid="file-raccolte">
                  <p className="text-sm font-semibold text-text">{raccolte.length === 1 ? "La tua raccolta" : `Le tue ${raccolte.length} raccolte`}</p>
                  {raccolte.length === 1 ? (
                    // Copertina a tutta larghezza e pulsante sotto, come con più raccolte (revisore 3/11: in colonna
                    // stretta "Apri la raccolta" andava a capo).
                    <div className="mt-2">
                      <Link href={collectionPath(raccolte[0].tag)} className="block w-full" data-testid="file-raccolta">
                        <RaccoltaCopertina name={raccolte[0].tag} count={raccolte[0].count} emojis={raccolte[0].emojis} compact riempi />
                      </Link>
                      <Link href={collectionPath(raccolte[0].tag)} className="mt-3 flex min-h-12 w-full items-center justify-center whitespace-nowrap rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white" data-testid="file-raccolta-apri">
                        Apri la raccolta
                      </Link>
                      <Link href="/mappa?vista=salvati" className="mt-1 flex min-h-11 w-full items-center justify-center whitespace-nowrap text-sm font-semibold text-brand underline">
                        Sulla mappa
                      </Link>
                    </div>
                  ) : (
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      {raccolte.slice(0, 6).map((r) => (
                        <Link key={r.tag} href={collectionPath(r.tag)} className="block" data-testid="file-raccolta">
                          <RaccoltaCopertina name={r.tag} count={r.count} emojis={r.emojis} compact riempi />
                        </Link>
                      ))}
                    </div>
                  )}
                  {raccolte.length > 1 && (
                    <Link href="/mappa?vista=salvati" className="mt-3 flex min-h-12 w-full items-center justify-center rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white">
                      Vedili sulla mappa
                    </Link>
                  )}
                </div>
              )}
            </>
          )}

          {queued > 0 && phase !== "saving" && phase !== "ready" && (
            <div className="mt-4 flex items-center gap-3 rounded-btn border border-border bg-white px-3 py-3" data-testid="file-coda">
              <p className="min-w-0 flex-1 text-sm text-text">{queued} {queued === 1 ? "posto aspetta" : "posti aspettano"} la posizione</p>
              {/* Revisore 3/11 (quarto): l'esito sopra non lo ripete; "Altri domani" è un'informazione, non un pulsante spento. */}
              {canComplete ? (
                <button
                  type="button"
                  onClick={completeQueue}
                  className="min-h-11 shrink-0 rounded-pill border border-brand bg-white px-3 text-sm font-display font-semibold text-brand"
                >
                  Completa i prossimi
                </button>
              ) : (
                <span className="shrink-0 text-sm text-text-muted">Altri domani</span>
              )}
            </div>
          )}

          {phase === "idle" && error && <p className="mt-3 rounded-btn bg-error/10 px-4 py-3 text-sm text-error" data-testid="file-errore">{error}</p>}
        </>
      )}
    </section>
  );
}
