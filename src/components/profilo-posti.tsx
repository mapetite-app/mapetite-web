"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookmarkCheck, BookmarkPlus, Search, X } from "lucide-react";
import { browserClient } from "@/lib/supabase/client-lazy";
import { getCategoryEmoji } from "@/lib/emoji";
import { categoryLabel } from "@/lib/category-label";
import { cityFromAddress } from "@/lib/city";
import { matchesQuery } from "@/lib/social-view";
import { quartiereDi, tipoPlurale } from "@/lib/scaffali-salvati";
import { MappaPunti } from "@/components/profilo-mappa";

// I posti di una persona sul suo profilo pubblico (8/11), in quest'ordine: "Gli è piaciuto", "Raccolte",
// "Di recente", "I suoi tipi", "In comune", "Da provare". Solo dati della vista salvati_pubblici
// (mai note né "Non fa per me"). Ogni posto apre la sua scheda; chi guarda con l'accesso lo salva
// anche lui con un tocco ("Da provare", come il pulsante della pagina del locale).
// Revisore 14/11: stesso linguaggio dei Salvati (nomi in serif, righe in un unico riquadro, Salva dentro la riga).
export type PostoPersona = {
  place_id: string;
  name: string;
  category: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  tags: string[] | null;
  // Nessuna data: il giorno in cui un posto è stato salvato come "provato" dice quando ci è stato.
  // L'ordine ("Di recente") lo decide il server.
};

export type RaccoltaPersona = { name: string; count: number; href: string };

const ANTEPRIMA = 5; // righe per sezione prima di "Mostra tutti"
const CERCA_DA = 15; // la ricerca compare solo con più di 15 posti
const SERIF = "font-[family-name:var(--font-newsreader)]";
const PAPER = "bg-[#f6f7f7]";
const LINE = "border-[#e3e7e7]";
const CHIP = "inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill bg-white px-3.5 text-[14px] font-sans font-medium text-text shadow-card active:scale-95";
const FILA = "-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]";

type SalvaStato = "salvo" | "errore";

function Titolo({ id, children, extra = null }: { id: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-2">
      <h2 id={id} className="font-title text-xl font-semibold text-brand">{children}</h2>
      {extra}
    </div>
  );
}

// Dove sta: il quartiere (Roma e Milano, entro 1 km dal centro) o, se non c'è, la città dall'indirizzo.
function luogo(p: PostoPersona): string | null {
  const q = p.lat != null && p.lng != null ? quartiereDi({ lat: Number(p.lat), lng: Number(p.lng) }) : null;
  return q ?? cityFromAddress(p.address);
}

const metaDi = (p: PostoPersona) => [categoryLabel(p.category), luogo(p)].filter(Boolean).join(" · ");
const conCoordinate = (rows: PostoPersona[]) =>
  rows.flatMap((p) => (p.lat != null && p.lng != null && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)) ? [{ lat: Number(p.lat), lng: Number(p.lng), visited: !!p.tags?.includes("Già visitato") }] : []));

