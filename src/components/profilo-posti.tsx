"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookmarkCheck, BookmarkPlus, Search, X } from "lucide-react";
import { PostoRiga } from "@/components/posto-persona";
import { browserClient } from "@/lib/supabase/client-lazy";
import { getCategoryEmoji } from "@/lib/emoji";
import { categoryLabel } from "@/lib/category-label";
import { cityFromAddress } from "@/lib/city";
import { matchesQuery } from "@/lib/social-view";

// I posti di una persona sul suo profilo pubblico (8/11), in quest'ordine: "Gli è piaciuto",
// "Di recente", "I suoi tipi", "In comune", "Da provare". Solo dati della vista salvati_pubblici
// (mai note né "Non fa per me"). Ogni posto apre la sua scheda; chi guarda con l'accesso lo salva
// anche lui con un tocco ("Da provare", come il pulsante della pagina del locale).
export type PostoPersona = {
  place_id: string;
  name: string;
  category: string | null;
  address: string | null;
  tags: string[] | null;
  created_at: string;
};

const ANTEPRIMA = 5; // righe per sezione prima di "Mostra tutti"
const CERCA_DA = 15; // la ricerca compare solo con più di 15 posti

type SalvaStato = "salvo" | "errore";

function Titolo({ id, children, extra = null }: { id: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-2">
      <h2 id={id} className="font-title text-xl font-semibold text-brand">{children}</h2>
      {extra}
    </div>
  );
}

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
}) {
  const [mine, setMine] = useState(() => new Set(mineInit));
  const [stato, setStato] = useState<Record<string, SalvaStato>>({});
  const [query, setQuery] = useState("");
  const [tipo, setTipo] = useState<string | null>(null);
  const [aperte, setAperte] = useState<Record<string, boolean>>({});
  const canSave = !!viewer && !isMe;
  // "In comune" con i propri salvati di partenza: un posto appena salvato qui non sposta la sezione.
  const comuni = useMemo(() => (canSave ? all.filter((p) => mineInit.includes(p.place_id)) : []), [all, mineInit, canSave]);

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
  function salvaBtn(p: PostoPersona, scuro = false) {
    if (!canSave) return null;
    const mio = mine.has(p.place_id);
    const st = stato[p.place_id];
    const base = "flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:scale-95 transition-transform duration-150";
    if (mio) {
      return (
        <span data-testid="salvato-anche-tu" role="img" aria-label="È già tra i tuoi salvati" className={`${base} ${scuro ? "bg-white/15 text-white" : "bg-accent-light text-accent"}`}>
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
        className={`${base} ${scuro ? "bg-white text-brand" : "border border-border bg-white text-brand"} ${st === "errore" ? "ring-2 ring-error" : ""} disabled:opacity-60`}
      >
        <BookmarkPlus size={18} strokeWidth={2} aria-hidden />
      </button>
    );
  }

  const riga = (p: PostoPersona, showState = true) => (
    <li key={p.place_id} className="flex items-center gap-2">
      <div className="min-w-0 flex-1"><PostoRiga spot={p} verdict={verdetti[p.place_id] ?? null} showState={showState} /></div>
      {salvaBtn(p)}
    </li>
  );

  function lista(id: string, rows: PostoPersona[]) {
    const open = !!aperte[id];
    const shown = open ? rows : rows.slice(0, ANTEPRIMA);
    return (
      <>
        <ul className="space-y-2">{shown.map((p) => riga(p, false))}</ul>
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
            {tipo ?? "Risultati"} · {filtrati.length}
          </Titolo>
          {filtrati.length === 0 ? (
            <p className="rounded-card border border-border bg-surface p-4 text-center text-sm font-sans text-text-muted">Nessun posto così.</p>
          ) : (
            <ul className="space-y-2">{filtrati.map((p) => riga(p))}</ul>
          )}
        </section>
      ) : (
        <>
          {liked.length > 0 && (
            <section className="mt-6" aria-labelledby="piaciuti-titolo" data-testid="profilo-piaciuti">
              <div className="px-4"><Titolo id="piaciuti-titolo">{isMe ? "Ti è piaciuto" : "Gli è piaciuto"}</Titolo></div>
              <ul className="flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
                {liked.map((p, i) => {
                  const kind = categoryLabel(p.category);
                  const city = cityFromAddress(p.address);
                  const verdict = verdetti[p.place_id];
                  return (
                    <li key={p.place_id} className="relative w-[70%] max-w-[260px] shrink-0 snap-start">
                      <Link
                        href={`/locali/${p.place_id}`}
                        data-testid="piaciuto-card"
                        className="relative flex min-h-40 flex-col justify-between overflow-hidden rounded-card bg-brand p-4 pr-14 text-white shadow-card active:scale-[0.99] transition-transform duration-150"
                      >
                        <span aria-hidden className="pointer-events-none absolute -right-3 -bottom-4 text-[80px] leading-none opacity-25">{getCategoryEmoji(p.category, p.name)}</span>
                        <span className="relative min-w-0">
                          <span className="line-clamp-2 font-title text-lg font-semibold leading-tight">{p.name}</span>
                          {kind && <span className="mt-1 block truncate text-[11px] font-display font-semibold uppercase tracking-wider text-white/70">{kind}</span>}
                          {verdict && <span className="mt-1.5 line-clamp-2 text-[13px] font-sans leading-snug text-white/90">{verdict}</span>}
                        </span>
                        <span className="relative flex items-center gap-2 text-xs font-sans text-white/80">
                          <span className="rounded-pill bg-accent px-2 py-0.5 text-[11px] font-display font-semibold text-white">{i < 3 ? `👍 N.${i + 1}` : "👍"}</span>
                          {city && <span className="truncate">{city}</span>}
                        </span>
                      </Link>
                      <span className="absolute right-2 top-2">{salvaBtn(p, true)}</span>
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
              <div className="flex flex-wrap gap-2">
                {tipi.map((t) => (
                  <button
                    key={t.tipo}
                    type="button"
                    data-testid="tipo-persona"
                    onClick={() => setTipo(t.tipo)}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-pill bg-white px-3.5 text-[14px] font-sans font-medium text-text shadow-card active:scale-95"
                  >
                    {t.tipo}
                    <span className="font-display font-semibold text-accent">{t.count}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {comuni.length > 0 && (
            <section className="mt-6 px-4" aria-labelledby="comune-titolo" data-testid="profilo-in-comune">
              <Titolo id="comune-titolo">In comune · {comuni.length}</Titolo>
              <div className="flex flex-wrap gap-1.5">
                {comuni.map((p) => (
                  <Link key={p.place_id} href={`/locali/${p.place_id}`} data-testid="in-comune-posto" className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-pill bg-accent-light px-3 text-[13px] font-display font-medium text-accent active:scale-95">
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
