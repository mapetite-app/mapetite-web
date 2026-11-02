"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Map as MapIcon, Moon, Plus, Search, SlidersHorizontal, Sparkles, SquarePlay, X } from "lucide-react";
import type { Place } from "@/app/mappa/map-view";
import { browserClient } from "@/lib/supabase/client-lazy";
import { getCategoryEmoji } from "@/lib/emoji";
import { cardFacts } from "@/components/bottom-sheet";
import { cityFromAddress } from "@/lib/city";
import { distanceLabel, distanceMeters } from "@/lib/distance";
import { hasStateOrTag, OPINION_LIKE, STATE_TAGS, tagDisplay } from "@/lib/tags";
import { iconeRaccolte, summarizeCollections } from "@/lib/raccolte";
import { MAX_POSTI, sembraDomanda } from "@/lib/chiedi-salvati";
import { trackFeature } from "@/lib/track";
import { fotoUrl } from "@/lib/foto-utenti";

// Schermata "Salvati" (mockup C "Card bianche" vestito in stile A "Editoriale", scelto da Lorenzo
// nella PR #87; rifatta dopo il giro del 1/11 come Places/Albo): fondo carta, titolo in serif, filtri
// di stato con i conteggi veri, Filtri e ordine (Vicino / Recenti) su una sola riga scorrevole ("Stasera" in alto, accanto al "+"),
// raccolte come copertine basse (mosaico e nome dentro) sotto, righe con lo stato sempre, 👍,
// verdetto e provenienza sotto il nome, così il nome ha tutta la riga.
// Cosa principale: ritrovare un posto. Il resto (città, tipo, voto, prezzo) sta nel foglio "Filtri"
// di map-view; la mappa è a un tocco (icona in alto). Nessuna foto Google: non si conservano e chiederle
// per ogni salvato costerebbe quota (decisione di Lorenzo in sospeso); emoji su un fondo unico, oppure
// la foto scattata dall'utente quando c'è (foto_locali, già nostra).

const [WANT, DONE] = STATE_TAGS;
const SERIF = "font-[family-name:var(--font-newsreader)]";
const PAPER = "bg-[#f8f6f2]";
const LINE = "border-[#e8e2d8]";

// Miniatura al posto della foto: emoji del tipo su un fondo carta unico (giro 1/11, D42: niente
// colori a caso tra un posto e l'altro). Anche le raccolte hanno un fondo solo (revisore 2/11).
// Con una foto scattata dall'utente (foto_locali, già sui nostri server) si usa quella; se non si carica torna l'emoji.
function Miniatura({ place, size, foto }: { place: Place; size: string; foto?: string | null }) {
  const [rotta, setRotta] = useState(false);
  return (
    <span aria-hidden className={`relative flex shrink-0 items-center justify-center overflow-hidden border border-[#e6dfd3] bg-[linear-gradient(160deg,#f6f1e8,#ebe3d6)] ${size}`}>
      {getCategoryEmoji(place.category, place.name)}
      {foto && !rotta && (
        // eslint-disable-next-line @next/next/no-img-element -- foto privata servita da /api/foto-utenti (controllo di chi la vede)
        <img src={foto} alt="" data-testid="salvato-foto-mia" loading="lazy" onError={() => setRotta(true)} className="absolute inset-0 h-full w-full object-cover" />
      )}
    </span>
  );
}

