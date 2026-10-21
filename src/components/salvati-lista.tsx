"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Map as MapIcon, Plus, Search, SlidersHorizontal, SquarePlay, X } from "lucide-react";
import type { Place } from "@/app/mappa/map-view";
import { browserClient } from "@/lib/supabase/client-lazy";
import { getCategoryEmoji } from "@/lib/emoji";
import { categoryLabel } from "@/lib/category-label";
import { cityFromAddress } from "@/lib/city";
import { distanceLabel, distanceMeters } from "@/lib/distance";
import { STATE_TAGS } from "@/lib/tags";
import { collectionColor, summarizeCollections } from "@/lib/raccolte";

// Schermata "Salvati" (mockup C "Card bianche" vestito in stile A "Editoriale", scelto da Lorenzo
// nella PR #87): fondo carta, titolo in serif, filtri di stato con i conteggi veri, raccolte come
// cerchi (le storie), lista per vicinanza con lo stato e la provenienza (reel collegato).
// Cosa principale: ritrovare un posto. Il resto (città, tipo, voto, prezzo, ordine) sta nel foglio
// "Filtri" di map-view; la mappa è a un tocco (icona in alto). Nessuna foto: le foto Google non si
// conservano e chiederle per ogni salvato costerebbe quota; si usano emoji e colori.

const [WANT, DONE] = STATE_TAGS;
const SERIF = "font-[family-name:var(--font-newsreader)]";
const PAPER = "bg-[#f8f6f2]";
const LINE = "border-[#e8e2d8]";

