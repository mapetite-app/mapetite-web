"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { loadRecentSearches, subscribeRecent, useBeta } from "@/lib/beta";
import { CITTA_CLASSIFICHE, classifiche, proposte, type Momento } from "@/lib/home-proposte";
import { grantedPosition, readLastView } from "@/lib/last-view";
import { cityNear } from "@/lib/named-city";
import type { MappaGusto } from "@/lib/mappa-gusto";
import { trackFeature } from "@/lib/track";

// Pillole sotto il campo e rotaia "Per te" della home (mockup A del 21/10, scelto da Lorenzo).
// Le ricerche recenti stanno solo su questo telefono: le legge il browser, il server passa gusto e ora.
const SERIF = "font-[family-name:var(--font-newsreader)]";

function useRecenti(): string[] {
  const on = useBeta("recenti");
  const raw = useSyncExternalStore(subscribeRecent, () => JSON.stringify(loadRecentSearches()), () => "[]");
  return on ? (JSON.parse(raw) as string[]) : [];
}

// Città della home: quella del profilo; senza, dove sei (posizione già permessa) o dove hai lasciato
// la mappa, tra Roma e Milano (VISIONE.md). Chi è a Milano non vede "a Roma".
export function useCitta(dalProfilo: string | null): string {
  const [vicina, setVicina] = useState<string | null>(null);
  useEffect(() => {
    if (dalProfilo) return;
    let alive = true;
    const last = readLastView();
    const daVista = last ? cityNear(last.lat, last.lng) : null;
    if (daVista === "Milano" || daVista === "Roma") setTimeout(() => { if (alive) setVicina(daVista); }, 0);
    void grantedPosition().then((pos) => {
      const c = pos ? cityNear(pos.lat, pos.lng) : null;
      if (alive && (c === "Milano" || c === "Roma")) setVicina(c);
    });
    return () => { alive = false; };
  }, [dalProfilo]);
  return dalProfilo ?? vicina ?? "Roma";
}

// Esempi per l'ora quando non c'è ancora nessuna ricerca recente.
const PILLOLE: Record<Momento, string[]> = {
  colazione: ["Colazione con cornetti veri", "Caffè di specialità", "Brunch nel weekend"],
  pranzo: ["Pranzo veloce e buono", "Trattoria per pranzo", "Pranzo di lavoro tranquillo"],
  pomeriggio: ["Cena romantica", "Aperitivo con vista", "Vino naturale"],
  aperitivo: ["Aperitivo con vista", "Vino naturale", "Cocktail d'autore"],
  cena: ["Cena romantica", "Trattoria non turistica", "Pizza napoletana"],
  dopocena: ["Cocktail d'autore", "Wine bar fino a tardi", "Gelato artigianale"],
};