// Copertina di una raccolta (revisore 2/11): una pillola nella stessa fila dei filtri (due file di chip prima
// del primo posto erano troppe), con l'icona dell'occasione dedotta dal nome (iconeRaccolte), non l'emoji del
// primo posto (due raccolte su quattro avevano gli spaghetti). Bianca come le altre pillole; teal se accesa.
function Copertina({ name, count, icona, on }: { name: string; count: number; icona: string; on: boolean }) {
  return (
    <span
      data-testid="raccolta-copertina"
      className={`flex min-h-11 w-full items-center gap-2 rounded-pill border py-1 pl-1 pr-3.5 ${on ? "border-brand bg-brand" : "border-[#e3ddd2] bg-white"}`}
    >
      <span aria-hidden className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[18px] leading-none ${on ? "bg-white/[0.14]" : "bg-[#f3efe8]"}`}>{icona}</span>
      <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
        <span className={`min-w-0 truncate text-[14px] ${on ? "font-semibold text-white" : "font-medium text-[#33373d]"}`}>{tagDisplay(name)}</span>
        <span className={`shrink-0 text-[12px] font-semibold ${on ? "text-white/75" : "text-text-muted"}`}>{count}</span>
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

  // "Sulla mappa" sparisce mentre si scorre verso il basso e torna quando ci si ferma o si risale, come le
  // barre di Places (revisore 2/11, terzo giro: copriva la nota e l'etichetta dell'ultima riga in vista).
  const [mappaNascosta, setMappaNascosta] = useState(false);
  const scorri = useRef<{ y: number; timer: ReturnType<typeof setTimeout> | null }>({ y: 0, timer: null });
  useEffect(() => {
    const s = scorri.current;
    return () => { if (s.timer) clearTimeout(s.timer); };
  }, []);
  const onScroll = (e: React.UIEvent<HTMLElement>) => {
    const y = e.currentTarget.scrollTop;
    const s = scorri.current;
    const d = y - s.y;
    s.y = y;
    if (d > 2 && y > 24) setMappaNascosta(true);
    else if (d < -2) setMappaNascosta(false);
    if (s.timer) clearTimeout(s.timer);
    s.timer = setTimeout(() => setMappaNascosta(false), 450);
  };

  // Foto dell'utente (foto_locali, già nostre: nessuna foto Google e nessuna quota): la prima di ogni salvato
  // prende il posto dell'emoji. Senza foto, senza tabella o senza rete resta l'emoji.
  const [fotoMie, setFotoMie] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    browserClient()
      .then((supabase) => supabase.from("foto_locali").select("id, place_id").eq("user_id", userId).order("created_at", { ascending: true }).limit(600))
      .then(({ data, error }) => {
        if (!alive || error || !Array.isArray(data)) return;
        const byPlace: Record<string, string> = {};
        for (const row of data as { id: string; place_id: string }[]) {
          if (row?.id && row.place_id && !byPlace[row.place_id]) byPlace[row.place_id] = fotoUrl(row.id);
        }
        setFotoMie(byPlace);
      })
      .catch(() => { /* rete assente: restano le emoji */ });
    return () => { alive = false; };
  }, [userId]);

  const count = (tag: string) => all.filter((p) => hasStateOrTag(p.tags, tag)).length;
  // Copertine: i posti più recenti di ogni raccolta (la lista arriva dal più vecchio al più nuovo).
  const collections = useMemo(() => summarizeCollections([...all].reverse(), 4), [all]);
  const icone = useMemo(() => iconeRaccolte(collections.map((c) => c.name)), [collections]);
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
  const iconBtn = "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#ddd5c8] text-text active:scale-95";

  return (
    <section
      data-testid="salvati-lista"
      aria-label="I tuoi posti"
      onScroll={onScroll}
      className={`absolute inset-0 z-30 flex flex-col overflow-y-auto overscroll-contain ${PAPER} pb-[var(--nav-height-mobile)] lg:left-auto lg:w-[var(--pannello)] lg:border-l lg:border-border ${hideOnDesktop ? "lg:hidden" : ""}`}
    >
      <div className="mx-auto w-full max-w-md flex-1 px-4 pt-[max(1.5rem,env(safe-area-inset-top))]">
        {/* Revisore 2/11: testata leggera. Sopra, il conteggio e l'ordine ("Recenti ▾") sulla stessa riga;
            accanto al titolo solo "Stasera" (con la sua etichetta) e un solo "+"; la mappa è il pulsante
            in basso, la ricerca la lente nella fila dei filtri. */}
        <div className="flex h-5 items-center justify-between gap-3">
          <p data-testid="salvati-lista-sopra" className="min-w-0 truncate font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">{kicker}</p>
          {/* Ordine nel menu nativo del telefono: "Vicino" o "Recenti". Area toccabile alta 44 px senza alzare la riga. */}
          <label className="relative -my-3 -mr-1 flex min-h-11 shrink-0 items-center text-[13px] font-medium text-[#4a4f55]">
            <select
              data-testid="salvati-ordine"
              aria-label="Ordina"
              value={sort}
              onChange={(e) => { const k = e.target.value as "vicino" | "recenti"; setOrdine(k); if (k === "vicino" && !origin && !locating) onLocate(); }}
              className="min-h-11 appearance-none bg-transparent pl-2 pr-5 text-right focus:outline-none"
            >
              <option value="vicino">{locating && !origin ? "Cerco…" : "Vicino"}</option>
              <option value="recenti">Recenti</option>
            </select>
            <ChevronDown size={14} aria-hidden className="pointer-events-none absolute right-1 text-text-muted" />
          </label>
        </div>
        <header className="mt-1.5 flex items-center justify-between gap-3">
          <h1 className={`${SERIF} min-w-0 text-[34px] font-medium leading-none tracking-tight text-text`}>I tuoi posti</h1>
          <div className="flex shrink-0 gap-1.5">
            {/* "Stasera" è uno strumento, non un filtro (revisore 2/11). Revisore 2/11 (quarto giro): forchetta e
                coltello barrati si leggevano "niente cibo / chiuso": luna corallo e la parola scritta accanto. */}
            <Link href="/stasera" data-testid="lista-stasera" aria-label="Stasera dove andiamo?" title="Stasera dove andiamo?" className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-pill border border-[#f3c9bd] bg-white pl-3 pr-3.5 text-[14px] font-medium text-text active:scale-95">
              <Moon size={16} strokeWidth={2} aria-hidden className="text-accent" />
              Stasera
            </Link>
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
                        <Miniatura place={s.place} foto={fotoMie[s.place.id]} size="h-12 w-12 text-[22px] rounded-[12px]" />
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
        {/* Revisore 2/11: una sola fila, scorrevole: lente, Filtri, stati (senza "Ci sono stato" quando è 0)
            e poi le raccolte con "Nuova" in fondo. Il primo posto parte subito sotto (~160 px). */}
        <div data-testid="salvati-comandi" className="-mx-4 mt-3 flex items-center gap-2 overflow-x-auto px-4 py-0.5 [scrollbar-width:none]">
          <button type="button" aria-label="Cerca" aria-pressed={searching} onClick={() => { if (searching) { onQuery(""); setSearchOpen(false); } else setSearchOpen(true); }} className={`${iconBtn} ${searching ? "border-brand bg-brand text-white" : "bg-white"}`}>
            {searching ? <X size={17} aria-hidden /> : <Search size={17} aria-hidden />}
          </button>
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
          {/* Le raccolte nella stessa fila (Places 07, Albo 12): un tocco filtra la lista. "Nuova" è l'ultima;
              senza raccolte resta solo lei, con l'invito scritto. */}
          <ul data-testid="salvati-raccolte" aria-label="Raccolte" className="flex shrink-0 gap-2">
            {collections.map((c, i) => {
              const on = activeTag === c.name;
              return (
                <li key={c.name} className="max-w-[200px] shrink-0">
                  <button
                    type="button"
                    data-testid="raccolta-cerchio"
                    aria-pressed={on}
                    aria-label={`${tagDisplay(c.name)}, ${c.count} ${c.count === 1 ? "posto" : "posti"}`}
                    onClick={() => onTag(on ? null : c.name)}
                    className="block w-full text-left active:scale-[0.97]"
                  >
                    <Copertina name={c.name} count={c.count} icona={icone[i]} on={on} />
                  </button>
                </li>
              );
            })}
            <li className="shrink-0">
              <Link
                href="/profilo?raccolta=nuova"
                aria-label="Nuova raccolta"
                data-testid={collections.length === 0 ? "raccolte-vuote" : undefined}
                className="flex min-h-11 items-center gap-1 rounded-pill border-[1.5px] border-dashed border-[#c9c2b6] px-3.5 text-[14px] font-medium text-[#33373d] active:scale-[0.97]"
              >
                <Plus size={15} aria-hidden className="text-text-muted" />
                {collections.length === 0 ? "Nuova raccolta" : "Nuova"}
              </Link>
            </li>
          </ul>
        </div>

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
              // Stessa riga di fatti della card sulla mappa (revisore 2/11: "Ristorante" qui, "Osteria" là):
              // tipo dal nome quando lo dice (categoryLabel con il nome, come scheda e card) · ★ voto · prezzo · città.
              const meta = cardFacts(p, null, true);
              const dist = origin ? distanceLabel(origin, p) : null;
              const fonte = reels[p.id];
              const verdict = verdicts[p.id]?.verdict ?? null;
              const done = p.tags?.includes(DONE);
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
                    <Miniatura place={p} foto={fotoMie[p.id]} size="mt-0.5 h-[60px] w-[60px] text-[28px] rounded-[14px]" />
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
                      {/* Lo stato c'è sempre, e sono solo due (revisore 2/11): senza stato è "Da provare".
                          📌 è l'icona di "Da provare" in tutta l'app; il segnalibro resta per Salva/Salvato. */}
                      <span className="mt-1 flex flex-wrap gap-1.5">
                          <span data-testid="stato-lista" className={`${chip} ${done ? "bg-[#e3eded] text-brand" : "bg-[#f1efeb] font-medium text-[#6b7075]"}`}>
                            {done ? <Check size={12} strokeWidth={3} aria-hidden /> : <span aria-hidden className="text-[10px] leading-none">📌</span>}
                            {done ? "Ci sono stato" : "Da provare"}
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
      {/* La mappa dei salvati: pulsante che resta in basso mentre si scorre (come "Map" in Places), così in
          alto restano solo "Stasera" e "+" (revisore 2/11). Revisore 2/11, sesto giro: copriva verdetto e stato
          dell'ultima riga. Sotto la lista resta uno spazio pari al pulsante + 16 px (pt-4), così in fondo l'ultima
          riga sta tutta sopra; a riposo una sfumatura carta dietro il pulsante, niente testo che ci passa sotto. */}
      <div className={`pointer-events-none sticky bottom-0 z-10 mt-auto flex shrink-0 justify-center pb-3 pt-4 lg:pb-6 ${mappaNascosta ? "" : "bg-gradient-to-t from-[#f8f6f2] from-55% to-transparent"}`}>
        <button
          type="button"
          data-testid="salvati-lista-mappa"
          data-nascosto={mappaNascosta ? "true" : undefined}
          aria-label="Vedi sulla mappa"
          aria-hidden={mappaNascosta || undefined}
          tabIndex={mappaNascosta ? -1 : undefined}
          onClick={onMap}
          className={`flex min-h-11 items-center gap-1.5 rounded-pill bg-brand px-4 text-[14px] font-semibold text-white shadow-float transition-[transform,opacity] duration-200 active:scale-95 motion-reduce:transition-none ${mappaNascosta ? "translate-y-[calc(100%+1rem)] opacity-0" : "pointer-events-auto"}`}
        >
          <MapIcon size={16} aria-hidden /> Sulla mappa
        </button>
      </div>
    </section>
  );
}