export default function ProfiloPosti({
  isMe,
  viewer,
  all,
  liked,
  recent,
  want,
  tipi,
  mine: mineInit,
  verdetti,
  posizioni = {},
  raccolte = [],
}: {
  isMe: boolean;
  viewer: string | null;
  all: PostoPersona[];
  liked: PostoPersona[];
  recent: PostoPersona[];
  want: PostoPersona[];
  tipi: { tipo: string; count: number }[];
  mine: string[];
  verdetti: Record<string, string>;
  posizioni?: Record<string, number>; // place_id → posizione nella sua classifica di quella città (1, 2, 3)
  raccolte?: RaccoltaPersona[];
}) {
  const [mine, setMine] = useState(() => new Set(mineInit));
  const [stato, setStato] = useState<Record<string, SalvaStato>>({});
  const [query, setQuery] = useState("");
  const [tipo, setTipo] = useState<string | null>(null);
  const [aperte, setAperte] = useState<Record<string, boolean>>({});
  const canSave = !!viewer && !isMe;
  // "In comune" con i propri salvati di partenza: un posto appena salvato qui non sposta la sezione.
  const comuni = useMemo(() => (canSave ? all.filter((p) => mineInit.includes(p.place_id)) : []), [all, mineInit, canSave]);
  // Copertine delle raccolte: la zona vera dei suoi posti di quella raccolta (come gli scaffali dei Salvati).
  const copertine = useMemo(
    () => Object.fromEntries(raccolte.map((r) => {
      const posti = all.filter((p) => p.tags?.includes(r.name));
      return [r.name, { punti: conCoordinate(posti), emoji: [...new Set(posti.map((p) => getCategoryEmoji(p.category, p.name)))].slice(0, 3) }];
    })),
    [raccolte, all],
  );

  const salva = async (placeId: string) => {
    if (!viewer || mine.has(placeId) || stato[placeId] === "salvo") return;
    setStato((s) => ({ ...s, [placeId]: "salvo" }));
    const client = await browserClient().catch(() => null);
    const error = client
      ? (await client.from("saved_places").insert({ user_id: viewer, place_id: placeId, tags: ["Da provare"], note: null })).error
      : { code: "offline" };
    if (!error || error.code === "23505") {
      setMine((m) => new Set(m).add(placeId));
      setStato((s) => { const next = { ...s }; delete next[placeId]; return next; });
    } else {
      setStato((s) => ({ ...s, [placeId]: "errore" }));
    }
  };

  // Funzioni che restituiscono JSX (non componenti annidati: lo stato resta tra un render e l'altro).
  function salvaBtn(p: PostoPersona, sopra = false) {
    if (!canSave) return null;
    const mio = mine.has(p.place_id);
    const st = stato[p.place_id];
    const base = `flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:scale-95 transition-transform duration-150${sopra ? " shadow-[0_1px_4px_rgba(0,0,0,0.12)]" : ""}`;
    if (mio) {
      return (
        <span data-testid="salvato-anche-tu" role="img" aria-label="È già tra i tuoi salvati" className={`${base} bg-accent-light text-accent`}>
          <BookmarkCheck size={18} strokeWidth={2} aria-hidden />
        </span>
      );
    }
    return (
      <button
        type="button"
        data-testid="salva-anche-tu"
        aria-label={st === "errore" ? `Non salvato: riprova a salvare ${p.name}` : `Salva ${p.name} anche tu`}
        disabled={st === "salvo"}
        onClick={() => void salva(p.place_id)}
        className={`${base} ${sopra ? "bg-white" : "border border-border bg-white"} text-brand ${st === "errore" ? "ring-2 ring-error" : ""} disabled:opacity-60`}
      >
        <BookmarkPlus size={18} strokeWidth={2} aria-hidden />
      </button>
    );
  }

  // Riga come nei Salvati: miniatura, nome in serif, tipo · quartiere, verdetto Mapetite; Salva dentro la riga.
  const riga = (p: PostoPersona, primo: boolean, showState = false) => {
    const meta = metaDi(p);
    const verdict = verdetti[p.place_id];
    const provato = !!p.tags?.includes("Già visitato");
    return (
      <li key={p.place_id} className={`flex items-center gap-1 pr-2 ${primo ? "" : `border-t ${LINE}`}`}>
        <Link
          href={`/locali/${p.place_id}`}
          data-testid="posto-persona"
          className="flex min-h-[76px] min-w-0 flex-1 items-start gap-3 py-3 pl-3 text-left transition-colors active:bg-black/[0.03]"
        >
          <span aria-hidden className={`mt-0.5 flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px] ${PAPER} text-[26px] leading-none`}>
            {getCategoryEmoji(p.category, p.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className={`${SERIF} block truncate text-[19px] font-medium leading-tight tracking-[-0.01em] text-text`}>{p.name}</span>
            {(meta || showState) && (
              <span className="mt-0.5 block truncate text-[13px] text-text-muted">
                {meta}
                {showState && <span data-testid="posto-persona-stato">{meta ? " · " : ""}{provato ? "Provato" : "Da provare"}</span>}
              </span>
            )}
            {verdict && <span data-testid="posto-persona-verdetto" className={`${SERIF} mt-1 line-clamp-2 text-[15px] italic leading-snug text-[#4a4f55]`}>{verdict}</span>}
          </span>
        </Link>
        {salvaBtn(p)}
      </li>
    );
  };

  const elenco = (rows: PostoPersona[], showState = false) => (
    <ul className={`overflow-hidden rounded-card border ${LINE} bg-white shadow-card`}>{rows.map((p, i) => riga(p, i === 0, showState))}</ul>
  );

  function lista(id: string, rows: PostoPersona[]) {
    const open = !!aperte[id];
    const shown = open ? rows : rows.slice(0, ANTEPRIMA);
    return (
      <>
        {elenco(shown)}
        {rows.length > ANTEPRIMA && (
          <button
            type="button"
            data-testid={`mostra-tutti-${id}`}
            onClick={() => setAperte((a) => ({ ...a, [id]: !open }))}
            className="mt-2 flex min-h-11 w-full items-center justify-center rounded-pill border border-border bg-white text-sm font-display font-semibold text-brand active:scale-[0.99]"
          >
            {open ? "Mostra meno" : `Mostra tutti (${rows.length})`}
          </button>
        )}
      </>
    );
  }

  const filtrati = query.trim() || tipo
    ? all.filter((p) => (!tipo || categoryLabel(p.category) === tipo) && matchesQuery([p.name, categoryLabel(p.category), cityFromAddress(p.address)].filter(Boolean).join(" "), query))
    : null;
  const suoi = isMe ? "tuoi" : "suoi";

  return (
    <div data-testid="profilo-posti">
      {all.length > CERCA_DA && (
        <div className="mt-6 px-4">
          <label className="flex min-h-11 items-center gap-2 rounded-pill border border-border bg-white px-4 focus-within:border-brand">
            <Search size={16} aria-hidden className="shrink-0 text-text-muted" />
            <span className="sr-only">Cerca nei {suoi} posti</span>
            <input
              type="search"
              data-testid="cerca-posti-persona"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Cerca nei ${suoi} ${all.length} posti`}
              className="min-w-0 flex-1 bg-transparent text-[15px] font-sans text-text outline-none"
            />
          </label>
        </div>
      )}

      {filtrati ? (
        <section className="mt-5 px-4" aria-labelledby="filtrati-titolo" data-testid="posti-filtrati">
          <Titolo
            id="filtrati-titolo"
            extra={
              <button type="button" data-testid="togli-filtro" onClick={() => { setQuery(""); setTipo(null); }} className="inline-flex min-h-10 items-center gap-1 text-sm font-display font-semibold text-accent">
                <X size={14} aria-hidden /> Tutti
              </button>
            }
          >
            {tipo ? tipoPlurale(tipo) : "Risultati"} · {filtrati.length}
          </Titolo>
          {filtrati.length === 0 ? (
            <p className="rounded-card border border-border bg-surface p-4 text-center text-sm font-sans text-text-muted">Nessun posto così.</p>
          ) : (
            elenco(filtrati, true)
          )}
        </section>
      ) : (
        <>
          {liked.length > 0 && (
            <section className="mt-6" aria-labelledby="piaciuti-titolo" data-testid="profilo-piaciuti">
              <div className="px-4"><Titolo id="piaciuti-titolo">{isMe ? "I tuoi preferiti" : "I suoi preferiti"}</Titolo></div>
              {/* scroll-px-4: con snap-start la prima card resta a 16 px dal bordo, come il resto della pagina. */}
              <ul className="flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
                {liked.map((p) => {
                  const verdict = verdetti[p.place_id];
                  const meta = metaDi(p);
                  // Numero solo se viene dalla sua classifica (posizione nella città di quel posto).
                  const pos = posizioni[p.place_id];
                  const citta = cityFromAddress(p.address);
                  return (
                    <li key={p.place_id} className="relative flex w-[70%] max-w-[260px] shrink-0 snap-start">
                      <Link
                        href={`/locali/${p.place_id}`}
                        data-testid="piaciuto-card"
                        className={`flex w-full flex-col overflow-hidden rounded-card border ${LINE} bg-white shadow-card active:scale-[0.99] transition-transform duration-150`}
                      >
                        <span aria-hidden className={`flex h-[92px] items-center justify-center ${PAPER} text-[46px] leading-none`}>{getCategoryEmoji(p.category, p.name)}</span>
                        <span className="flex flex-1 flex-col p-3">
                          <span className="flex items-start gap-2">
                            <span className={`${SERIF} line-clamp-2 min-w-0 flex-1 text-[19px] font-medium leading-tight tracking-[-0.01em] text-text`}>{p.name}</span>
                            <span
                              data-testid="piaciuto-badge"
                              title={pos ? `N.${pos} nella sua classifica${citta ? ` di ${citta}` : ""}` : "Tra i suoi preferiti"}
                              className="mt-0.5 inline-flex shrink-0 items-center rounded-pill bg-accent-light px-2 py-0.5 text-[12px] font-display font-semibold text-accent"
                            >
                              {pos ? `👍 N.${pos}` : "👍"}
                            </span>
                          </span>
                          {meta && <span className="mt-0.5 block truncate text-[13px] text-text-muted">{meta}</span>}
                          {verdict && <span data-testid="piaciuto-verdetto" className={`${SERIF} mt-1 line-clamp-2 text-[15px] italic leading-snug text-[#4a4f55]`}>{verdict}</span>}
                        </span>
                      </Link>
                      <span className="absolute right-2 top-2">{salvaBtn(p, true)}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {raccolte.length > 0 && (
            <section className="mt-6" aria-labelledby="raccolte-titolo" data-testid="profilo-raccolte-sezione">
              <div className="px-4"><Titolo id="raccolte-titolo">Raccolte</Titolo></div>
              <ul data-testid="profilo-raccolte" className="flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
                {raccolte.map((r) => {
                  const c = copertine[r.name];
                  return (
                    <li key={r.name} className="w-[148px] shrink-0 snap-start">
                      <Link href={r.href} data-testid="raccolta-pubblica-link" className="block active:scale-[0.98] transition-transform duration-150">
                        <span className={`relative block h-[96px] overflow-hidden rounded-[16px] border ${LINE} ${PAPER}`}>
                          <span aria-hidden className="absolute inset-0 flex items-center justify-center gap-1 text-[28px] leading-none">{c?.emoji.map((e) => <span key={e}>{e}</span>)}</span>
                          {c && c.punti.length > 0 && (
                            <>
                              <MappaPunti punti={c.punti} w={148} h={96} margine={26} testId="raccolta-copertina-mappa" />
                              <span aria-hidden className="absolute left-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white text-[15px] leading-none shadow-[0_1px_3px_rgba(0,0,0,0.18)]">{c.emoji[0]}</span>
                            </>
                          )}
                        </span>
                        <span className={`${SERIF} mt-1.5 block truncate text-[17px] font-medium leading-tight text-text`}>{r.name}</span>
                        <span className="block text-[12px] text-text-muted">{r.count === 1 ? "1 posto" : `${r.count} posti`}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {recent.length > 0 && (
            <section className="mt-6 px-4" aria-labelledby="recenti-titolo" data-testid="profilo-recenti">
              <Titolo id="recenti-titolo">Di recente</Titolo>
              {lista("recenti", recent)}
            </section>
          )}

          {tipi.length > 0 && (
            <section className="mt-6 px-4" aria-labelledby="tipi-titolo" data-testid="profilo-tipi">
              <Titolo id="tipi-titolo">I {suoi} tipi</Titolo>
              <div className={FILA}>
                {tipi.map((t) => (
                  <button key={t.tipo} type="button" data-testid="tipo-persona" onClick={() => setTipo(t.tipo)} className={CHIP}>
                    {tipoPlurale(t.tipo)}
                    <span className="font-display font-semibold text-accent">{t.count}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {comuni.length > 0 && (
            <section className="mt-6 px-4" aria-labelledby="comune-titolo" data-testid="profilo-in-comune">
              <Titolo id="comune-titolo">In comune · {comuni.length}</Titolo>
              <div className={FILA}>
                {comuni.map((p) => (
                  <Link key={p.place_id} href={`/locali/${p.place_id}`} data-testid="in-comune-posto" className={`${CHIP} max-w-[240px]`}>
                    <span aria-hidden>{getCategoryEmoji(p.category, p.name)}</span>
                    <span className="truncate">{p.name}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {want.length > 0 && (
            <section className="mt-6 px-4" aria-labelledby="voglio-titolo" data-testid="profilo-da-provare">
              <Titolo id="voglio-titolo">Da provare</Titolo>
              {lista("da-provare", want)}
            </section>
          )}
        </>
      )}
    </div>
  );
}
