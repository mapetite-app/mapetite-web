"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { trackFeature } from "@/lib/track";
import { zipTextFiles } from "@/lib/zip-leggi";
import { IG_FILE_SALVATI, parseInstagram, type IgSalvato } from "@/lib/instagram-salvati";

// "Salvati di Instagram" (proposta 30): il file che Meta fa scaricare (zip, JSON o HTML) si legge NEL
// TELEFONO e non va mai al server. Ne esce l'elenco dei post e dei reel salvati; "Salva" apre il flusso
// già esistente "Salva dal reel" con quel link (/importa/condividi?url=…). Nessuna ricerca Google finché
// la persona non conferma lì; nel database, come oggi, solo il link del reel collegato al posto salvato.
// L'elenco resta in questo telefono (localStorage) con le righe già aperte, per continuare un'altra volta.

const KEY = "mapetite.instagram.salvati";
const EVENT = "mapetite-instagram";
const PAGE = 30;
const MAX_ITEMS = 3000;

type Store = { items: IgSalvato[]; aperti: string[] };

// Senza localStorage (navigazione privata) l'elenco vive almeno finché la pagina resta aperta.
let memoria: string | null = null;
function readRaw(): string | null {
  try { return localStorage.getItem(KEY) ?? memoria; } catch { return memoria; }
}
function writeStore(s: Store | null) {
  memoria = s ? JSON.stringify({ items: s.items.slice(0, MAX_ITEMS), aperti: s.aperti.slice(-MAX_ITEMS) }) : null;
  try { if (memoria) localStorage.setItem(KEY, memoria); else localStorage.removeItem(KEY); } catch { /* privata o piena */ }
  window.dispatchEvent(new Event(EVENT));
}
const subscribe = (cb: () => void) => { window.addEventListener(EVENT, cb); return () => window.removeEventListener(EVENT, cb); };
function parseStore(raw: string | null): Store | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Store;
    return Array.isArray(s?.items) && s.items.length > 0 ? { items: s.items, aperti: Array.isArray(s.aperti) ? s.aperti : [] } : null;
  } catch { return null; }
}

const dataBreve = (ms: number | null) =>
  ms ? new Date(ms).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" }) : null;

// Il file: zip intero del download, oppure i singoli JSON/HTML (saved_posts, saved_collections).
async function readFiles(files: File[]): Promise<{ name: string; text: string }[]> {
  const out: { name: string; text: string }[] = [];
  for (const f of files.slice(0, 10)) {
    if (f.size > 200 * 1024 * 1024) continue;
    try {
      if (/\.zip$/i.test(f.name) || f.type.includes("zip")) {
        const buf = await f.arrayBuffer();
        const saved = await zipTextFiles(buf, IG_FILE_SALVATI);
        // Nomi dei file diversi dal solito: si leggono tutti i JSON/HTML piccoli dello zip.
        out.push(...(saved.length > 0 ? saved : await zipTextFiles(buf, /\.(json|html?)$/i, 80)));
      } else if (f.size <= 30 * 1024 * 1024) {
        out.push({ name: f.name, text: await f.text() });
      }
    } catch { /* file illeggibile: si passa al prossimo */ }
  }
  return out;
}

