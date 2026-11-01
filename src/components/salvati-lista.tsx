"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bookmark, Check, ChevronDown, Map as MapIcon, Plus, Search, SlidersHorizontal, Sparkles, SquarePlay, UtensilsCrossed, X } from "lucide-react";
import type { Place } from "@/app/mappa/map-view";
import { browserClient } from "@/lib/supabase/client-lazy";
import { getCategoryEmoji } from "@/lib/emoji";
import { categoryLabel } from "@/lib/category-label";
import { cityFromAddress } from "@/lib/city";
import { distanceLabel, distanceMeters } from "@/lib/distance";
import { OPINION_LIKE, STATE_TAGS, tagDisplay } from "@/lib/tags";
import { collectionColor, summarizeCollections } from "@/lib/raccolte";
import { MAX_POSTI, sembraDomanda } from "@/lib/chiedi-salvati";
import { trackFeature } from "@/lib/track";

// Schermata "Salvati" (mockup C "Card bianche" vestito in stile A "Editoriale", scelto da Lorenzo
// nella PR #87; rifatta dopo il giro del 1/11 come Places/Albo): fondo carta, titolo in serif, filtri
// di stato con i conteggi veri, Filtri, "Stasera" e ordine (Vicino / Recenti) su una sola riga scorrevole,
// raccolte come copertine basse (mosaico e nome dentro) sotto, righe con lo stato sempre, 👍,
// verdetto e provenienza sotto il nome, così il nome ha tutta la riga.
// Cosa principale: ritrovare un posto. Il resto (città, tipo, voto, prezzo) sta nel foglio "Filtri"
// di map-view; la mappa è a un tocco (icona in alto). Nessuna foto: le foto Google non si
// conservano e chiederle per ogni salvato costerebbe quota; si usano emoji su un fondo unico.

const [WANT, DONE] = STATE_TAGS;
const SERIF = "font-[family-name:var(--font-newsreader)]";
const PAPER = "bg-[#f8f6f2]";
const LINE = "border-[#e8e2d8]";

// Miniatura al posto della foto: emoji del tipo su un fondo carta unico (giro 1/11, D42: niente
// colori a caso tra un posto e l'altro). Le raccolte invece hanno il loro colore, come cartelle.
function Miniatura({ place, size }: { place: Place; size: string }) {
  return (
    <span aria-hidden className={`flex shrink-0 items-center justify-center border border-[#e6dfd3] bg-[linear-gradient(160deg,#f6f1e8,#ebe3d6)] ${size}`}>
      {getCategoryEmoji(place.category, place.name)}
    </span>
  );
}

// Copertina di una raccolta (correzione del revisore, 1/11): bassa (64 px), come una cartella colorata,
// con il mosaico delle emoji dei primi posti a sinistra e il nome dentro, il numero piccolo accanto.
// Così la lista dei posti parte entro i primi 330 px anche con 2–3 raccolte.
function Copertina({ name, count, preview, on }: { name: string; count: number; preview: Place[]; on: boolean }) {
  const tiles = preview.slice(0, 4);
  return (
    <span
      data-testid="raccolta-copertina"
      className={`flex h-16 w-full items-center gap-2 overflow-hidden rounded-[16px] p-1.5 pr-3 ${on ? "shadow-[0_0_0_2px_#f8f6f2,0_0_0_4px_#ff6b4a]" : ""}`}
      style={{ background: collectionColor(name) }}
    >
      <span aria-hidden className={`grid h-[44px] w-[44px] shrink-0 gap-[2px] overflow-hidden rounded-[11px] ${tiles.length >= 2 ? "grid-cols-2 grid-rows-2" : "grid-cols-1"}`}>
        {tiles.length === 0 ? (
          <span className="flex items-center justify-center rounded-[11px] bg-white/[0.13] text-[26px]">📍</span>
        ) : (
          tiles.map((t, i) => (
            <span
              key={t.id}
              className={`flex items-center justify-center bg-white/[0.13] ${tiles.length === 1 ? "rounded-[11px] text-[26px]" : `rounded-[6px] text-[13px] ${tiles.length === 2 || (tiles.length === 3 && i === 0) ? "row-span-2" : ""}`}`}
            >
              {getCategoryEmoji(t.category, t.name)}
            </span>
          ))
        )}
      </span>
      <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
        <span className={`${SERIF} min-w-0 truncate text-[16px] font-medium leading-tight text-white`}>{tagDisplay(name)}</span>
        <span className="shrink-0 text-[12px] font-semibold text-white/75">{count}</span>
      </span>
    </span>
  );
}