// Sfondi caldi delle miniature (al posto della foto): sempre lo stesso per lo stesso tipo di locale.
const TONES = [
  "linear-gradient(160deg,#5a2f1c,#2a150d)",
  "linear-gradient(170deg,#4a1820,#24090f)",
  "linear-gradient(160deg,#6b2b10,#2b1007)",
  "linear-gradient(160deg,#e9dccb,#b89670)",
  "linear-gradient(165deg,#1f4a50,#0b1e21)",
  "linear-gradient(160deg,#7c8f5a,#43532e)",
] as const;
function toneFor(key: string): string {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return TONES[h % TONES.length];
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
  const collections = useMemo(() => summarizeCollections(all, 1), [all]);
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
  // Per vicinanza quando la posizione è nota (mai chiesta da sola: c'è "Vicino a me").
  const list = useMemo(
    () => (origin ? [...shown].sort((a, b) => distanceMeters(origin, a) - distanceMeters(origin, b)) : shown),
    [shown, origin],
  );
  const searching = searchOpen || query !== "";
  const stateOn = activeTag === WANT || activeTag === DONE;
  const pills: { label: string; n: number; on: boolean; tag: string | null }[] = [
    { label: "Tutti", n: all.length, on: !stateOn && !collections.some((c) => c.name === activeTag), tag: null },
    { label: "Da provare", n: count(WANT), on: activeTag === WANT, tag: WANT },
    { label: "Ci sono stato", n: count(DONE), on: activeTag === DONE, tag: DONE },
  ];
  const iconBtn = "flex h-11 w-11 items-center justify-center rounded-full border border-[#ddd5c8] text-text active:scale-95";

  return (
    <section
      data-testid="salvati-lista"
      aria-label="I tuoi posti"
      className={`absolute inset-0 z-30 overflow-y-auto overscroll-contain ${PAPER} pb-[calc(var(--nav-height-mobile)+1.5rem)] lg:left-auto lg:w-[var(--pannello)] lg:border-l lg:border-border ${hideOnDesktop ? "lg:hidden" : ""}`}
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
          <div className="mt-4 flex items-center gap-2 rounded-pill border border-[#ddd5c8] bg-white pl-4 pr-1">
            <Search size={16} className="shrink-0 text-text-muted" aria-hidden />
            <input
              type="search"
              autoFocus={query === ""}
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder="Nome, zona, tipo, nota…"
              aria-label="Cerca nei tuoi posti"
              className="min-h-11 min-w-0 flex-1 bg-transparent text-base text-text placeholder:text-text-muted focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {query !== "" && (
              <button type="button" aria-label="Cancella" onClick={() => onQuery("")} className="flex h-10 w-10 items-center justify-center text-text-muted">
                <X size={16} aria-hidden />
              </button>
            )}
          </div>
        )}

        <div role="group" aria-label="Stato" data-testid="salvati-stato" className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          {pills.map((p) => (
            <button
              key={p.label}
              type="button"
              aria-pressed={p.on}
              onClick={() => onTag(p.on && p.tag !== null ? null : p.tag)}
              className={`min-h-11 shrink-0 rounded-pill px-4 text-[14px] font-medium transition-colors active:scale-95 ${p.on ? "bg-brand font-semibold text-white" : "border border-[#e3ddd2] bg-white text-[#33373d]"}`}
            >
              {p.label} {p.n}
            </button>
          ))}
        </div>

        {/* Le raccolte come le storie: un tocco filtra la lista. Prima "Stasera" (il momento della scelta). */}
        <ul data-testid="salvati-raccolte" aria-label="Raccolte" className="-mx-4 mt-5 flex gap-3 overflow-x-auto px-4 pb-1 pt-1 [scrollbar-width:none]">
          <li className="w-[68px] shrink-0">
            <Link href="/stasera" data-testid="lista-stasera" aria-label="Stasera dove andiamo?" className="flex flex-col items-center gap-1.5 active:scale-95">
              <span aria-hidden className="flex h-16 w-16 items-center justify-center rounded-full bg-[linear-gradient(150deg,#ff8a6e,#ff6b4a_55%,#e2553a)] text-[28px] shadow-[0_0_0_2px_#f8f6f2,0_0_0_3.5px_#ff6b4a]">🍽️</span>
              <span className="w-full truncate text-center text-xs font-semibold text-accent">Stasera</span>
            </Link>
          </li>
          {collections.map((c) => {
            const on = activeTag === c.name;
            const first = c.preview[0];
            return (
              <li key={c.name} className="w-[68px] shrink-0">
                <button
                  type="button"
                  data-testid="raccolta-cerchio"
                  aria-pressed={on}
                  aria-label={`${c.name}, ${c.count} ${c.count === 1 ? "posto" : "posti"}`}
                  onClick={() => onTag(on ? null : c.name)}
                  className="flex w-full flex-col items-center gap-1.5 active:scale-95"
                >
                  <span
                    aria-hidden
                    className={`flex h-16 w-16 items-center justify-center rounded-full text-[28px] ${on ? "shadow-[0_0_0_2px_#f8f6f2,0_0_0_4.5px_#ff6b4a]" : "shadow-[0_0_0_2px_#f8f6f2,0_0_0_3.5px_#e3ddd2]"}`}
                    style={{ background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,.22), transparent 55%), ${collectionColor(c.name)}` }}
                  >
                    {first ? getCategoryEmoji(first.category, first.name) : "📍"}
                  </span>
                  <span className={`w-full truncate text-center text-xs ${on ? "font-semibold text-accent" : "font-medium text-[#33373d]"}`}>{c.name}</span>
                </button>
              </li>
            );
          })}
          <li className="w-[68px] shrink-0">
            <Link href="/profilo?raccolta=nuova" aria-label="Nuova raccolta" className="flex flex-col items-center gap-1.5 active:scale-95">
              <span aria-hidden className="flex h-16 w-16 items-center justify-center rounded-full border-[1.5px] border-dashed border-[#c9c2b6] text-text-muted"><Plus size={22} /></span>
              <span className="w-full truncate text-center text-xs font-medium text-[#33373d]">Nuova</span>
            </Link>
          </li>
        </ul>

        <div className="mt-6 flex items-center justify-between gap-2">
          <h2 className="truncate font-display text-base font-semibold text-text">{origin ? "Vicino a te" : "I tuoi salvati"}</h2>
          <div className="flex shrink-0 items-center gap-1.5">
            {activeCity !== null && (
              <button type="button" onClick={onClearCity} aria-label={`Togli ${activeCity}`} className="flex min-h-9 items-center gap-1 rounded-pill bg-brand px-3 text-xs font-display font-semibold text-white active:scale-95">
                {activeCity} <X size={12} aria-hidden />
              </button>
            )}
            {!origin && (
              <button type="button" onClick={onLocate} disabled={locating} className="min-h-11 rounded-pill px-2 text-[13px] text-text-muted active:scale-95 disabled:opacity-60">
                {locating ? "Cerco…" : "Vicino a me"}
              </button>
            )}
            <button type="button" data-testid="salvati-lista-filtri" onClick={onFilters} className="relative flex min-h-11 items-center gap-1.5 rounded-pill px-2 text-[13px] font-medium text-brand active:scale-95">
              <SlidersHorizontal size={15} aria-hidden /> Filtri
              {filtersOn > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 font-display text-[11px] font-bold text-white">{filtersOn}</span>
              )}
            </button>
          </div>
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
          <ul data-testid="salvati-lista-posti" className={`mt-3 overflow-hidden rounded-card border ${LINE} bg-white shadow-card`}>
            {list.map((p, i) => {
              const kind = categoryLabel(p.category);
              const city = cityFromAddress(p.address);
              // Prima la distanza: a 360 px si taglia la città, non i metri.
              const meta = [origin ? distanceLabel(origin, p) : null, kind, city].filter(Boolean).join(" · ");
              const fonte = reels[p.id];
              const verdict = verdicts[p.id]?.verdict ?? null;
              const done = p.tags?.includes(DONE);
              const want = !done && p.tags?.includes(WANT);
              return (
                <li key={p.id} className={i > 0 ? `border-t ${LINE}` : ""}>
                  <button
                    type="button"
                    data-testid="salvato-riga"
                    onClick={() => onOpen(p, list.map((x) => x.id))}
                    className="flex min-h-[84px] w-full items-center gap-3 px-3 py-3 text-left transition-colors active:bg-black/[0.03]"
                  >
                    <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] text-[26px]" style={{ background: toneFor(kind ?? p.category ?? p.name) }}>
                      {getCategoryEmoji(p.category, p.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`${SERIF} block truncate text-[19px] font-medium leading-tight tracking-[-0.01em] text-text`}>{p.name}</span>
                      {meta && <span className="mt-0.5 block truncate text-[13px] text-text-muted">{meta}</span>}
                      {fonte ? (
                        <span data-testid="salvato-provenienza" className="mt-0.5 flex items-center gap-1 text-xs text-accent">
                          <SquarePlay size={13} aria-hidden /> {FONTE_LABEL[fonte]}
                        </span>
                      ) : verdict ? (
                        <span data-testid="salvato-verdetto" className="mt-0.5 block truncate text-xs text-text-muted"><span aria-hidden className="text-accent">✦ </span>{verdict}</span>
                      ) : null}
                    </span>
                    {(done || want) && (
                      <span data-testid="stato-lista" className={`shrink-0 whitespace-nowrap rounded-pill px-2.5 py-1 text-[11.5px] font-semibold ${done ? "bg-[#e6f5ee] text-[#16784f]" : "bg-[#eef4f4] text-brand"}`}>
                        {done ? "✓ Visitato" : "Da provare"}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