export function HomePillole({ momento, cittaProfilo }: { momento: Momento; cittaProfilo: string | null }) {
  const citta = useCitta(cittaProfilo);
  const recenti = useRecenti().slice(0, 3);
  const pill = "flex min-h-11 max-w-64 shrink-0 items-center gap-1.5 rounded-pill border border-border bg-white px-4 text-sm font-sans text-text active:scale-95";
  return (
    // Prima le ultime ricerche fatte su questo telefono (↻), poi tre idee giuste per l'ora nella tua città.
    <div data-testid="home-suggerimenti" className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      {recenti.length > 0 && (
        <span data-testid="home-recenti" className="contents">
          {recenti.map((q) => (
            <Link key={q} href={`/mappa?q=${encodeURIComponent(q)}`} aria-label={q} className={pill}>
              <span aria-hidden className="text-text-muted">↻</span>
              <span className="truncate">{q}</span>
            </Link>
          ))}
        </span>
      )}
      {PILLOLE[momento].map((label) => {
        const q = `${label} a ${citta}`;
        return (
          <Link key={q} href={`/mappa?q=${encodeURIComponent(q)}`} aria-label={q} data-esempio className={pill}>
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </div>
  );
}

// Classifiche della città (lato telefono: la città può venire dalla posizione). Ogni riga è una ricerca.
// L'ora arriva dal server, come il momento: con l'orologio del telefono, a cavallo del cambio di
// settimana la rotazione cambiava tra server e telefono (errore di idratazione visto il 23/10).
export function HomeClassifiche({ momento, cittaProfilo, adesso }: { momento: Momento; cittaProfilo: string | null; adesso: number }) {
  const citta = useCitta(cittaProfilo);
  const dove = CITTA_CLASSIFICHE.includes(citta) ? citta : "Roma";
  const [now] = useState(() => new Date(adesso));
  const top = classifiche(dove, momento, now);
  return (
    <section data-testid="home-classifiche" className="mt-8">
      <h2 className={`${SERIF} text-[28px] font-medium leading-none text-text`}>Le classifiche di {dove}</h2>
      <p className="mt-1.5 text-xs font-sans text-text-muted">Ordinate dalle recensioni e dal verdetto Mapetite, non dalla fama.</p>
      <ol className="mt-3 divide-y divide-border overflow-hidden rounded-card border border-border bg-white">
        {top.map((c, i) => (
          <li key={c.id}>
            <Link
              href={`/mappa?q=${encodeURIComponent(c.q)}`}
              onClick={() => trackFeature("home_classifica", { nome: c.id })}
              data-testid="home-classifica"
              className="flex min-h-[4.5rem] items-center gap-3 px-3.5 py-3 active:bg-surface"
            >
              <span aria-hidden className={`${SERIF} w-6 shrink-0 text-center text-[28px] font-medium leading-none text-accent`}>{i + 1}</span>
              <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface text-2xl">{c.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-display font-semibold leading-tight text-text">{c.titolo}</span>
                <span className="mt-0.5 line-clamp-2 block text-xs font-sans leading-snug text-text-muted">{c.sotto}</span>
              </span>
              <span aria-hidden className="text-lg text-text-muted">›</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function HomePerTe({
  gusto,
  cittaProfilo,
  momento,
  loggedIn,
}: {
  gusto: MappaGusto | null;
  cittaProfilo: string | null;
  momento: Momento;
  loggedIn: boolean;
}) {
  const citta = useCitta(cittaProfilo);
  const recenti = useRecenti();
  const lista = proposte({ gusto, recenti, citta, momento });
  const senzaGusto = !gusto || gusto.su.length === 0;
  return (
    <section data-testid="home-per-te" className="mt-7">
      <h2 className={`${SERIF} text-[28px] font-medium leading-none text-text`}>Per te</h2>
      <div className="-mx-4 mt-3 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
        {lista.map((p, i) => (
          <Link
            key={p.q}
            href={`/mappa?q=${encodeURIComponent(p.q)}`}
            onClick={() => trackFeature("home_proposta", { stato: String(i + 1) })}
            data-testid="home-proposta"
            className="block w-[68vw] max-w-[17rem] shrink-0 snap-start active:scale-[0.99]"
          >
            <span
              aria-hidden
              className="relative flex h-40 items-center justify-center overflow-hidden rounded-[20px] text-6xl shadow-card"
              style={{ background: `linear-gradient(160deg, ${p.sfondo})` }}
            >
              <span className="absolute -left-6 -top-6 h-24 w-24 rounded-full bg-white/15 blur-xl" />
              <span className="drop-shadow-md">{p.emoji}</span>
            </span>
            <span className={`${SERIF} mt-2.5 line-clamp-2 block text-[21px] font-medium leading-tight text-text`}>{p.titolo}</span>
            <span className="mt-1 flex items-start gap-1 text-[13px] font-sans font-medium leading-snug text-accent">
              <span aria-hidden>✦</span>
              <span className="line-clamp-2">{p.perche}</span>
            </span>
          </Link>
        ))}
        {/* Sorprendimi (piano 2.5): un posto mai provato che probabilmente ti piace, con il perché. */}
        <Link href="/sorprendimi?da=home" data-testid="home-sorprendimi" className="block w-[68vw] max-w-[17rem] shrink-0 snap-start active:scale-[0.99]">
          <span aria-hidden className="flex h-40 items-center justify-center rounded-[20px] bg-brand text-6xl shadow-card">🎲</span>
          <span className={`${SERIF} mt-2.5 block text-[21px] font-medium leading-tight text-text`}>Sorprendimi</span>
          <span className="mt-1 flex items-start gap-1 text-[13px] font-sans font-medium leading-snug text-accent">
            <span aria-hidden>✦</span>
            <span>Un posto mai provato, scelto per te</span>
          </span>
        </Link>
      </div>
      {/* Chiave di volta 0 dello sprint: anche chi non è entrato vede l'invito (passa dalla registrazione). */}
      {senzaGusto && (
        <Link href={loggedIn ? "/onboarding" : "/signup?next=%2Fonboarding"} data-testid="home-invito-gusto" className="mt-3 flex min-h-14 items-center gap-3 rounded-card border border-accent/30 bg-accent-light px-4 py-3 active:scale-[0.99]">
          <span aria-hidden className="text-2xl">✨</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-display font-semibold text-brand">Fai la tua mappa del gusto</span>
            <span className="block text-xs font-sans text-text-muted">1 minuto, poi proposte su misura</span>
          </span>
          <span aria-hidden className="text-brand">›</span>
        </Link>
      )}
    </section>
  );
}