const FONTE_LABEL: Record<string, string> = { Instagram: "Reel Instagram", TikTok: "Video TikTok", YouTube: "Video YouTube" };

export default function SalvatiLista({
  userId,
  all,
  shown,
  activeTag,
  onTag,
  activeCity,
  onClearCity,
  query,
  onQuery,
  origin,
  locating,
  onLocate,
  filtersOn,
  onFilters,
  verdicts,
  onOpen,
  onMap,
  hideOnDesktop = false,
}: {
  userId: string;
  all: Place[]; // tutti i salvati
  shown: Place[]; // dopo stato/raccolta, città e testo cercato
  activeTag: string | null;
  onTag: (tag: string | null) => void;
  activeCity: string | null;
  onClearCity: () => void;
  query: string;
  onQuery: (value: string) => void;
  origin: { lat: number; lng: number } | null;
  locating: boolean;
  onLocate: () => void;
  filtersOn: number;
  onFilters: () => void;
  verdicts: Record<string, { verdict?: string | null }>;
  onOpen: (place: Place, order: string[]) => void;
  onMap: () => void;
  hideOnDesktop?: boolean;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  // Ordine visibile (giro 1/11): "Vicino" se la posizione è nota, altrimenti "Recenti". Si cambia con un tocco.
  const [ordine, setOrdine] = useState<"vicino" | "recenti" | null>(null);
  // "Chiedi ai tuoi posti" (PROPOSTE.md 33): una domanda a parole, l'AI sceglie solo tra i salvati.
  // Parte solo al tocco (o Invio): una chiamata Haiku per domanda, nessuna ricerca Google.
  type Risposta = { q: string; stato: "cerco" | "ok" | "errore"; scelti: { id: string; perche: string }[]; msg?: string };
  const [risposta, setRisposta] = useState<Risposta | null>(null);
  const chiedi = async () => {
    const q = query.trim();
    if (!sembraDomanda(q) || (risposta?.q === q && risposta.stato !== "errore")) return;
    setRisposta({ q, stato: "cerco", scelti: [] });
    try {
      const r = await fetch("/api/salvati/chiedi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domanda: q }) });
      const j = await r.json().catch(() => ({}));
      const scelti = r.ok && Array.isArray(j.scelti) ? (j.scelti as { id: string; perche: string }[]) : [];
      setRisposta((cur) => (cur?.q !== q ? cur : r.ok ? { q, stato: "ok", scelti } : { q, stato: "errore", scelti: [], msg: typeof j.error === "string" ? j.error : "Non sono riuscito a rispondere: riprova." }));
      trackFeature("chiedi_salvati", { stato: r.ok ? (scelti.length ? "trovati" : "nessuno") : "errore", n: scelti.length });
    } catch {
      setRisposta((cur) => (cur?.q !== q ? cur : { q, stato: "errore", scelti: [], msg: "Sei offline: riprova tra poco." }));
    }
  };
  // Reel e video collegati ai salvati (contenuti_locali, solo i propri): da dove arriva il posto.
  // Una lettura su Supabase, nessuna chiamata Google. Senza tabella o rete: niente etichetta.
  const [reels, setReels] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    browserClient()
      .then((supabase) => supabase.from("contenuti_locali").select("place_id, fonte").eq("user_id", userId))
      .then(({ data, error }) => {
        if (!alive || error || !data) return;
        const byPlace: Record<string, string> = {};
        for (const row of data as { place_id: string; fonte: string }[]) {
          if (!byPlace[row.place_id] && FONTE_LABEL[row.fonte]) byPlace[row.place_id] = row.fonte;
        }
        setReels(byPlace);
      })
      .catch(() => { /* rete assente: la lista resta senza provenienza */ });
    return () => { alive = false; };
  }, [userId]);

  const count = (tag: string) => all.filter((p) => p.tags?.includes(tag)).length;
  // Copertine: i posti più recenti di ogni raccolta (la lista arriva dal più vecchio al più nuovo).
  const collections = useMemo(() => summarizeCollections([...all].reverse(), 4), [all]);
  // "5 posti · Roma e Milano": le città vere dei salvati, le più frequenti per prime.
  const kicker = useMemo(() => {
    const byCity = new globalThis.Map<string, number>();
    for (const p of all) {
      const c = cityFromAddress(p.address);
      if (c) byCity.set(c, (byCity.get(c) ?? 0) + 1);
    }
    const cities = [...byCity.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
    const where = cities.length === 0 ? "" : cities.length === 1 ? cities[0] : cities.length === 2 ? `${cities[0]} e ${cities[1]}` : `${cities[0]}, ${cities[1]} e altre`;
    return `${all.length} ${all.length === 1 ? "posto" : "posti"}${where ? ` · ${where}` : ""}`;
  }, [all]);
  // Per vicinanza quando la posizione è nota (mai chiesta da sola: la chiede il tocco su "Vicino");
  // "Recenti" = dall'ultimo salvato (map-view li legge dal più vecchio al più nuovo).
  const sort = ordine ?? (origin ? "vicino" : "recenti");
  const list = useMemo(
    () => (sort === "vicino" && origin ? [...shown].sort((a, b) => distanceMeters(origin, a) - distanceMeters(origin, b)) : sort === "recenti" ? [...shown].reverse() : shown),
    [shown, origin, sort],
  );
  const searching = searchOpen || query !== "";
  const domanda = searching && sembraDomanda(query);
  // La risposta vale solo per la domanda scritta adesso.
  const attuale = domanda && risposta?.q === query.trim() ? risposta : null;
  // Con un filtro acceso pillole e raccolte restano: chi cerca deve vedere che il filtro c'è.
  const soloRisposta = domanda && list.length === 0 && activeTag === null && activeCity === null;
  const scelti = (attuale?.scelti ?? []).map((s) => ({ ...s, place: all.find((p) => p.id === s.id) })).filter((s): s is typeof s & { place: Place } => !!s.place);
  const stateOn = activeTag === WANT || activeTag === DONE;
  const pills: { label: string; n: number | null; on: boolean; tag: string | null }[] = [
    // "Tutti" senza numero: il totale è già sopra il titolo ("3 posti · Roma").
    { label: "Tutti", n: null, on: !stateOn && !collections.some((c) => c.name === activeTag), tag: null },
    { label: "Da provare", n: count(WANT), on: activeTag === WANT, tag: WANT },
    { label: "Ci sono stato", n: count(DONE), on: activeTag === DONE, tag: DONE },
    // Revisore 1/11: "Ci sono stato 0" è un filtro morto; torna appena c'è un posto (o se è acceso).
  ].filter((p) => p.tag !== DONE || (p.n ?? 0) > 0 || p.on);
  const iconBtn = "flex h-11 w-11 items-center justify-center rounded-full border border-[#ddd5c8] text-text active:scale-95";

  return (
    <section
      data-testid="salvati-lista"
      aria-label="I tuoi posti"
      className={`absolute inset-0 z-30 overflow-y-auto overscroll-contain ${PAPER} pb-[calc(var(--nav-height-mobile)+7rem)] lg:left-auto lg:w-[var(--pannello)] lg:border-l lg:border-border ${hideOnDesktop ? "lg:hidden" : ""}`}
    >
      <div className="mx-auto max-w-md px-4 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <p data-testid="salvati-lista-sopra" className="truncate font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">{kicker}</p>
        <header className="mt-1.5 flex items-center justify-between gap-3">
          <h1 className={`${SERIF} min-w-0 text-[38px] font-medium leading-none tracking-tight text-text`}>I tuoi posti</h1>
          <div className="flex shrink-0 gap-2">
            <button type="button" aria-label="Cerca" aria-pressed={searching} onClick={() => { if (searching) { onQuery(""); setSearchOpen(false); } else setSearchOpen(true); }} className={`${iconBtn} ${searching ? "bg-brand text-white border-brand" : ""}`}>
              <Search size={18} aria-hidden />
            </button>
            <button type="button" data-testid="salvati-lista-mappa" aria-label="Vedi sulla mappa" onClick={onMap} className={iconBtn}>
              <MapIcon size={18} aria-hidden />
            </button>
            <Link href="/importa" aria-label="Aggiungi un posto" className={`${iconBtn} border-brand bg-brand text-white`}>
              <Plus size={20} aria-hidden />
            </Link>
          </div>
        </header>

        {searching && (
          <form role="search" onSubmit={(e) => { e.preventDefault(); void chiedi(); }} className="mt-4 flex items-center gap-2 rounded-pill border border-[#ddd5c8] bg-white pl-4 pr-1">
            <Search size={16} className="shrink-0 text-text-muted" aria-hidden />
            <input
              type="search"
              autoFocus={query === ""}
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              enterKeyHint="search"
              placeholder="Nome, zona o una domanda…"
              aria-label="Cerca nei tuoi posti"
              className="min-h-11 min-w-0 flex-1 bg-transparent text-base text-text placeholder:text-text-muted focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {query !== "" && (
              <button type="button" aria-label="Cancella" onClick={() => onQuery("")} className="flex h-11 w-11 items-center justify-center text-text-muted">
                <X size={16} aria-hidden />
              </button>
            )}
          </form>
        )}

        {domanda && (
          <section data-testid="chiedi-salvati" aria-live="polite" className="mt-3">
            {!attuale ? (
              // Con risultati per nome (es. "Da Enzo al 29") il pulsante resta secondario: non copre la lista.
              <button type="button" data-testid="chiedi-salvati-vai" onClick={() => void chiedi()} className={`flex min-h-11 w-full items-center gap-2 rounded-pill px-4 text-left text-sm font-display font-semibold active:scale-[0.98] ${list.length === 0 || query.includes("?") ? "bg-accent text-white" : "border border-[#ddd5c8] bg-white text-accent"}`}>
                <Sparkles size={16} aria-hidden className="shrink-0" />
                <span className="min-w-0 flex-1 truncate">Chiedi ai tuoi posti</span>
              </button>
            ) : attuale.stato === "cerco" ? (
              <p data-testid="chiedi-salvati-cerco" className="flex min-h-11 items-center gap-2 px-1 text-sm text-text-muted">
                <Sparkles size={16} aria-hidden className="animate-pulse text-accent" /> Guardo tra i tuoi {Math.min(all.length, MAX_POSTI)} posti…
              </p>
            ) : attuale.stato === "errore" ? (
              <div data-testid="chiedi-salvati-errore" className={`rounded-card border ${LINE} bg-white p-4`}>
                <p className="text-sm text-text">{attuale.msg}</p>
                <button type="button" onClick={() => void chiedi()} className="mt-3 inline-flex min-h-11 items-center rounded-pill bg-brand px-4 text-sm font-display font-semibold text-white active:scale-95">
                  Riprova
                </button>
              </div>
            ) : scelti.length === 0 ? (
              <div data-testid="chiedi-salvati-nessuno" className={`rounded-card border ${LINE} bg-white p-4`}>
                <p className="text-sm text-text">Tra i tuoi posti nessuno fa al caso.</p>
                <Link href={`/assistente?q=${encodeURIComponent(query.trim())}`} className="mt-3 inline-flex min-h-11 items-center rounded-pill bg-brand px-4 text-sm font-display font-semibold text-white active:scale-95">
                  Cercane uno nuovo
                </Link>
              </div>
            ) : (
              <>
                <h2 className="flex items-center gap-1.5 px-1 font-display text-xs font-semibold uppercase tracking-[0.12em] text-accent">
                  <Sparkles size={13} aria-hidden /> Tra i tuoi posti
                </h2>
                <ul data-testid="chiedi-salvati-scelti" className={`mt-2 overflow-hidden rounded-card border ${LINE} bg-white shadow-card`}>
                  {scelti.map((s, i) => (
                    <li key={s.id} className={i > 0 ? `border-t ${LINE}` : ""}>
                      <button type="button" data-testid="chiedi-salvati-posto" onClick={() => onOpen(s.place, scelti.map((x) => x.id))} className="flex w-full items-center gap-3 px-3 py-3 text-left active:bg-black/[0.03]">
                        <Miniatura place={s.place} size="h-12 w-12 text-[22px] rounded-[12px]" />
                        <span className="min-w-0 flex-1">
                          <span className={`${SERIF} block truncate text-[18px] font-medium leading-tight text-text`}>{s.place.name}</span>
                          <span className="mt-0.5 block text-[13px] leading-snug text-text-muted">{s.perche}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}

        {/* Con una domanda e niente trovato per nome: solo la risposta (una cosa per schermata). */}
        {!soloRisposta && (<>
        {/* Revisore 1/11 (terzo giro): una sola riga di comandi, scorrevole, prima delle raccolte: Filtri,
            stati (senza "Ci sono stato" quando è 0), "Stasera" e l'ordine come una pillola sola "Recenti ▾".
            Così il primo posto parte entro ~300 px anche con 2 raccolte. */}
        <div data-testid="salvati-comandi" className="-mx-4 mt-4 flex items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          <button type="button" data-testid="salvati-lista-filtri" aria-label={filtersOn > 0 ? `Filtri, ${filtersOn} attivi` : "Filtri"} onClick={onFilters} className="relative flex min-h-11 shrink-0 items-center gap-1.5 rounded-pill border border-[#e3ddd2] bg-white px-3.5 text-[14px] font-medium text-brand active:scale-95">
            <SlidersHorizontal size={15} aria-hidden /> Filtri
            {filtersOn > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 font-display text-[11px] font-bold text-white">{filtersOn}</span>
            )}
          </button>
          {activeCity !== null && (
            <button type="button" onClick={onClearCity} aria-label={`Togli ${activeCity}`} className="flex min-h-11 max-w-[160px] shrink-0 items-center gap-1 rounded-pill bg-brand px-3.5 text-[14px] font-semibold text-white active:scale-95">
              <span className="truncate">{activeCity}</span> <X size={12} aria-hidden className="shrink-0" />
            </button>
          )}
          <div role="group" aria-label="Stato" data-testid="salvati-stato" className="flex shrink-0 gap-2">
            {pills.map((p) => (
              <button
                key={p.label}
                type="button"
                aria-pressed={p.on}
                onClick={() => onTag(p.on && p.tag !== null ? null : p.tag)}
                className={`min-h-11 shrink-0 rounded-pill px-4 text-[14px] font-medium transition-colors active:scale-95 ${p.on ? "bg-brand font-semibold text-white" : "border border-[#e3ddd2] bg-white text-[#33373d]"}`}
              >
                {p.n === null ? p.label : `${p.label} ${p.n}`}
              </button>
            ))}
          </div>
          {/* "Stasera" è uno strumento (non una raccolta): pillola con l'icona a tratto corallo. */}
          <Link href="/stasera" data-testid="lista-stasera" aria-label="Stasera dove andiamo?" className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-pill border border-[#f3c9bd] bg-white px-3.5 text-[14px] font-medium text-[#33373d] active:scale-95">
            <UtensilsCrossed size={15} strokeWidth={2} aria-hidden className="text-accent" /> Stasera
          </Link>
          {/* Ordine in una pillola sola: il menu nativo del telefono sceglie "Vicino" o "Recenti". */}
          <label className="relative flex min-h-11 shrink-0 items-center rounded-pill border border-[#e3ddd2] bg-white text-[14px] font-medium text-[#33373d]">
            <select
              data-testid="salvati-ordine"
              aria-label="Ordina"
              value={sort}
              onChange={(e) => { const k = e.target.value as "vicino" | "recenti"; setOrdine(k); if (k === "vicino" && !origin && !locating) onLocate(); }}
              className="min-h-11 appearance-none rounded-pill bg-transparent pl-3.5 pr-8 focus:outline-none"
            >
              <option value="vicino">{locating && !origin ? "Cerco…" : "Vicino"}</option>
              <option value="recenti">Recenti</option>
            </select>
            <ChevronDown size={15} aria-hidden className="pointer-events-none absolute right-3 text-text-muted" />
          </label>
        </div>

        {/* Le raccolte come copertine basse (Places 07, Albo 12): un tocco filtra la lista. "Nuova" è l'ultima.
            Niente titolo "Raccolte" né riga "N posti": la lista dei posti deve partire presto (revisore, 1/11). */}
        {collections.length === 0 ? (
          <Link
            href="/profilo?raccolta=nuova"
            aria-label="Nuova raccolta"
            data-testid="raccolte-vuote"
            className="mt-4 flex min-h-[64px] items-center gap-3 rounded-card border-[1.5px] border-dashed border-[#d6cec1] px-3 py-2.5 active:scale-[0.98]"
          >
            <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-white text-text-muted"><Plus size={20} /></span>
            <span className="min-w-0 flex-1">
              <span className={`${SERIF} block text-[17px] font-medium leading-tight text-text`}>Nuova raccolta</span>
              <span className="block truncate text-[13px] text-text-muted">Cena a due, con gli amici, weekend…</span>
            </span>
          </Link>
        ) : (
          <ul data-testid="salvati-raccolte" aria-label="Raccolte" className="-mx-4 mt-2.5 flex snap-x scroll-px-4 gap-2.5 overflow-x-auto px-4 py-1 [scrollbar-width:none]">
            {collections.map((c) => {
              const on = activeTag === c.name;
              return (
                <li key={c.name} className="min-w-[120px] max-w-[200px] shrink-0 snap-start">
                  <button
                    type="button"
                    data-testid="raccolta-cerchio"
                    aria-pressed={on}
                    aria-label={`${tagDisplay(c.name)}, ${c.count} ${c.count === 1 ? "posto" : "posti"}`}
                    onClick={() => onTag(on ? null : c.name)}
                    className="block w-full text-left active:scale-[0.97]"
                  >
                    <Copertina name={c.name} count={c.count} preview={c.preview} on={on} />
                  </button>
                </li>
              );
            })}
            <li className="w-[60px] shrink-0 snap-start">
              <Link href="/profilo?raccolta=nuova" aria-label="Nuova raccolta" className="flex h-16 w-full flex-col items-center justify-center gap-0.5 rounded-[16px] border-[1.5px] border-dashed border-[#c9c2b6] text-text-muted active:scale-[0.97]">
                <Plus size={18} aria-hidden />
                <span className="text-[12px] font-medium leading-none text-[#33373d]">Nuova</span>
              </Link>
            </li>
          </ul>
        )}

        {list.length === 0 ? (
          <div data-testid="salvati-lista-vuota" className={`mt-3 rounded-card border ${LINE} bg-white p-6 text-center`}>
            <p className={`${SERIF} text-xl font-medium text-text`}>Nessun posto qui</p>
            <p className="mt-1 text-sm text-text-muted">Cambia la ricerca o i filtri.</p>
            <button
              type="button"
              onClick={() => { onTag(null); onQuery(""); setSearchOpen(false); if (activeCity !== null) onClearCity(); }}
              className="mt-4 min-h-11 rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white active:scale-95"
            >
              Mostra tutti
            </button>
          </div>
        ) : (
          <ul data-testid="salvati-lista-posti" className={`mt-2.5 overflow-hidden rounded-card border ${LINE} bg-white shadow-card`}>
            {list.map((p, i) => {
              const kind = categoryLabel(p.category);
              const city = cityFromAddress(p.address);
              const meta = [kind, city].filter(Boolean).join(" · ");
              const dist = origin ? distanceLabel(origin, p) : null;
              const fonte = reels[p.id];
              const verdict = verdicts[p.id]?.verdict ?? null;
              const done = p.tags?.includes(DONE);
              const want = !done && p.tags?.includes(WANT);
              const liked = p.tags?.includes(OPINION_LIKE);
              const chip = "inline-flex h-[22px] shrink-0 items-center gap-1 whitespace-nowrap rounded-pill px-2 text-[11.5px] font-semibold";
              return (
                <li key={p.id} className={i > 0 ? `border-t ${LINE}` : ""}>
                  <button
                    type="button"
                    data-testid="salvato-riga"
                    onClick={() => onOpen(p, list.map((x) => x.id))}
                    className="flex min-h-[84px] w-full items-start gap-3 px-3 py-3 text-left transition-colors active:bg-black/[0.03]"
                  >
                    <Miniatura place={p} size="mt-0.5 h-[60px] w-[60px] text-[28px] rounded-[14px]" />
                    <span className="min-w-0 flex-1">
                      {/* Il nome ha tutta la riga (giro 1/11, D35): lo stato sta sotto, non a destra. */}
                      <span className={`${SERIF} block truncate text-[19px] font-medium leading-tight tracking-[-0.01em] text-text`}>{p.name}</span>
                      {(meta || dist) && (
                        <span className="mt-0.5 flex min-w-0 items-baseline gap-1 text-[13px] text-text-muted">
                          <span className="min-w-0 truncate">{meta}</span>
                          {dist && <span data-testid="salvato-distanza" className="shrink-0">{meta ? "· " : ""}{dist}</span>}
                        </span>
                      )}
                      {verdict ? (
                        <span data-testid="salvato-verdetto" className={`${SERIF} mt-1 line-clamp-2 text-[15px] italic leading-snug text-[#4a4f55]`}>{verdict}</span>
                      ) : p.note ? (
                        <span data-testid="salvato-nota" className={`${SERIF} mt-1 line-clamp-2 text-[15px] italic leading-snug text-[#4a4f55]`}>“{p.note}”</span>
                      ) : null}
                      {/* Lo stato c'è sempre (revisore 1/11): "Salvato" neutro se non è né da provare né visitato. */}
                      <span className="mt-1 flex flex-wrap gap-1.5">
                          <span data-testid="stato-lista" className={`${chip} ${done ? "bg-[#e3eded] text-brand" : "bg-[#f1efeb] font-medium text-[#6b7075]"}`}>
                            {done ? <Check size={12} strokeWidth={3} aria-hidden /> : <Bookmark size={11} strokeWidth={2.6} aria-hidden />}
                            {done ? "Ci sono stato" : want ? "Da provare" : "Salvato"}
                          </span>
                          {liked && (
                            <span data-testid="salvato-piaciuto" className={`${chip} bg-[#f1ece3] text-[#33373d]`}>👍 Piaciuto</span>
                          )}
                          {fonte && (
                            <span data-testid="salvato-provenienza" className={`${chip} bg-[#f1ece3] font-medium text-[#33373d]`}>
                              <SquarePlay size={12} aria-hidden className="text-accent" /> {FONTE_LABEL[fonte]}
                            </span>
                          )}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        </>)}
      </div>
    </section>
  );
}
