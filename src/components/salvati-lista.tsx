"use client";

import { Fragment, memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Map as MapIcon, Moon, Plus, Search, Sparkles, SquarePlay, X } from "lucide-react";
import type { Place } from "@/app/mappa/map-view";
import { browserClient } from "@/lib/supabase/client-lazy";
import { getCategoryEmoji } from "@/lib/emoji";
import { cardFacts } from "@/components/bottom-sheet";
import { cityFromAddress } from "@/lib/city";
import { categoryLabel } from "@/lib/category-label";
import { cercaSalvati, testoSalvato } from "@/lib/cerca-salvati";
import { zoneDeiSalvati } from "@/lib/salvati-zone";
import { distanceLabel, distanceMeters } from "@/lib/distance";
import { hasStateOrTag, isStateTag, OPINION_DISLIKE, OPINION_LIKE, STATE_TAGS, tagDisplay, tagLabel } from "@/lib/tags";
import { iconeRaccolte, summarizeCollections } from "@/lib/raccolte";
import { MAX_POSTI, sembraDomanda } from "@/lib/chiedi-salvati";
import { trackFeature } from "@/lib/track";
import { fotoUrl } from "@/lib/foto-utenti";
import { quartiereDi, raggioVicino, tipoPlurale } from "@/lib/scaffali-salvati";
import { mappaStatica } from "@/lib/mappa-statica";

// Schermata "Salvati" (mockup C "Card bianche" vestito in stile A "Editoriale", scelto da Lorenzo
// nella PR #87; rifatta dopo il giro del 1/11 come Places/Albo): fondo carta, titolo in serif, filtri
// di stato con i conteggi veri, Filtri e ordine (Vicino / Recenti) su una sola riga scorrevole ("Stasera" in alto, accanto al "+"),
// raccolte come copertine basse (mosaico e nome dentro) sotto, righe con lo stato sempre, 👍,
// verdetto e provenienza sotto il nome, così il nome ha tutta la riga.
// Cosa principale: ritrovare un posto. Lorenzo 5/11 ("immagina che io abbia 500 salvati"): la città in alto
// filtra davvero la lista (stessa scelta della mappa), la ricerca filtra mentre scrivi (nome, tipo con i sinonimi,
// quartiere, nota, raccolta) e sotto c'è una fila di filtri rapidi (raccolte, stato, tipo di locale): il foglio
// "Filtri" qui non serve più (faceva le stesse cose). La mappa è a un tocco (pulsante in basso). Nessuna foto Google: non si conservano e chiederle
// per ogni salvato costerebbe quota (decisione di Lorenzo in sospeso); emoji su un fondo unico, oppure
// la foto scattata dall'utente quando c'è (foto_locali, già nostra).

const [WANT, DONE] = STATE_TAGS;
// Righe disegnate alla volta: con 500 salvati se ne disegnano 60 e le altre arrivano scorrendo.
const PASSO = 60;
// Tipi di locale nella fila dei filtri rapidi: i più frequenti, non tutti (con 500 salvati sarebbero decine).
const MAX_TIPI = 12;
// Scaffali (revisore 8/11): solo da 8 salvati in su; con meno la fila dei filtri di sempre basta.
const MIN_SCAFFALI = 8;
type Ordine = "vicino" | "recenti" | "preferiti" | "attesa";
const SERIF = "font-[family-name:var(--font-newsreader)]";
const PAPER = "bg-[#f6f7f7]";
const LINE = "border-[#e3e7e7]";

// Miniatura al posto della foto: emoji del tipo su un fondo carta unico (giro 1/11, D42: niente
// colori a caso tra un posto e l'altro). Anche le raccolte hanno un fondo solo (revisore 2/11).
// Con una foto scattata dall'utente (foto_locali, già sui nostri server) si usa quella; se non si carica torna l'emoji.
function Miniatura({ place, size, foto }: { place: Place; size: string; foto?: string | null }) {
  const [rotta, setRotta] = useState(false);
  return (
    <span aria-hidden className={`relative flex shrink-0 items-center justify-center overflow-hidden border border-[#e2e6e6] bg-[linear-gradient(160deg,#f4f6f6,#e5e9e9)] ${size}`}>
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
      className={`flex min-h-11 w-full items-center gap-1.5 rounded-pill border px-3 ${on ? "border-brand bg-brand" : "border-[#e1e5e5] bg-white"}`}
    >
      {/* Revisore 3/11 (quinto): emoji in linea, senza cerchio, così a 390 px entrano almeno due raccolte. */}
      <span aria-hidden className="shrink-0 text-[16px] leading-none">{icona}</span>
      <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
        <span className={`min-w-0 truncate text-[14px] ${on ? "font-semibold text-white" : "font-medium text-[#33373d]"}`}>{tagDisplay(name)}</span>
        <span className={`shrink-0 text-[12px] font-semibold ${on ? "text-white/75" : "text-text-muted"}`}>{count}</span>
      </span>
    </span>
  );
}

// Scaffali (Lorenzo 8/11, libreria di Places e Albo): una copertina per quartiere, tipo o raccolta, con il
// conteggio. Copertina = la foto scattata dall'utente se c'è (foto_locali, già nostra; mai foto Google), altrimenti
// le emoji dei posti su un fondo tenue (una sola emoji se il gruppo è di un tipo solo).
type Gruppo = { key: string; label: string; n: number; posti: Place[]; icona?: string };
const FONDI = { zona: "bg-[#e9f0ef]", tipo: "bg-[#f4efe8]", raccolta: "bg-[#f1eef1]" } as const;

function FotoCopertina({ src, children }: { src: string; children: React.ReactNode }) {
  const [rotta, setRotta] = useState(false);
  if (rotta) return <>{children}</>;
  // eslint-disable-next-line @next/next/no-img-element -- foto privata servita da /api/foto-utenti (controllo di chi la vede)
  return <img src={src} alt="" data-testid="scaffale-foto" loading="lazy" onError={() => setRotta(true)} className="absolute inset-0 h-full w-full object-cover" />;
}

// Copertina con la mappa (14/11, revisori dell'8/11: "copertine senza foto"): la zona vera dei posti del gruppo,
// con un puntino per posto e l'emoji del gruppo in un tondo bianco. Se la mappa non arriva (rete, token) torna la
// copertina di prima: la foto scattata dall'utente o le emoji.
const COPERTINA_W = 112;
const COPERTINA_H = 64;
function MappaCopertina({ posti, badge, fallback }: { posti: Place[]; badge: string | null; fallback: React.ReactNode }) {
  const [rotta, setRotta] = useState(false);
  const [pronta, setPronta] = useState(false);
  const mappa = useMemo(() => mappaStatica(posti, COPERTINA_W, COPERTINA_H, process.env.NEXT_PUBLIC_MAPBOX_TOKEN), [posti]);
  if (!mappa || rotta) return <>{fallback}</>;
  return (
    <>
      {!pronta && fallback}
      {/* eslint-disable-next-line @next/next/no-img-element -- immagine statica Mapbox, già alla dimensione giusta */}
      <img src={mappa.url} alt="" data-testid="scaffale-mappa" loading="lazy" onLoad={() => setPronta(true)} onError={() => setRotta(true)} className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${pronta ? "opacity-100" : "opacity-0"}`} />
      {pronta && mappa.punti.map((pt, i) => (
        <span key={i} data-testid="scaffale-puntino" className="absolute h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-white bg-accent shadow-[0_0_0_0.5px_rgba(0,0,0,0.15)]" style={{ left: `${pt.x}%`, top: `${pt.y}%` }} />
      ))}
      {pronta && badge && (
        <span className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[13px] leading-none shadow-[0_1px_3px_rgba(0,0,0,0.18)]">{badge}</span>
      )}
    </>
  );
}

function CopertinaScaffale({ g, fondo, foto, onTap, testId = "scaffale-copertina", cover }: { g: Gruppo; fondo: string; foto: Record<string, string>; onTap: () => void; testId?: string; cover?: string }) {
  // I posti arrivano dal più vecchio al più nuovo: la copertina mostra i più recenti.
  const recenti = g.posti.slice(-12).reverse();
  const conFoto = recenti.find((p) => foto[p.id]);
  const emoji = g.icona ? [g.icona] : [...new Set(recenti.map((p) => getCategoryEmoji(p.category, p.name)))].slice(0, 4);
  const emojiVista = emoji.length === 1 ? (
    <span className="flex h-full w-full items-center justify-center text-[23px] leading-none">{emoji[0]}</span>
  ) : (
    <span className="grid h-full w-full grid-cols-4 place-items-center px-1 text-[17px] leading-none">{emoji.map((e) => <span key={e}>{e}</span>)}</span>
  );
  const vecchia = conFoto ? <FotoCopertina src={foto[conFoto.id]}>{emojiVista}</FotoCopertina> : emojiVista;
  return (
    <li className="shrink-0">
      <button
        type="button"
        data-testid={testId}
        data-scaffale-key={g.key}
        aria-label={`${g.label}, ${g.n} ${g.n === 1 ? "posto" : "posti"}`}
        onClick={onTap}
        className="block w-[112px] text-left active:scale-[0.97]"
      >
        <span data-testid={cover} className="block">
          <span aria-hidden className={`relative block h-[64px] w-full overflow-hidden rounded-[12px] border border-[#e2e6e6] ${fondo}`}>
            {/* Tondo con l'emoji solo se il gruppo ne ha una sola (tipo, raccolta, "Vicino a te"): su una zona mista sarebbe a caso. */}
            <MappaCopertina posti={recenti} badge={emoji.length === 1 ? emoji[0] : null} fallback={vecchia} />
          </span>
          <span className="mt-1 flex items-baseline gap-1 px-0.5">
            <span data-testid="scaffale-nome" className="min-w-0 truncate text-[13px] font-medium text-[#33373d]">{g.label}</span>
            <span className="shrink-0 text-[12px] font-semibold text-text-muted">{g.n}</span>
          </span>
        </span>
      </button>
    </li>
  );
}

// Gruppi di una lista per chiave (quartiere, tipo), dal più pieno; i posti restano nell'ordine ricevuto.
function raggruppa(lista: readonly Place[], chiave: (p: Place) => string | null): Gruppo[] {
  const m = new globalThis.Map<string, Place[]>();
  for (const p of lista) {
    const k = chiave(p);
    if (!k) continue;
    const g = m.get(k);
    if (g) g.push(p);
    else m.set(k, [p]);
  }
  return [...m.entries()].map(([key, posti]) => ({ key, label: key, n: posti.length, posti }))
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, "it"));
}