export default function InstagramCard({ userId }: { userId: string | null }) {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  const store = useMemo(() => parseStore(raw), [raw]);
  const [filtro, setFiltro] = useState<string | null>(null);
  const [quanti, setQuanti] = useState(PAGE);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setError(null);
    setReading(true);
    const files = Array.from(list);
    const texts = await readFiles(files);
    const { items } = parseInstagram(texts);
    setReading(false);
    if (items.length === 0) {
      setError("In questo file non trovo post salvati. Scarica da Instagram solo «Elementi salvati» e carica lo zip.");
      return;
    }
    writeStore({ items, aperti: store?.aperti ?? [] });
    setFiltro(null);
    setQuanti(PAGE);
    trackFeature("import_instagram", { contesto: "letti", risultati: items.length, fonte: files.some((f) => /\.zip$/i.test(f.name)) ? "zip" : /\.json$/i.test(files[0].name) ? "json" : "html" });
  };

  const items = useMemo(() => store?.items ?? [], [store]);
  const aperti = useMemo(() => new Set(store?.aperti ?? []), [store]);
  const raccolte = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) for (const r of it.raccolte) m.set(r, (m.get(r) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "it"));
  }, [items]);
  const visibili = filtro ? items.filter((it) => it.raccolte.includes(filtro)) : items;
  const tuttiReel = items.length > 0 && items.every((it) => it.tipo === "reel");
  const nAperti = items.filter((it) => aperti.has(it.codice)).length;

  // Prima di aprire il flusso del reel: la riga resta "Aperto" e il "torna indietro" riapre questa scheda.
  const apri = (it: IgSalvato) => {
    if (store && !aperti.has(it.codice)) writeStore({ items: store.items, aperti: [...store.aperti, it.codice] });
    try { window.history.replaceState(window.history.state, "", `${window.location.pathname}#da-instagram`); } catch { /* niente */ }
    trackFeature("import_instagram", { contesto: "apri", stato: aperti.has(it.codice) ? "riaperto" : "nuovo" });
  };

  if (!userId) {
    return (
      <section className="rounded-card border border-border bg-white p-5" data-testid="importa-instagram">
        <p className="text-sm text-text-muted">
          <Link href="/login?next=%2Fimporta" className="underline text-text">Accedi</Link> per portare qui i salvati di Instagram.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-card border border-border bg-white p-5" data-testid="importa-instagram">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".zip,.json,.html,.htm,application/zip,application/json,text/html"
        className="sr-only"
        data-testid="ig-input"
        onChange={(e) => { void onFiles(e.target.files); e.target.value = ""; }}
      />

      {!store ? (
        <>
          <p className="text-sm text-text" data-testid="ig-intro">I post e i reel che hai salvato su Instagram, in un elenco: da lì salvi i locali. Il file resta nel telefono.</p>
          <p className="mt-2 text-xs leading-relaxed text-text-muted" data-testid="ig-come">
            Su Instagram: <b className="font-medium text-text">Centro gestione account</b> → <b className="font-medium text-text">Le tue informazioni e autorizzazioni</b> → <b className="font-medium text-text">Scarica le tue informazioni</b> → solo <b className="font-medium text-text">Elementi salvati</b>.
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={reading}
            data-testid="ig-carica"
            className="mt-4 min-h-14 w-full rounded-pill bg-brand px-4 text-base font-display font-semibold text-white disabled:opacity-60"
          >
            {reading ? "Leggo il file…" : "Carica il file"}
          </button>
          {error && <p className="mt-3 rounded-btn bg-error/10 px-4 py-3 text-sm text-error" data-testid="ig-errore">{error}</p>}
        </>
      ) : (
        <div data-testid="ig-elenco">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-display text-lg font-semibold text-text" data-testid="ig-riepilogo">
              {items.length} {tuttiReel ? "reel" : "post"} {items.length === 1 ? "salvato" : "salvati"}
            </p>
            <button type="button" onClick={() => inputRef.current?.click()} className="min-h-10 shrink-0 text-sm text-text-muted underline" data-testid="ig-cambia">
              {reading ? "Leggo…" : "Cambia file"}
            </button>
          </div>
          <p className="text-sm text-text-muted" data-testid="ig-sotto">
            Tocca Salva su quelli con un locale{nAperti > 0 ? ` · ${nAperti} ${nAperti === 1 ? "aperto" : "aperti"}` : ""}.
          </p>
          {error && <p className="mt-3 rounded-btn bg-error/10 px-4 py-3 text-sm text-error" data-testid="ig-errore">{error}</p>}

          {raccolte.length > 0 && (
            // Una riga sola che scorre di lato: con tante raccolte l'elenco resta in vista.
            <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]" role="group" aria-label="Raccolte di Instagram">
              {[[null, items.length] as const, ...raccolte].map(([r, n]) => {
                const on = filtro === r;
                return (
                  <button
                    key={r ?? "tutti"}
                    type="button"
                    aria-pressed={on}
                    onClick={() => { setFiltro(r); setQuanti(PAGE); }}
                    data-testid="ig-raccolta"
                    className={`min-h-10 max-w-[70%] shrink-0 truncate whitespace-nowrap rounded-pill border px-3 text-sm font-medium ${on ? "border-brand bg-brand text-white" : "border-border bg-white text-text"}`}
                  >
                    {r ?? "Tutti"} · {n}
                  </button>
                );
              })}
            </div>
          )}

          <ul className="mt-3 divide-y divide-border border-t border-border" data-testid="ig-righe">
            {visibili.slice(0, quanti).map((it) => {
              const fatto = aperti.has(it.codice);
              const sotto = [dataBreve(it.salvatoIl), filtro ? null : it.raccolte[0]].filter(Boolean).join(" · ");
              return (
                <li key={it.codice} className="flex min-h-16 items-center gap-3 py-2.5" data-testid="ig-riga">
                  <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-lg">
                    {it.tipo === "p" ? "🖼️" : "🎬"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-text">
                      {it.autore ? `@${it.autore}` : it.tipo === "reel" ? "Reel di Instagram" : "Post di Instagram"}
                    </span>
                    {sotto && <span className="block truncate text-xs text-text-muted">{sotto}</span>}
                  </span>
                  <Link
                    href={`/importa/condividi?url=${encodeURIComponent(it.url)}`}
                    onClick={() => apri(it)}
                    data-testid="ig-salva"
                    data-aperto={fatto ? "1" : undefined}
                    aria-label={`${fatto ? "Aperto, riapri" : "Salva"}: ${it.autore ? `@${it.autore}` : "post di Instagram"}`}
                    className={`inline-flex min-h-10 shrink-0 items-center rounded-pill px-4 text-sm font-display font-semibold ${fatto ? "bg-surface text-text-muted" : "border border-brand bg-white text-brand"}`}
                  >
                    {fatto ? "✓ Aperto" : "Salva"}
                  </Link>
                </li>
              );
            })}
          </ul>
          {visibili.length > quanti && (
            <button type="button" onClick={() => setQuanti((q) => q + PAGE)} className="mt-2 min-h-11 w-full rounded-pill border border-border bg-white text-sm font-display font-semibold text-brand" data-testid="ig-altri">
              Mostra altri {Math.min(PAGE, visibili.length - quanti)}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
