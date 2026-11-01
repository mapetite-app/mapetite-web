"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { browserClient } from "@/lib/supabase/client-lazy";
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

const tagsOf = (it: { lista: string }) => {
  const m = listMapping(it.lista);
  return [m.stato, m.tag].filter((t): t is string => Boolean(t));
};

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
  <>Apri lo zip e carica qui <b>Saved Places.json</b> o i file <b>.csv</b> delle tue liste (anche più insieme).</>,
];

export default function TakeoutCard({ userId }: { userId: string | null }) {
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
  const queued = useSyncExternalStore(subscribeQueue, queueLength, () => 0);

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    const seen = new Set<string>();
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

  // Salva le righe in saved_places saltando quelle già salvate (il vincolo unico fermerebbe tutto il gruppo).
  const insertSaved = async (rows: { place_id: string; tags: string[]; note: string | null }[], savedIds: Set<string>) => {
    const fresh = rows.filter((r) => !savedIds.has(r.place_id) && (savedIds.add(r.place_id), true));
    if (fresh.length === 0) return { ok: 0, gia: rows.length };
    const { error: e } = await (await browserClient()).from("saved_places").insert(fresh.map((r) => ({ user_id: userId, ...r })));
    if (e) throw new Error("Non sono riuscito a salvare tutti i posti. Riprova: quelli già salvati non si doppiano.");
    return { ok: fresh.length, gia: rows.length - fresh.length };
  };

  const loadSavedIds = async () => {
    try {
      const { data } = await (await browserClient()).from("saved_places").select("place_id").eq("user_id", userId);
      return new Set(((data ?? []) as { place_id: string }[]).map((r) => r.place_id));
    } catch { return new Set<string>(); }
  };

  // Posti senza coordinate: link-preview con un tetto di MAX_CALLS chiamate; gli altri in coda nel telefono.
  const resolveLinks = async (list: Pending[], savedIds: Set<string>) => {
    let calls = 0, ok = 0, gia = 0, persi = 0;
    const rest: Pending[] = [];
    for (const p of list) {
      const budget = Math.min(2, MAX_CALLS - calls);
      if (budget <= 0) { rest.push(p); continue; }
      const r = await previewLink(p.url, budget);
      calls += r.chiamate;
      if (r.stato === "riconosciuto") {
        const s = await insertSaved([{ place_id: r.place.id, tags: p.tags, note: p.note }], savedIds);
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
    let salvati = 0, gia = 0, persi = 0;
    try {
      const savedIds = await loadSavedIds();
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
        const rows: { place_id: string; tags: string[]; note: string | null }[] = [];
        (data.risultati as ({ id?: string } | null)[] ?? []).forEach((r, j) => {
          if (r?.id) rows.push({ place_id: r.id, tags: tagsOf(chunk[j]), note: chunk[j].note });
          else persi++;
        });
        const s = await insertSaved(rows, savedIds);
        salvati += s.ok; gia += s.gia;
        setProgress(Math.min(withCoords.length, i + CHUNK) / chosen.length);
      }
      const pending: Pending[] = chosen.filter((it) => it.lat == null && it.url).map((it) => ({ name: it.name, url: it.url!, tags: tagsOf(it), note: it.note }));
      let attesa = 0;
      if (pending.length) {
        const r = await resolveLinks(pending, savedIds);
        salvati += r.ok; gia += r.gia; persi += r.persi;
        attesa = r.rest.length;
        writeQueue([...readQueue(), ...r.rest]);
        stampRun();
      }
      setDone({ salvati, gia, attesa, persi });
      setPhase("done");
      trackFeature("import_file", { contesto: "salvati", risultati: salvati, stato: attesa ? "in_attesa" : "completo" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Qualcosa è andato storto, riprova.");
      setPhase("ready");
    }
  };

  const completeQueue = async () => {
    if (!userId) return;
    setPhase("saving");
    const savedIds = await loadSavedIds();
    const r = await resolveLinks(readQueue(), savedIds);
    writeQueue(r.rest);
    stampRun();
    setDone({ salvati: r.ok, gia: r.gia, attesa: r.rest.length, persi: r.persi });
    setPhase("done");
    trackFeature("import_file", { contesto: "completati", risultati: r.ok });
  };

  const canComplete = now - lastRun() > DAY;
  const skippedWhy = [...new Set(skipped.map((s) => s.motivo))].slice(0, 4).join(", ");

  return (
    <section className="rounded-card border border-border bg-surface p-5" data-testid="importa-file">
      <h2 className="font-title text-xl text-text">
        <span aria-hidden>🗂️ </span>Carica il file di Google Maps
      </h2>
      <p className="mt-1 text-sm text-text-muted">Tutti i posti che hai salvato in Google Maps, in un colpo solo. Il file resta nel telefono.</p>

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
                Trovati {items.length} {items.length === 1 ? "posto" : "posti"}
                {zones.length > 0 && ": "}
                {zones.slice(0, 3).map(([z, n], i) => (
                  <span key={z}>{i ? ", " : ""}{n} {z === SENZA_POSIZIONE ? "senza posizione" : `a ${z}`}</span>
                ))}
                {zones.length > 3 && "…"}
              </p>

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
                      {z} · {n}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-4 text-sm">
                <button type="button" className="min-h-10 text-brand underline" onClick={() => setOff(new Set())}>Tutti</button>
                <button type="button" className="min-h-10 text-brand underline" onClick={() => setOff(new Set(zones.map(([z]) => z)))}>Nessuno</button>
              </div>

              <ul className="mt-2 space-y-1 text-xs text-text-muted" data-testid="file-liste">
                {[...new Set(chosen.map((it) => it.lista))].slice(0, 5).map((l) => (
                  <li key={l}>«{l}» → {listMapping(l).label}</li>
                ))}
              </ul>

              {skipped.length > 0 && (
                <details className="mt-3 text-xs text-text-muted" data-testid="file-scartati">
                  <summary className="min-h-10 cursor-pointer py-2">Lasciati fuori {skipped.length} che non sono locali ({skippedWhy})</summary>
                  <p className="pb-1">{skipped.slice(0, 30).map((s) => s.name).join(" · ")}{skipped.length > 30 ? " …" : ""}</p>
                </details>
              )}

              {noCoords > 0 && (
                <p className="mt-3 rounded-btn bg-accent/10 px-3 py-2 text-xs text-text" data-testid="file-avviso-csv">
                  {noCoords} {noCoords === 1 ? "posto non ha" : "posti non hanno"} la posizione nel file: ne cerco su Google al massimo {MAX_CALLS} ora, gli altri li completi da qui un gruppo al giorno.
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
            <div className="mt-4 rounded-card border border-success/30 bg-success/10 p-4 text-center" data-testid="file-fatto">
              <p className="font-display text-lg font-semibold text-text">
                {done.salvati > 0 ? `Salvati ${done.salvati} ${done.salvati === 1 ? "posto" : "posti"}` : "Nessun posto nuovo"}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                {[done.gia ? `${done.gia} li avevi già` : "", done.attesa ? `${done.attesa} da completare` : "", done.persi ? `${done.persi} non trovati` : ""].filter(Boolean).join(" · ")}
              </p>
              <Link href="/mappa?vista=salvati" className="mt-3 inline-flex min-h-11 items-center rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white">
                Vedili sulla mappa
              </Link>
            </div>
          )}

          {queued > 0 && phase !== "saving" && phase !== "ready" && (
            <div className="mt-4 flex items-center gap-3 rounded-btn border border-border bg-white px-3 py-3" data-testid="file-coda">
              <p className="min-w-0 flex-1 text-sm text-text">{queued} {queued === 1 ? "posto aspetta" : "posti aspettano"} la posizione</p>
              <button
                type="button"
                onClick={completeQueue}
                disabled={!canComplete}
                className="min-h-11 shrink-0 rounded-pill border border-brand bg-white px-3 text-sm font-display font-semibold text-brand disabled:opacity-60"
              >
                {canComplete ? `Completa i prossimi` : "Altri domani"}
              </button>
            </div>
          )}

          {phase === "idle" && error && <p className="mt-3 rounded-btn bg-error/10 px-4 py-3 text-sm text-error" data-testid="file-errore">{error}</p>}
        </>
      )}
    </section>
  );
}