// Tipo di locale (lo stesso della riga) e testo cercato; testi = testo di ogni salvato, calcolato una volta.
function filtraLista(lista: Place[], tipo: string | null, q: string, testi: ReadonlyMap<string, string>): Place[] {
  const delTipo = tipo === null ? lista : lista.filter((p) => categoryLabel(p.category, p.name) === tipo);
  return cercaSalvati(delTipo, q, (p) => testi.get(p.id) ?? "", (p) => p.tags);
}

const FONTE_LABEL: Record<string, string> = { Instagram: "Reel Instagram", TikTok: "Video TikTok", YouTube: "Video YouTube" };

// Una riga della lista. A parte (memo): mentre si scrive nel campo le righe già in vista non si ridisegnano,
// si ridisegna solo la lista filtrata quando è pronta (useDeferredValue). Con 500 salvati scrivere non scatta.
type RigaProps = { p: Place; primo: boolean; foto?: string; fonte?: string; verdict: string | null; origin: { lat: number; lng: number } | null; daMese: string | null; onTap: (p: Place) => void };
const Riga = memo(function Riga({ p, primo, foto, fonte, verdict, origin, daMese, onTap }: RigaProps) {
  // Stessa riga di fatti della card sulla mappa (revisore 2/11: "Ristorante" qui, "Osteria" là):
  // tipo dal nome quando lo dice (categoryLabel con il nome, come scheda e card) · ★ voto · prezzo · città.
  const meta = cardFacts(p, null, true);
  // Revisore 3/11: oltre 50 km la distanza non serve ("474,6 km"); resta la città, intera.
  const dist = origin && distanceMeters(origin, p) < 50_000 ? distanceLabel(origin, p) : null;
  const done = p.tags?.includes(DONE);
  const liked = p.tags?.includes(OPINION_LIKE);
  const haChiuso = p.businessStatus === "CLOSED_PERMANENTLY";
  const chiusoPerOra = p.businessStatus === "CLOSED_TEMPORARILY";
  const chip = "inline-flex h-[22px] shrink-0 items-center gap-1 whitespace-nowrap rounded-pill px-2 text-[11.5px] font-semibold";
  return (
    <li className={primo ? "" : `border-t ${LINE}`}>
      <button
        type="button"
        data-testid="salvato-riga"
        onClick={() => onTap(p)}
        className="flex min-h-[84px] w-full items-start gap-3 px-3 py-3 text-left transition-colors active:bg-black/[0.03]"
      >
        <Miniatura place={p} foto={foto} size={`mt-0.5 h-[60px] w-[60px] text-[28px] rounded-[14px]${haChiuso ? " opacity-45 grayscale" : ""}`} />
        <span className={`min-w-0 flex-1 ${haChiuso ? "opacity-70" : ""}`}>
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
              {/* Proposta 45: lo dice Google, non noi; il posto resta finché non lo togli tu. */}
              {(haChiuso || chiusoPerOra) && (
                <span data-testid="salvato-chiuso" className={`${chip} bg-[#33373d] text-white`}>{haChiuso ? "Ha chiuso" : "Chiuso per ora"}</span>
              )}
              <span data-testid="stato-lista" className={`${chip} ${done ? "bg-[#e3eded] text-brand" : "bg-[#f0f2f2] font-medium text-[#6b7075]"}`}>
                {done ? <Check size={12} strokeWidth={3} aria-hidden /> : <span aria-hidden className="text-[10px] leading-none">📌</span>}
                {done ? "Ci sono stato" : "Da provare"}
                {daMese && <span data-testid="salvato-da-mesi" className="font-medium">da {daMese}</span>}
              </span>
              {liked && (
                <span data-testid="salvato-piaciuto" className={`${chip} bg-[#eef1f1] text-[#33373d]`}>{tagLabel(OPINION_LIKE)}</span>
              )}
              {/* Revisore 3/11: con "Preferiti" il 👎 va in fondo; il chip dice perché. */}
              {!liked && p.tags?.includes(OPINION_DISLIKE) && (
                <span data-testid="salvato-non-piaciuto" className={`${chip} bg-[#f0f2f2] text-[#6b7075]`}>{tagLabel(OPINION_DISLIKE)}</span>
              )}
              {fonte && (
                <span data-testid="salvato-provenienza" className={`${chip} bg-[#eef1f1] font-medium text-[#33373d]`}>
                  <SquarePlay size={12} aria-hidden className="text-accent" /> {FONTE_LABEL[fonte]}
                </span>
              )}
          </span>
        </span>
      </button>
    </li>
  );
});

export default function SalvatiLista({
  userId,
  all,
  activeTag,
  onTag,
  zona,
  onZona,
  query,
  onQuery,
  origin,
  locating,
  onLocate,
  verdicts,
  onOpen,
  onMap,
  hideOnDesktop = false,
}: {
  userId: string;
  all: Place[]; // tutti i salvati
  activeTag: string | null;
  onTag: (tag: string | null) => void;
  // Città scelta (nome della zona dei salvati, come le pillole della mappa); null = tutte. Lo stato è di map-view,
  // così la scelta resta passando dalla lista alla mappa e ritorno.
  zona: string | null;
  onZona: (zona: string | null) => void;
  query: string;
  onQuery: (value: string) => void;
  origin: { lat: number; lng: number } | null;
  locating: boolean;
  onLocate: () => void;
  verdicts: Record<string, { verdict?: string | null }>;
  onOpen: (place: Place, order: string[]) => void;
  onMap: (order: string[]) => void;
  hideOnDesktop?: boolean;
}) {
  // Ordine visibile (giro 1/11): "Vicino" se la posizione è nota, altrimenti "Recenti". Si cambia con un tocco.
  const [ordine, setOrdine] = useState<Ordine | null>(null);
  // Testo cercato: il campo risponde subito (stato locale) e la lista si filtra un attimo dopo (useDeferredValue),
  // così con 500 salvati scrivere non scatta. map-view (la mappa dei salvati) lo riceve a una pausa nella scrittura:
  // ridisegnare la mappa con tutti i segnalini a ogni lettera faceva scattare il campo.
  const [testo, setTesto] = useState(query);
  const [inviato, setInviato] = useState(query);
  const [visto, setVisto] = useState(query);
  // Testo cambiato da fuori (es. azzerato dalla mappa): il campo lo segue. Schema "stato che segue una prop".
  if (query !== visto) {
    setVisto(query);
    if (query !== inviato) { setTesto(query); setInviato(query); }
  }
  const pausa = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrivi = (v: string, subito = false) => {
    setTesto(v); setInviato(v);
    if (pausa.current) clearTimeout(pausa.current);
    pausa.current = null;
    if (subito || v === "") onQuery(v);
    else pausa.current = setTimeout(() => { pausa.current = null; onQuery(v); }, 450);
  };
  // Se si esce (scheda, mappa) prima della pausa, la mappa riceve comunque il testo scritto.
  const ultimo = useRef({ onQuery, testo });
  useEffect(() => { ultimo.current = { onQuery, testo }; });
  useEffect(() => () => { if (pausa.current) { clearTimeout(pausa.current); ultimo.current.onQuery(ultimo.current.testo); } }, []);
  const cercato = useDeferredValue(testo);
  // Tipo di locale scelto nella fila dei filtri rapidi ("Trattoria"), solo per la lista.
  const [tipo, setTipo] = useState<string | null>(null);
  // Scaffali (Lorenzo 8/11): quartiere scelto ("Trastevere") o "Vicino a te", solo per la lista, combinabili con
  // tipo e stato ("Pizzerie · Trastevere · Da provare").
  const [quartiere, setQuartiere] = useState<string | null>(null);
  const [vicino, setVicino] = useState(false);
  const [scheda, setScheda] = useState<"zone" | "tipi" | "raccolte">("zone");
  // La fila delle città scorre? (misurata, così la sfumatura c'è solo quando serve)
  const cittaRef = useRef<HTMLDivElement | null>(null);
  const [cittaScorre, setCittaScorre] = useState(false);
  useEffect(() => {
    const el = cittaRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const misura = () => setCittaScorre(el.scrollWidth > el.clientWidth + 1 + (el.dataset.scorre ? 28 : 0));
    const ro = new ResizeObserver(misura);
    ro.observe(el);
    misura();
    return () => ro.disconnect();
  }, [all.length]);
  // "Chiedi ai tuoi posti" (PROPOSTE.md 33): una domanda a parole, l'AI sceglie solo tra i salvati.
  // Parte solo al tocco (o Invio): una chiamata Haiku per domanda, nessuna ricerca Google.
  // Proposta 44 (4/11): con una raccolta accesa ("Romantico") si chiede solo a quella raccolta.
  type Risposta = { q: string; raccolta: string | null; stato: "cerco" | "ok" | "errore"; scelti: { id: string; perche: string }[]; msg?: string };
  const [risposta, setRisposta] = useState<Risposta | null>(null);
  const raccolta = activeTag !== null && !isStateTag(activeTag) ? activeTag : null;
  // Revisore 8/11: stato e raccolta si combinano ("Con amici" + "Da provare" = l'intersezione). La mappa regge un
  // filtro solo (activeTag): con una raccolta accesa riceve la raccolta e lo stato si applica qui, nella lista.
  const [statoLista, setStatoLista] = useState<string | null>(null);
  const statoOn = raccolta !== null ? statoLista : activeTag;
  const scegliStato = (st: string | null) => { if (raccolta !== null) setStatoLista(st); else { setStatoLista(null); onTag(st); } };
  const scegliRaccolta = (r: string | null) => { const st = statoOn; setStatoLista(r === null ? null : st); onTag(r ?? st); };
  const chiedi = async () => {
    const q = testo.trim();
    if (!sembraDomanda(q) || (risposta?.q === q && risposta.raccolta === raccolta && risposta.stato !== "errore")) return;
    setRisposta({ q, raccolta, stato: "cerco", scelti: [] });
    try {
      const r = await fetch("/api/salvati/chiedi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(raccolta ? { domanda: q, raccolta } : { domanda: q }) });
      const j = await r.json().catch(() => ({}));
      const scelti = r.ok && Array.isArray(j.scelti) ? (j.scelti as { id: string; perche: string }[]) : [];
      setRisposta((cur) => (cur?.q !== q || cur.raccolta !== raccolta ? cur : r.ok ? { q, raccolta, stato: "ok", scelti } : { q, raccolta, stato: "errore", scelti: [], msg: typeof j.error === "string" ? j.error : "Non sono riuscito a rispondere: riprova." }));
      trackFeature("chiedi_salvati", { stato: r.ok ? (scelti.length ? "trovati" : "nessuno") : "errore", n: scelti.length, ...(raccolta ? { raccolta: "si" } : {}) });
    } catch {
      setRisposta((cur) => (cur?.q !== q || cur.raccolta !== raccolta ? cur : { q, raccolta, stato: "errore", scelti: [], msg: "Sei offline: riprova tra poco." }));
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

  // Città (Lorenzo 5/11): le zone dei salvati, le stesse pillole della mappa ("Roma 12 · Milano 2"). Scelta una
  // città, lista, conteggi e filtri rapidi sono solo di quella.
  const zone = useMemo(() => zoneDeiSalvati(all), [all]);
  const zonaOn = zone.length > 1 ? zone.find((z) => z.nome === zona) ?? null : null;
  const base = useMemo(() => {
    if (!zonaOn) return all;
    const ids = new Set(zonaOn.posti.map((p) => p.id));
    return all.filter((p) => ids.has(p.id));
  }, [all, zonaOn]);
  // Testo di ogni salvato calcolato una volta (non a ogni lettera).
  const testi = useMemo(() => new globalThis.Map(all.map((p) => [p.id, testoSalvato(p)])), [all]);
  const perStato = useMemo(() => base.filter((p) => (raccolta === null || !!p.tags?.includes(raccolta)) && (statoOn === null || hasStateOrTag(p.tags, statoOn))), [base, raccolta, statoOn]);
  // Quartiere e tipo di ogni salvato, calcolati una volta (non a ogni lettera né a ogni filtro).
  const quartieri = useMemo(() => new globalThis.Map(all.map((p) => [p.id, quartiereDi(p)])), [all]);
  const tipoDi = useMemo(() => new globalThis.Map(all.map((p) => [p.id, categoryLabel(p.category, p.name)])), [all]);
  // "Vicino a te": il raggio più stretto con almeno 3 salvati (1, 2 o 5 km), solo se la posizione è già nota.
  const raggio = useMemo(() => (origin ? raggioVicino(origin, base) : null), [origin, base]);
  const vicinoOn = vicino && origin !== null && raggio !== null;
  const perZona = useMemo(() => {
    if (quartiere !== null) return perStato.filter((p) => quartieri.get(p.id) === quartiere);
    if (vicinoOn && origin && raggio) return perStato.filter((p) => distanceMeters(origin, p) <= raggio);
    return perStato;
  }, [perStato, quartiere, quartieri, vicinoOn, origin, raggio]);
  const perZonaIds = useMemo(() => new Set(perZona.map((p) => p.id)), [perZona]);
  // Con un tipo acceso, gli scaffali per zona contano solo quel tipo (e viceversa).
  const perTipo = useMemo(() => (tipo === null ? perStato : perStato.filter((p) => tipoDi.get(p.id) === tipo)), [perStato, tipo, tipoDi]);
  // Zona e tipo accesi, senza lo stato: per i conteggi delle pillole "Da provare" e "Visti".
  const senzaStato = useMemo(() => {
    const qui = vicinoOn && origin && raggio ? { origin, raggio } : null;
    return base.filter((p) =>
      (raccolta === null || !!p.tags?.includes(raccolta))
      && (quartiere === null || quartieri.get(p.id) === quartiere)
      && (qui === null || distanceMeters(qui.origin, p) <= qui.raggio)
      && (tipo === null || tipoDi.get(p.id) === tipo));
  }, [base, raccolta, quartiere, quartieri, vicinoOn, origin, raggio, tipo, tipoDi]);
  // Conteggi degli stati: contano i posti di raccolta, zona e tipo accesi ("Da provare 2" tra le pizzerie di Trastevere).
  const count = (tag: string) => senzaStato.filter((p) => hasStateOrTag(p.tags, tag)).length;
  // Tipi di locale presenti (con stato o raccolta accesi, quelli che restano), i più frequenti prima, con l'emoji
  // e il conteggio. Lo stesso tipo che si legge sulla riga (categoryLabel con il nome).
  const tipi = useMemo(() => {
    const m = new globalThis.Map<string, { label: string; emoji: string; n: number }>();
    for (const p of perZona) {
      const label = categoryLabel(p.category, p.name);
      if (!label) continue;
      const t = m.get(label);
      if (t) t.n++;
      else m.set(label, { label, emoji: getCategoryEmoji(p.category, p.name), n: 1 });
    }
    return [...m.values()].sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, "it"));
  }, [perZona]);
  // Un tipo solo non filtra niente: la fila dei tipi compare con almeno due tipi (o con quello acceso, anche a 0).
  const primiTipi = tipi.slice(0, MAX_TIPI);
  const tipiInVista = tipi.length < 2 && tipo === null ? [] : tipo !== null && !primiTipi.some((t) => t.label === tipo)
    ? [...primiTipi, tipi.find((t) => t.label === tipo) ?? { label: tipo, emoji: "🍽️", n: 0 }]
    : primiTipi;
  const shown = useMemo(() => filtraLista(perZona, tipo, cercato, testi), [perZona, tipo, cercato, testi]);
  // Scaffali: quartieri (con il tipo acceso, solo i suoi posti), tipi (con la zona accesa, solo quelli lì).
  // Solo copertine con almeno 2 posti (revisore 8/11: niente "Monti 1").
  const scaffaleZone = useMemo(() => raggruppa(perTipo, (p) => quartieri.get(p.id) ?? null).filter((g) => g.n >= 2).slice(0, 20), [perTipo, quartieri]);
  const scaffaleVicino = useMemo(() => (origin && raggio ? perTipo.filter((p) => distanceMeters(origin, p) <= raggio) : []), [perTipo, origin, raggio]);
  const scaffaleTipi = useMemo(() => raggruppa(perZona, (p) => tipoDi.get(p.id) ?? null).filter((g) => g.n >= 2).slice(0, 20).map((g) => ({ ...g, label: tipoPlurale(g.key) })), [perZona, tipoDi]);
  // Copertine: i posti più recenti di ogni raccolta (la lista arriva dal più vecchio al più nuovo).
  // Con una città scelta, le raccolte di quella città (la raccolta accesa resta, anche se lì è vuota).
  // Revisore 8/11: le copertine contano solo i posti rimasti con stato, zona e tipo accesi (i numeri dicono il vero),
  // così la raccolta si aggiunge in qualunque ordine.
  const perAltri = useMemo(() => (raccolta === null ? perTipo.filter((p) => perZonaIds.has(p.id)) : senzaStato.filter((p) => statoOn === null || hasStateOrTag(p.tags, statoOn))), [raccolta, perTipo, perZonaIds, senzaStato, statoOn]);
  const collections = useMemo(() => {
    const cs = summarizeCollections([...perAltri].reverse(), 4);
    return activeTag !== null && !isStateTag(activeTag) && !cs.some((c) => c.name === activeTag) ? [...cs, { name: activeTag, count: 0, preview: [] }] : cs;
  }, [perAltri, activeTag]);
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
  // "Preferiti" (revisore 3/11, area 3d): prima i 👍, poi gli altri "Ci sono stato", poi i da provare
  // dal più recente; i 👎 in fondo. Solo segnali dati dalla persona, nessuna fama.
  const sort = ordine ?? (origin ? "vicino" : "recenti");
  // "Da mesi" (PROPOSTE.md 40, PROBLEMI.md 18): i "Da provare" salvati da oltre 60 giorni dicono "da luglio"
  // sulla riga; l'ordine "Da più tempo" li porta in cima. Solo la data di salvataggio, costo zero.
  const [adesso] = useState(() => Date.now());
  const daMesi = useMemo(() => new Set(base.filter((p) => !p.tags?.includes(DONE) && p.businessStatus !== "CLOSED_PERMANENTLY" && p.savedAt && adesso - Date.parse(p.savedAt) > 60 * 86_400_000).map((p) => p.id)), [base, adesso]);
  const daQuando = (p: Place) => {
    if (!daMesi.has(p.id) || !p.savedAt) return null;
    const d = new Date(p.savedAt);
    const mese = d.toLocaleDateString("it-IT", { month: "long" });
    return new Date(adesso).getFullYear() === d.getFullYear() ? mese : `${mese} ${d.getFullYear()}`;
  };
  const ordinata = useMemo(() => {
    // Proposta 45: chi ha chiuso per sempre (secondo Google) va in fondo con qualsiasi ordine. Mai tolto.
    const chiuso = (p: Place) => (p.businessStatus === "CLOSED_PERMANENTLY" ? 1 : 0);
    // Revisore 3/11 (sesto): anche con "Vicino" i 👎 vanno in fondo (mai primo un posto che non fa per te).
    if (sort === "vicino" && origin) {
      const giu = (p: Place) => (p.tags?.includes(OPINION_DISLIKE) ? 1 : 0);
      return [...shown].sort((a, b) => chiuso(a) - chiuso(b) || giu(a) - giu(b) || distanceMeters(origin, a) - distanceMeters(origin, b));
    }
    // "Da più tempo" (revisore 5/11, al posto della riga "Aspettano da mesi"): prima i Da provare dal più
    // vecchio, poi i già visitati; come gli ordinamenti di Places, Mapstr e Google Maps. Solo la data di salvataggio.
    if (sort === "attesa") {
      const fatto = (p: Place) => (p.tags?.includes(DONE) ? 1 : 0);
      return [...shown].sort((a, b) => chiuso(a) - chiuso(b) || fatto(a) - fatto(b));
    }
    if (sort === "preferiti") {
      const peso = (p: Place) => (p.tags?.includes(OPINION_DISLIKE) ? 3 : p.tags?.includes(OPINION_LIKE) ? 0 : p.tags?.includes(DONE) ? 1 : 2);
      return [...shown].reverse().sort((a, b) => chiuso(a) - chiuso(b) || peso(a) - peso(b));
    }
    const ordinati = sort === "recenti" ? [...shown].reverse() : [...shown];
    return ordinati.sort((a, b) => chiuso(a) - chiuso(b));
  }, [shown, origin, sort]);
  // Sezioni (Lorenzo 8/11): con un tipo acceso la lista si divide per quartiere ("Trastevere", "Monti"…), con una
  // zona accesa per tipo. Solo se aiuta: almeno 6 posti e 2 sezioni vere; i gruppi seguono l'ordine scelto (il
  // primo posto della lista apre la prima sezione), "Altre zone" / "Altro" in fondo. Mai mentre si cerca.
  const zonaAccesa = quartiere !== null || vicinoOn;
  const modoSezioni: "zona" | "tipo" | null = all.length < MIN_SCAFFALI || cercato.trim() !== "" ? null : tipo !== null && !zonaAccesa ? "zona" : zonaAccesa && tipo === null ? "tipo" : null;
  const { list, sezioneDi } = useMemo(() => {
    if (modoSezioni === null || ordinata.length < 6) return { list: ordinata, sezioneDi: null };
    const resto = modoSezioni === "zona" ? "Altre zone" : "Altro";
    const chiave = (p: Place) => (modoSezioni === "zona" ? quartieri.get(p.id) : tipoDi.get(p.id) && tipoPlurale(tipoDi.get(p.id)!)) || resto;
    const gruppi = new globalThis.Map<string, Place[]>();
    for (const p of ordinata) {
      const k = chiave(p);
      const g = gruppi.get(k);
      if (g) g.push(p);
      else gruppi.set(k, [p]);
    }
    const veri = [...gruppi.keys()].filter((k) => k !== resto);
    if (veri.length < 2 && !(veri.length === 1 && gruppi.has(resto))) return { list: ordinata, sezioneDi: null };
    const ordine = [...veri, ...(gruppi.has(resto) ? [resto] : [])];
    const sez = new globalThis.Map<string, { titolo: string; n: number }>();
    const flat: Place[] = [];
    for (const k of ordine) for (const p of gruppi.get(k)!) { flat.push(p); sez.set(p.id, { titolo: k, n: gruppi.get(k)!.length }); }
    return { list: flat, sezioneDi: sez };
  }, [ordinata, modoSezioni, quartieri, tipoDi]);
  // Un tocco su una riga apre la scheda con l'ordine della lista. Funzione stabile (le righe sono memo).
  const apri = useRef({ onOpen, ids: [] as string[] });
  useEffect(() => { apri.current = { onOpen, ids: list.map((x) => x.id) }; });
  const apriRiga = useCallback((p: Place) => apri.current.onOpen(p, apri.current.ids), []);
  // Righe disegnate: le prime PASSO, poi altre scorrendo (onScroll). Si riparte da capo a ogni filtro nuovo.
  const [quanti, setQuanti] = useState(PASSO);
  const chiaveFiltri = `${zonaOn?.nome ?? ""}|${activeTag ?? ""}|${statoOn ?? ""}|${tipo ?? ""}|${quartiere ?? ""}|${vicinoOn}|${cercato}|${sort}`;
  const [chiaveVista, setChiaveVista] = useState(chiaveFiltri);
  if (chiaveFiltri !== chiaveVista) { setChiaveVista(chiaveFiltri); setQuanti(PASSO); }
  const onScroll = (e: React.UIEvent<HTMLElement>) => {
    const y = e.currentTarget.scrollTop;
    const s = scorri.current;
    const d = y - s.y;
    s.y = y;
    if (d > 2 && y > 24) setMappaNascosta(true);
    else if (d < -2) setMappaNascosta(false);
    if (s.timer) clearTimeout(s.timer);
    s.timer = setTimeout(() => setMappaNascosta(false), 450);
    // Vicino al fondo arrivano le righe successive (con 500 salvati non si disegnano tutte subito).
    const el = e.currentTarget;
    if (quanti < list.length && el.scrollHeight - y - el.clientHeight < 1600) setQuanti((n) => n + PASSO);
  };  const searching = testo !== "";
  const domanda = searching && sembraDomanda(testo);
  // La risposta vale solo per la domanda scritta adesso.
  const attuale = domanda && risposta?.q === testo.trim() && risposta.raccolta === raccolta ? risposta : null;
  const nRaccolta = raccolta ? all.filter((p) => p.tags?.includes(raccolta)).length : 0;
  // Con un filtro acceso pillole e raccolte restano: chi cerca deve vedere che il filtro c'è.
  // Revisore 4/11 sera (terzo): solo quando la risposta c'è; prima (o dopo aver spento la raccolta) restano le
  // raccolte, così si può scegliere a chi chiedere senza cancellare la domanda.
  const soloRisposta = domanda && list.length === 0 && raccolta === null && statoOn === null && tipo === null && quartiere === null && !vicino && attuale !== null;
  // Revisore 4/11: con una domanda e nessun posto per nome conta solo la risposta dell'AI (anche con una raccolta
  // accesa): niente "Nessun posto qui" sotto la risposta né "0 di 14 posti" in testa.
  const rispostaAI = domanda && list.length === 0;
  const scelti = (attuale?.scelti ?? []).map((s) => ({ ...s, place: all.find((p) => p.id === s.id) })).filter((s): s is typeof s & { place: Place } => !!s.place);
  // Revisore 3/11: niente "Tutti" (è lo stato quando nessun filtro è acceso; un secondo tocco spegne):
  // così le raccolte entrano nello schermo già alla prima occhiata.
  // Revisore 3/11 (quinto): pillole compatte ("📌 8", "✓ 6", le stesse icone dello stato sulle righe);
  // l'etichetta intera resta per lo screen reader e come suggerimento.
  const pills: { label: string; short: string; n: number | null; on: boolean; tag: string | null }[] = [
    { label: "Da provare", short: "Da provare", n: count(WANT), on: statoOn === WANT, tag: WANT },
    // Revisore 8/11: la stessa parola della riga ("Ci sono stato"), non "Visti".
    { label: "Ci sono stato", short: "Ci sono stato", n: count(DONE), on: statoOn === DONE, tag: DONE },
    // Revisore 1/11: "Ci sono stato 0" è un filtro morto; torna appena c'è un posto (o se è acceso).
  ].filter((p) => (p.n ?? 0) > 0 || p.on); // Revisore 8/11: niente "Da provare 0" né "Ci sono stato 0" (filtri morti).
  // Filtri accesi oltre alla città: sotto la fila compaiono "23 di 500" e "Azzera".
  const filtrando = searching || raccolta !== null || statoOn !== null || tipo !== null || zonaAccesa;
  const azzera = () => { onTag(null); setStatoLista(null); scrivi(""); setTipo(null); setQuartiere(null); setVicino(false); };
  // Nessun posto in questa città ma qualcuno nelle altre: si propone di cercare dappertutto.
  const altrove = list.length === 0 && zonaOn && filtrando
    ? filtraLista(all.filter((p) => (raccolta === null || !!p.tags?.includes(raccolta)) && (statoOn === null || hasStateOrTag(p.tags, statoOn))), tipo, cercato, testi).length
    : 0;
  const citta = zone.length > 1 ? [{ nome: null as string | null, label: "Tutte", n: all.length }, ...zone.map((z) => ({ nome: z.nome as string | null, label: z.nome, n: z.posti.length }))] : [];
  const iconBtn = "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d6dcdc] text-text active:scale-95";
  // Scaffali (Lorenzo 8/11): da 8 salvati, quando non si cerca. Ogni scaffale c'è solo se filtra davvero
  // (una copertina con almeno 2 posti ma non tutti); quello del filtro già acceso sparisce (la sua pillola resta in
  // alto), gli altri contano solo i posti rimasti: così "Pizzerie" poi "Trastevere" restringe a ogni tocco.
  const scaffaliOn = all.length >= MIN_SCAFFALI;
  const scaffali = scaffaliOn && !searching;
  const filtraDavvero = (n: number, su: number) => n >= 2 && n < su;
  // "Vicino a te" solo se l'ordine non è già "Vicino" (revisore 8/11: tre filtri di luogo che si sovrappongono).
  const nVicino = sort !== "vicino" && scaffaleVicino.length >= 2 ? scaffaleVicino.length : 0;
  const vediZone = scaffali && !zonaAccesa && [nVicino, ...scaffaleZone.map((g) => g.n)].some((n) => filtraDavvero(n, perTipo.length));
  const vediTipi = scaffali && tipo === null && scaffaleTipi.some((g) => filtraDavvero(g.n, perZona.length));
  // Con una domanda scritta restano (revisore 4/11 sera): si sceglie a quale raccolta chiedere senza cancellarla.
  // Raccolte: restano con zona, tipo e stato accesi finché qualcuna ha posti tra quelli rimasti.
  const vediRaccolte = scaffaliOn && (!searching || domanda) && raccolta === null && (collections.length > 0 || (!zonaAccesa && tipo === null && statoOn === null));
  // Revisore 8/11: gli scaffali stanno in un riquadro solo con tre schede (Zone, Tipi, Raccolte) e una fila di
  // copertine basse, così all'apertura si vedono subito i primi posti della lista.
  const schede = ([vediZone && { key: "zone", label: "Zone" }, vediTipi && { key: "tipi", label: "Tipi" }, vediRaccolte && { key: "raccolte", label: "Raccolte" }] as const)
    .filter((x): x is { key: "zone" | "tipi" | "raccolte"; label: string } => !!x);
  const schedaOn = schede.find((x) => x.key === scheda)?.key ?? schede[0]?.key ?? null;
  const tipoAcceso = tipo === null ? null : { label: tipoPlurale(tipo), emoji: tipi.find((t) => t.label === tipo)?.emoji ?? "🍽️" };
  // Pillole dei filtri accesi, ognuna si toglie da sola (la ✕): zona, tipo, raccolta. Lo stato ha le sue due pillole.
  const attivi = [
    quartiere !== null && { key: "zona", label: quartiere, icona: "📍", togli: () => setQuartiere(null) },
    vicinoOn && { key: "vicino", label: "Vicino a te", icona: "📍", togli: () => setVicino(false) },
    tipoAcceso && { key: "tipo", label: tipoAcceso.label, icona: tipoAcceso.emoji, togli: () => setTipo(null) },
    raccolta !== null && { key: "raccolta", label: tagDisplay(raccolta), icona: icone[collections.findIndex((c) => c.name === raccolta)] ?? "🔖", togli: () => scegliRaccolta(null) },
  ].filter((a): a is { key: string; label: string; icona: string; togli: () => void } => !!a);
  const statoPills = (
  <div role="group" aria-label="Stato" data-testid="salvati-stato" className="flex shrink-0 gap-1.5">
    {pills.map((p) => (
      <button
        key={p.label}
        type="button"
        data-testid="salvati-stato-pillola"
        aria-pressed={p.on}
        aria-label={p.n === null ? p.label : `${p.label}, ${p.n}`}
        title={p.label}
        onClick={() => scegliStato(p.on && p.tag !== null ? null : p.tag)}
        className={`flex min-h-11 shrink-0 items-center gap-1 rounded-pill px-3 text-[14px] font-medium transition-colors active:scale-95 ${p.on ? "bg-brand font-semibold text-white" : "border border-[#e1e5e5] bg-white text-[#33373d]"}`}
      >
        {p.tag === DONE ? <Check size={14} strokeWidth={3} aria-hidden className={p.on ? "" : "text-brand"} /> : <span aria-hidden className="text-[13px] leading-none">📌</span>}
        {p.short} {p.n}
      </button>
    ))}
  </div>
  );
  const scegli = (cosa: string, n: number, fai: () => void) => { fai(); trackFeature("salvati_scaffale", { contesto: cosa, risultati: n }); };

  return (
    <section
      data-testid="salvati-lista"
      aria-label="I tuoi posti"
      onScroll={onScroll}
      className={`absolute inset-0 z-30 flex flex-col overflow-y-auto overscroll-contain ${PAPER} pb-[var(--nav-height-mobile)] lg:left-auto lg:w-[var(--pannello)] lg:border-l lg:border-border ${hideOnDesktop ? "lg:hidden" : ""}`}
    >
      <div className="mx-auto w-full max-w-md flex-1 px-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
        {/* Revisore 2/11: testata leggera. Sopra, il conteggio e l'ordine ("Recenti ▾") sulla stessa riga;
            accanto al titolo solo "Stasera" (con la sua etichetta) e un solo "+"; la mappa è il pulsante
            in basso, la ricerca la lente nella fila dei filtri. */}
        {/* Lorenzo 5/11: con salvati in più città, in alto le città ("Tutte 14 · Roma 12 · Milano 2") al posto del
            conteggio. Scelta una città la lista è solo di quella; la stessa scelta vale sulla mappa (e ritorno). */}
        <div className={`flex items-center justify-between ${citta.length > 0 ? "h-11 gap-1" : "h-5 gap-3"}`}>
          {citta.length > 0 ? (
            // Revisore 8/11: niente pillole tagliate di netto. Se la fila non entra, sfuma al bordo e ha il margine per
            // arrivare intera all'ultima città scorrendo.
            <div ref={cittaRef} role="group" aria-label="Città" data-testid="salvati-citta" data-scorre={cittaScorre ? "true" : undefined} className={`-ml-2.5 flex min-w-0 flex-1 items-center overflow-x-auto pl-2.5 [scrollbar-width:none] ${cittaScorre ? "pr-7 [mask-image:linear-gradient(to_right,#000_calc(100%-32px),transparent)]" : ""}`}>
              {citta.map((c) => {
                const on = (zonaOn?.nome ?? null) === c.nome;
                return (
                  <button
                    key={c.label}
                    type="button"
                    data-testid="salvati-citta-pillola"
                    aria-pressed={on}
                    aria-label={`${c.label}, ${c.n} ${c.n === 1 ? "posto" : "posti"}`}
                    onClick={() => { onZona(on && c.nome !== null ? null : c.nome); if (c.nome !== null && !on) trackFeature("salvati_citta", { n: c.n }); }}
                    className="flex min-h-11 shrink-0 items-center active:scale-95"
                  >
                    <span className={`flex h-8 items-center gap-[3px] rounded-pill px-[7px] text-[13.5px] ${on ? "bg-brand font-semibold text-white" : "font-medium text-[#33373d]"}`}>
                      {c.label} <span className={`text-[12px] font-semibold ${on ? "text-white/75" : "text-text-muted"}`}>{c.n}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p data-testid="salvati-lista-sopra" className="min-w-0 truncate font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              {rispostaAI && raccolta ? `${tagLabel(raccolta)} · ${nRaccolta} ${nRaccolta === 1 ? "posto" : "posti"}` : kicker}
            </p>
          )}
          {/* Ordine nel menu nativo del telefono: "Vicino" o "Recenti". Area toccabile alta 44 px senza alzare la riga. */}
          <label className="relative -my-3 -mr-1 flex min-h-11 shrink-0 items-center text-[13px] font-medium text-[#4a4f55]">
            <select
              data-testid="salvati-ordine"
              aria-label="Ordina"
              value={sort}
              onChange={(e) => { const k = e.target.value as Ordine; setOrdine(k); if (k === "vicino" && !origin && !locating) onLocate(); }}
              className="min-h-11 appearance-none bg-transparent pl-1 pr-5 text-right focus:outline-none"
            >
              <option value="vicino">{locating && !origin ? "Cerco…" : "Vicino"}</option>
              <option value="recenti">Recenti</option>
              <option value="preferiti">Preferiti</option>
              <option value="attesa">Da più tempo</option>
            </select>
            <ChevronDown size={14} aria-hidden className="pointer-events-none absolute right-1 text-text-muted" />
          </label>
        </div>
        <header className="mt-1 flex items-center justify-between gap-3">
          <h1 className={`${SERIF} min-w-0 text-[31px] font-medium leading-none tracking-tight text-text`}>I tuoi posti</h1>
          <div className="flex shrink-0 gap-1.5">
            {/* "Stasera" è uno strumento, non un filtro (revisore 2/11). Revisore 2/11 (quarto giro): forchetta e
                coltello barrati si leggevano "niente cibo / chiuso": luna corallo e la parola scritta accanto. */}
            <Link href="/stasera" data-testid="lista-stasera" aria-label="Stasera dove andiamo?" title="Stasera dove andiamo?" className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-pill border border-[#d6dcdc] bg-white pl-3 pr-3.5 text-[14px] font-medium text-text active:scale-95">
              <Moon size={16} strokeWidth={2} aria-hidden className="text-accent" />
              Stasera
            </Link>
            <Link href="/importa" aria-label="Aggiungi un posto" className={`${iconBtn} border-brand bg-brand text-white`}>
              <Plus size={20} aria-hidden />
            </Link>
          </div>
        </header>

        {/* Revisore 3/11 (area 3f): la ricerca sempre in vista, come la barra della mappa; si scrive al tocco. */}
        {/* Revisore 5/11: con 500 posti la ricerca resta attaccata in alto mentre si scorre (come Places e Mapstr). */}
        {/* Terzo revisore 5/11: la barra fissa ha il suo fondo (prima si vedevano pezzi di righe sopra). */}
        <div data-testid="salvati-barra-fissa" className="sticky top-0 z-20 -mx-4 mt-1 bg-[#f6f7f7] px-4 pb-1.5 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <form role="search" onSubmit={(e) => { e.preventDefault(); void chiedi(); }} data-testid="salvati-cerca-fissa" className="flex items-center gap-2 rounded-pill border border-[#d6dcdc] bg-white pl-4 pr-1 shadow-card">
            <Search size={16} className="shrink-0 text-text-muted" aria-hidden />
            <input
              type="search"
              value={testo}
              onChange={(e) => scrivi(e.target.value)}
              enterKeyHint="search"
              placeholder="Cerca nei tuoi posti o chiedi…"
              aria-label="Cerca nei tuoi posti"
              className="min-h-10 min-w-0 flex-1 bg-transparent text-base text-text placeholder:text-text-muted focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {testo !== "" && (
              <button type="button" aria-label="Cancella" onClick={() => scrivi("")} className="flex h-10 w-11 items-center justify-center text-text-muted">
                <X size={16} aria-hidden />
              </button>
            )}
          </form>
        </div>

        {domanda && (
          <section data-testid="chiedi-salvati" aria-live="polite" className="mt-3">
            {!attuale ? (
              // Con risultati per nome (es. "Da Enzo al 29") il pulsante resta secondario: non copre la lista.
              <button type="button" data-testid="chiedi-salvati-vai" onClick={() => void chiedi()} className={`flex min-h-11 w-full items-center gap-2 rounded-pill px-4 text-left text-sm font-display font-semibold active:scale-[0.98] ${list.length === 0 || testo.includes("?") ? "bg-accent text-white" : "border border-[#d6dcdc] bg-white text-accent"}`}>
                <Sparkles size={16} aria-hidden className="shrink-0" />
                <span className="min-w-0 flex-1 truncate">{raccolta ? `Chiedi a ${tagLabel(raccolta)}` : "Chiedi ai tuoi posti"}</span>
              </button>
            ) : attuale.stato === "cerco" ? (
              <p data-testid="chiedi-salvati-cerco" className="flex min-h-11 items-center gap-2 px-1 text-sm text-text-muted">
                <Sparkles size={16} aria-hidden className="animate-pulse text-accent" /> {raccolta ? `Guardo tra i ${nRaccolta} posti di ${tagLabel(raccolta)}…` : `Guardo tra i tuoi ${Math.min(all.length, MAX_POSTI)} posti…`}
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
                <p className="text-sm text-text">{raccolta ? `In ${tagLabel(raccolta)} nessuno fa al caso.` : "Tra i tuoi posti nessuno fa al caso."}</p>
                <Link href={`/assistente?q=${encodeURIComponent(testo.trim())}`} className="mt-3 inline-flex min-h-11 items-center rounded-pill bg-brand px-4 text-sm font-display font-semibold text-white active:scale-95">
                  Cercane uno nuovo
                </Link>
              </div>
            ) : (
              <>
                <h2 className="flex items-center gap-1.5 px-1 font-display text-xs font-semibold uppercase tracking-[0.12em] text-accent">
                  <Sparkles size={13} aria-hidden /> {raccolta ? `Dalla raccolta ${tagLabel(raccolta)}` : "Tra i tuoi posti"}
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
        {/* Revisore 2/11: una sola fila, scorrevole. Lorenzo 5/11: è la fila dei filtri rapidi: raccolte, stato
            (senza "Ci sono stato" quando è 0), tipi di locale presenti (i più frequenti) e "Nuova" in fondo.
            Il pulsante "Filtri" non c'è più: il suo foglio ripeteva stato, città e raccolte. */}
        {!scaffaliOn ? (
        <div data-testid="salvati-comandi" className="-mx-4 mt-2.5 flex items-center gap-1.5 overflow-x-auto px-4 py-0.5 [scrollbar-width:none]">
          {/* Le raccolte nella stessa fila (Places 07, Albo 12): un tocco filtra la lista. "Nuova" è l'ultima;
              senza raccolte resta solo lei, con l'invito scritto. */}
          <ul data-testid="salvati-raccolte" aria-label="Raccolte" className="flex shrink-0 gap-1.5">
            {collections.map((c, i) => {
              const on = raccolta === c.name;
              return (
                <li key={c.name} className="max-w-[200px] shrink-0">
                  <button
                    type="button"
                    data-testid="raccolta-cerchio"
                    aria-pressed={on}
                    aria-label={`${tagDisplay(c.name)}, ${c.count} ${c.count === 1 ? "posto" : "posti"}`}
                    onClick={() => scegliRaccolta(on ? null : c.name)}
                    className="block w-full text-left active:scale-[0.97]"
                  >
                    <Copertina name={c.name} count={c.count} icona={icone[i]} on={on} />
                  </button>
                </li>
              );
            })}
          </ul>
          {/* Revisore 3/11 (sesto): gli stati dopo le raccolte, con la parola ("📌 Da provare 8"): le raccolte
              entrano per prime nello schermo e lo stato si capisce senza indovinare il simbolo. */}
          {statoPills}
          {/* Tipi di locale dei tuoi salvati, con emoji e conteggio: "🍣 Giapponese 3". Un tocco filtra, un altro spegne. */}
          {tipiInVista.length > 0 && (
            <div role="group" aria-label="Tipo di locale" data-testid="salvati-tipi" className="flex shrink-0 gap-1.5">
              {tipiInVista.map((t) => {
                const on = tipo === t.label;
                return (
                  <button
                    key={t.label}
                    type="button"
                    data-testid="salvati-tipo-pillola"
                    aria-pressed={on}
                    aria-label={`${t.label}, ${t.n}`}
                    onClick={() => { setTipo(on ? null : t.label); if (!on) trackFeature("salvati_tipo", { n: t.n }); }}
                    className={`flex min-h-11 shrink-0 items-center gap-1 rounded-pill px-3 text-[14px] font-medium transition-colors active:scale-95 ${on ? "bg-brand font-semibold text-white" : "border border-[#e1e5e5] bg-white text-[#33373d]"}`}
                  >
                    <span aria-hidden className="text-[14px] leading-none">{t.emoji}</span>
                    {t.label} <span className={`text-[12px] font-semibold ${on ? "text-white/75" : "text-text-muted"}`}>{t.n}</span>
                  </button>
                );
              })}
            </div>
          )}
          {/* Revisore 3/11 (settimo): "Nuova" in fondo alla fila, dopo gli stati. */}
          <div className="shrink-0">
            <Link
              href="/profilo?raccolta=nuova"
              aria-label="Nuova raccolta"
              data-testid={collections.length === 0 ? "raccolte-vuote" : undefined}
              className="flex min-h-11 items-center gap-1 rounded-pill border-[1.5px] border-dashed border-[#c3cbcb] px-3.5 text-[14px] font-medium text-[#33373d] active:scale-[0.97]"
            >
              <Plus size={15} aria-hidden className="text-text-muted" />
              {collections.length === 0 ? "Nuova raccolta" : "Nuova"}
            </Link>
          </div>
        </div>
        ) : (
          // Lorenzo 8/11: in alto solo gli stati e i filtri accesi (ognuno con la sua ✕); quartieri, tipi e raccolte
          // stanno negli scaffali sotto. Niente doppioni: la stessa scelta in un posto solo.
          <div data-testid="salvati-comandi" className="-mx-4 mt-1.5 flex flex-wrap items-center gap-1.5 px-4 py-0.5">
            {attivi.length > 0 && (
              <div role="group" aria-label="Filtri accesi" data-testid="salvati-filtri-accesi" className="contents">
                {attivi.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    data-testid="salvati-filtro-acceso"
                    aria-label={`Togli ${f.label}`}
                    onClick={f.togli}
                    className="flex min-h-11 shrink-0 items-center gap-1 rounded-pill bg-brand pl-3 pr-2.5 text-[14px] font-semibold text-white active:scale-95"
                  >
                    <span aria-hidden className="text-[13px] leading-none">{f.icona}</span>
                    {f.label}
                    <X size={14} strokeWidth={2.5} aria-hidden className="ml-0.5 text-white/80" />
                  </button>
                ))}
              </div>
            )}
            {statoPills}
          </div>
        )}

        {/* Scaffali (Lorenzo 8/11, libreria di Places e Albo): con 500 salvati il posto giusto in due tocchi.
            Revisore 8/11: un riquadro solo, tre schede e una fila di copertine; sotto, subito la lista. */}
        {schedaOn && (
          <section data-testid="scaffali" aria-label="Scaffali" className="mt-1">
            <div className="flex items-center">
            <div role="tablist" aria-label="Scaffali" className="flex gap-5">
              {schede.map((x) => (
                <button
                  key={x.key}
                  type="button"
                  role="tab"
                  data-testid="scaffali-scheda"
                  aria-selected={schedaOn === x.key}
                  onClick={() => setScheda(x.key)}
                  className={`min-h-9 border-b-2 font-display text-[14px] font-semibold ${schedaOn === x.key ? "border-brand text-text" : "border-transparent text-text-muted"}`}
                >
                  {x.label}
                </button>
              ))}
            </div>
            {/* Attribuzione delle copertine a mappa (termini Mapbox/OpenStreetMap), fuori dalle immagini. */}
            {process.env.NEXT_PUBLIC_MAPBOX_TOKEN && <span data-testid="scaffali-attribuzione" className="ml-auto text-[10px] text-text-muted/80">© Mapbox © OpenStreetMap</span>}
            </div>
            <ul role="tabpanel" data-testid={schedaOn === "zone" ? "scaffale-zone" : schedaOn === "tipi" ? "scaffale-tipi" : "salvati-raccolte"} aria-label={schede.find((x) => x.key === schedaOn)?.label} className="-mx-4 mt-1.5 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
              {schedaOn === "zone" && (<>
                {nVicino > 0 && (
                  <CopertinaScaffale
                    g={{ key: "vicino", label: "Vicino a te", n: nVicino, posti: scaffaleVicino, icona: "📍" }}
                    fondo={FONDI.zona}
                    foto={fotoMie}
                    onTap={() => scegli("vicino", nVicino, () => { setVicino(true); setQuartiere(null); })}
                  />
                )}
                {scaffaleZone.map((g) => (
                  <CopertinaScaffale key={g.key} g={g} fondo={FONDI.zona} foto={fotoMie} onTap={() => scegli("zona", g.n, () => { setQuartiere(g.key); setVicino(false); })} />
                ))}
              </>)}
              {schedaOn === "tipi" && scaffaleTipi.map((g) => (
                <CopertinaScaffale key={g.key} g={g} fondo={FONDI.tipo} foto={fotoMie} onTap={() => scegli("tipo", g.n, () => setTipo(g.key))} />
              ))}
              {schedaOn === "raccolte" && (<>
                {collections.map((c, i) => (
                  <CopertinaScaffale
                    key={c.name}
                    g={{ key: c.name, label: tagDisplay(c.name), n: c.count, posti: [...c.preview].reverse(), icona: icone[i] }}
                    fondo={FONDI.raccolta}
                    foto={fotoMie}
                    testId="raccolta-cerchio"
                    cover="raccolta-copertina"
                    onTap={() => scegli("raccolta", c.count, () => scegliRaccolta(c.name))}
                  />
                ))}
                <li className="shrink-0">
                  <Link
                    href="/profilo?raccolta=nuova"
                    aria-label="Nuova raccolta"
                    data-testid={collections.length === 0 ? "raccolte-vuote" : "raccolta-nuova"}
                    className="block w-[112px] active:scale-[0.97]"
                  >
                    <span aria-hidden className="flex h-[64px] w-full items-center justify-center rounded-[12px] border-[1.5px] border-dashed border-[#c3cbcb]">
                      <Plus size={20} className="text-text-muted" />
                    </span>
                    <span className="mt-1 block truncate px-0.5 text-[13px] font-medium text-[#33373d]">Nuova</span>
                  </Link>
                </li>
              </>)}
            </ul>
          </section>
        )}

        {/* Quanti ne restano su quanti (della città scelta) e "Azzera", solo con un filtro acceso. */}
        {filtrando && !rispostaAI && (
          // Terzo revisore 5/11: anche il riassunto dei filtri ("9 wine bar su 100 a Milano · Azzera") resta fisso
          // sotto la ricerca: scorrendo si capisce sempre che la lista è filtrata.
          <div data-testid="salvati-risultato-riga" className="sticky top-[calc(max(0.5rem,env(safe-area-inset-top))+3rem)] z-10 -mx-4 mt-1 flex min-h-9 items-center justify-between gap-3 bg-[#f6f7f7] px-5">
            <p data-testid="salvati-risultato" aria-live="polite" className="min-w-0 truncate text-[13px] font-medium text-text-muted">
              {/* Lorenzo 8/11: con più filtri insieme una frase sola, "23 di 500 posti" (quali filtri lo dicono le pillole). */}
              {`${list.length} di ${base.length} ${base.length === 1 ? "posto" : "posti"}${zonaOn ? ` a ${zonaOn.nome}` : ""}`}
            </p>
            <button type="button" data-testid="salvati-azzera" onClick={azzera} className="-my-1 flex min-h-11 shrink-0 items-center px-1 text-[13px] font-semibold text-brand active:scale-95">
              Azzera
            </button>
          </div>
        )}

        {list.length === 0 && rispostaAI ? null : list.length === 0 ? (
          <div data-testid="salvati-lista-vuota" className={`mt-3 rounded-card border ${LINE} bg-white p-6 text-center`}>
            <p className={`${SERIF} text-xl font-medium text-text`}>Nessun posto qui</p>
            <p className="mt-1 text-sm text-text-muted">{altrove > 0 ? `In altre città ne hai ${altrove}.` : "Cambia la ricerca o i filtri."}</p>
            {altrove > 0 ? (
              <button
                type="button"
                data-testid="salvati-cerca-ovunque"
                onClick={() => onZona(null)}
                className="mt-4 min-h-11 rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white active:scale-95"
              >
                Cerca in tutte le città
              </button>
            ) : filtrando ? null /* revisore 5/11: "Azzera" sta già sopra, niente secondo pulsante uguale */ : (
              <button
                type="button"
                onClick={azzera}
                className="mt-4 min-h-11 rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white active:scale-95"
              >
                Mostra tutti
              </button>
            )}
          </div>
        ) : (
          <>
          <ul data-testid="salvati-lista-posti" className={`${schedaOn ? "mt-1.5" : "mt-2"} overflow-hidden rounded-card border ${LINE} bg-white shadow-card`}>
            {list.slice(0, quanti).map((p, i, vis) => {
              const sez = sezioneDi?.get(p.id);
              const nuova = !!sez && (i === 0 || sezioneDi?.get(vis[i - 1].id)?.titolo !== sez.titolo);
              return (
                <Fragment key={p.id}>
                  {nuova && (
                    <li data-testid="salvati-sezione" className={`flex items-baseline justify-between gap-2 bg-[#f9fafa] px-3 pb-1.5 pt-2.5 ${i === 0 ? "" : `border-t ${LINE}`}`}>
                      <span className="min-w-0 truncate font-display text-[11.5px] font-semibold uppercase tracking-[0.12em] text-[#4a4f55]">{sez.titolo}</span>
                      <span className="shrink-0 text-[12px] font-semibold text-text-muted">{sez.n}</span>
                    </li>
                  )}
                  <Riga p={p} primo={i === 0 || nuova} foto={fotoMie[p.id]} fonte={reels[p.id]} verdict={verdicts[p.id]?.verdict ?? null} origin={origin} daMese={daQuando(p)} onTap={apriRiga} />
                </Fragment>
              );
            })}
          </ul>
          </>
        )}
        {/* Riserva se lo scorrimento non le ha già portate (tastiera, schermi molto alti): le righe successive. */}
        {list.length > quanti && !rispostaAI && (
          <button type="button" data-testid="salvati-altri" onClick={() => setQuanti((n) => n + PASSO)} className="mt-2 flex min-h-11 w-full items-center justify-center rounded-pill text-[14px] font-semibold text-brand active:scale-[0.99]">
            Altri {list.length - quanti}
          </button>
        )}
        </>)}
      </div>
      {/* La mappa dei salvati: pulsante che resta in basso mentre si scorre (come "Map" in Places), così in
          alto restano solo "Stasera" e "+" (revisore 2/11). Revisore 2/11, sesto giro: copriva verdetto e stato
          dell'ultima riga. Sotto la lista resta uno spazio pari al pulsante + 16 px (pt-4), così in fondo l'ultima
          riga sta tutta sopra; a riposo una sfumatura carta dietro il pulsante, niente testo che ci passa sotto. */}
      {/* Con la sola risposta di "Chiedi ai tuoi posti" la lista è vuota: niente mappa vuota (revisore 3/11, quinto). */}
      {!rispostaAI && (
      <div className={`pointer-events-none sticky bottom-0 z-10 mt-auto flex shrink-0 justify-center pb-3 pt-4 lg:pb-6 ${mappaNascosta ? "" : "bg-gradient-to-t from-[#f6f7f7] from-55% to-transparent"}`}>
        <button
          type="button"
          data-testid="salvati-lista-mappa"
          data-nascosto={mappaNascosta ? "true" : undefined}
          aria-label="Vedi sulla mappa"
          aria-hidden={mappaNascosta || undefined}
          tabIndex={mappaNascosta ? -1 : undefined}
          onClick={() => { if (pausa.current) scrivi(testo, true); onMap(list.map((x) => x.id)); }}
          className={`flex min-h-11 items-center gap-1.5 rounded-pill bg-brand px-4 text-[14px] font-semibold text-white shadow-float transition-[transform,opacity] duration-200 active:scale-95 motion-reduce:transition-none ${mappaNascosta ? "translate-y-[calc(100%+1rem)] opacity-0" : "pointer-events-auto"}`}
        >
          <MapIcon size={16} aria-hidden /> Sulla mappa
        </button>
      </div>
      )}
    </section>
  );
}
