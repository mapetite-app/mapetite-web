"use client";

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
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
type Ordine = "vicino" | "recenti" | "preferiti";
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
  // "Chiedi ai tuoi posti" (PROPOSTE.md 33): una domanda a parole, l'AI sceglie solo tra i salvati.
  // Parte solo al tocco (o Invio): una chiamata Haiku per domanda, nessuna ricerca Google.
  // Proposta 44 (4/11): con una raccolta accesa ("Romantico") si chiede solo a quella raccolta.
  type Risposta = { q: string; raccolta: string | null; stato: "cerco" | "ok" | "errore"; scelti: { id: string; perche: string }[]; msg?: string };
  const [risposta, setRisposta] = useState<Risposta | null>(null);
  const raccolta = activeTag !== null && !isStateTag(activeTag) ? activeTag : null;
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
  const count = (tag: string) => base.filter((p) => hasStateOrTag(p.tags, tag)).length;
  const perStato = useMemo(() => (activeTag === null ? base : base.filter((p) => hasStateOrTag(p.tags, activeTag))), [base, activeTag]);
  // Tipi di locale presenti (con stato o raccolta accesi, quelli che restano), i più frequenti prima, con l'emoji
  // e il conteggio. Lo stesso tipo che si legge sulla riga (categoryLabel con il nome).
  const tipi = useMemo(() => {
    const m = new globalThis.Map<string, { label: string; emoji: string; n: number }>();
    for (const p of perStato) {
      const label = categoryLabel(p.category, p.name);
      if (!label) continue;
      const t = m.get(label);
      if (t) t.n++;
      else m.set(label, { label, emoji: getCategoryEmoji(p.category, p.name), n: 1 });
    }
    return [...m.values()].sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, "it"));
  }, [perStato]);
  // Un tipo solo non filtra niente: la fila dei tipi compare con almeno due tipi (o con quello acceso, anche a 0).
  const primiTipi = tipi.slice(0, MAX_TIPI);
  const tipiInVista = tipi.length < 2 && tipo === null ? [] : tipo !== null && !primiTipi.some((t) => t.label === tipo)
    ? [...primiTipi, tipi.find((t) => t.label === tipo) ?? { label: tipo, emoji: "🍽️", n: 0 }]
    : primiTipi;
  const shown = useMemo(() => filtraLista(perStato, tipo, cercato, testi), [perStato, tipo, cercato, testi]);
  // Copertine: i posti più recenti di ogni raccolta (la lista arriva dal più vecchio al più nuovo).
  // Con una città scelta, le raccolte di quella città (la raccolta accesa resta, anche se lì è vuota).
  const collections = useMemo(() => {
    const cs = summarizeCollections([...base].reverse(), 4);
    return activeTag !== null && !isStateTag(activeTag) && !cs.some((c) => c.name === activeTag) ? [...cs, { name: activeTag, count: 0, preview: [] }] : cs;
  }, [base, activeTag]);
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
  // "Aspettano da mesi" (PROPOSTE.md 40, PROBLEMI.md 18): i "Da provare" salvati da oltre 60 giorni
  // tornano su con una riga sola; un tocco li mostra da soli. Solo la data di salvataggio, costo zero.
  const [adesso] = useState(() => Date.now());
  const [soloMesi, setSoloMesi] = useState(false);
  const daMesi = useMemo(() => new Set(base.filter((p) => !p.tags?.includes(DONE) && p.businessStatus !== "CLOSED_PERMANENTLY" && p.savedAt && adesso - Date.parse(p.savedAt) > 60 * 86_400_000).map((p) => p.id)), [base, adesso]);
  const daQuando = (p: Place) => {
    if (!daMesi.has(p.id) || !p.savedAt) return null;
    const d = new Date(p.savedAt);
    const mese = d.toLocaleDateString("it-IT", { month: "long" });
    return new Date(adesso).getFullYear() === d.getFullYear() ? mese : `${mese} ${d.getFullYear()}`;
  };
  const shownMesi = useMemo(() => (soloMesi ? shown.filter((p) => daMesi.has(p.id)) : shown), [shown, soloMesi, daMesi]);
  const list = useMemo(() => {
    // Proposta 45: chi ha chiuso per sempre (secondo Google) va in fondo con qualsiasi ordine. Mai tolto.
    const chiuso = (p: Place) => (p.businessStatus === "CLOSED_PERMANENTLY" ? 1 : 0);
    // Revisore 3/11 (sesto): anche con "Vicino" i 👎 vanno in fondo (mai primo un posto che non fa per te).
    if (sort === "vicino" && origin) {
      const giu = (p: Place) => (p.tags?.includes(OPINION_DISLIKE) ? 1 : 0);
      return [...shownMesi].sort((a, b) => chiuso(a) - chiuso(b) || giu(a) - giu(b) || distanceMeters(origin, a) - distanceMeters(origin, b));
    }
    if (sort === "preferiti") {
      const peso = (p: Place) => (p.tags?.includes(OPINION_DISLIKE) ? 3 : p.tags?.includes(OPINION_LIKE) ? 0 : p.tags?.includes(DONE) ? 1 : 2);
      return [...shownMesi].reverse().sort((a, b) => chiuso(a) - chiuso(b) || peso(a) - peso(b));
    }
    const ordinati = sort === "recenti" ? [...shownMesi].reverse() : [...shownMesi];
    return ordinati.sort((a, b) => chiuso(a) - chiuso(b));
  }, [shownMesi, origin, sort]);
  // Un tocco su una riga apre la scheda con l'ordine della lista. Funzione stabile (le righe sono memo).
  const apri = useRef({ onOpen, ids: [] as string[] });
  useEffect(() => { apri.current = { onOpen, ids: list.map((x) => x.id) }; });
  const apriRiga = useCallback((p: Place) => apri.current.onOpen(p, apri.current.ids), []);
  // Righe disegnate: le prime PASSO, poi altre scorrendo (onScroll). Si riparte da capo a ogni filtro nuovo.
  const [quanti, setQuanti] = useState(PASSO);
  const chiaveFiltri = `${zonaOn?.nome ?? ""}|${activeTag ?? ""}|${tipo ?? ""}|${cercato}|${soloMesi}|${sort}`;
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
  const soloRisposta = domanda && list.length === 0 && activeTag === null && tipo === null && attuale !== null;
  // Revisore 4/11: con una domanda e nessun posto per nome conta solo la risposta dell'AI (anche con una raccolta
  // accesa): niente "Nessun posto qui" sotto la risposta né "0 di 14 posti" in testa.
  const rispostaAI = domanda && list.length === 0;
  const scelti = (attuale?.scelti ?? []).map((s) => ({ ...s, place: all.find((p) => p.id === s.id) })).filter((s): s is typeof s & { place: Place } => !!s.place);
  // Revisore 3/11: niente "Tutti" (è lo stato quando nessun filtro è acceso; un secondo tocco spegne):
  // così le raccolte entrano nello schermo già alla prima occhiata.
  // Revisore 3/11 (quinto): pillole compatte ("📌 8", "✓ 6", le stesse icone dello stato sulle righe);
  // l'etichetta intera resta per lo screen reader e come suggerimento.
  const pills: { label: string; short: string; n: number | null; on: boolean; tag: string | null }[] = [
    { label: "Da provare", short: "Da provare", n: count(WANT), on: activeTag === WANT, tag: WANT },
    { label: "Ci sono stato", short: "Visti", n: count(DONE), on: activeTag === DONE, tag: DONE },
    // Revisore 1/11: "Ci sono stato 0" è un filtro morto; torna appena c'è un posto (o se è acceso).
  ].filter((p) => p.tag !== DONE || (p.n ?? 0) > 0 || p.on);
  // Filtri accesi oltre alla città: sotto la fila compaiono "23 di 500" e "Azzera".
  const filtrando = searching || soloMesi || activeTag !== null || tipo !== null;
  const azzera = () => { onTag(null); scrivi(""); setTipo(null); setSoloMesi(false); };
  // Nessun posto in questa città ma qualcuno nelle altre: si propone di cercare dappertutto.
  const altrove = list.length === 0 && zonaOn && filtrando
    ? filtraLista(activeTag === null ? all : all.filter((p) => hasStateOrTag(p.tags, activeTag)), tipo, cercato, testi).length
    : 0;
  const citta = zone.length > 1 ? [{ nome: null as string | null, label: "Tutte", n: all.length }, ...zone.map((z) => ({ nome: z.nome as string | null, label: z.nome, n: z.posti.length }))] : [];
  const iconBtn = "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d6dcdc] text-text active:scale-95";

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
        <div className={`flex items-center justify-between gap-3 ${citta.length > 0 ? "h-11" : "h-5"}`}>
          {citta.length > 0 ? (
            <div role="group" aria-label="Città" data-testid="salvati-citta" className="-ml-3 flex min-w-0 flex-1 items-center overflow-x-auto pl-3 [scrollbar-width:none]">
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
                    <span className={`flex h-8 items-center gap-1 rounded-pill px-3 text-[14px] ${on ? "bg-brand font-semibold text-white" : "font-medium text-[#33373d]"}`}>
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
              className="min-h-11 appearance-none bg-transparent pl-2 pr-5 text-right focus:outline-none"
            >
              <option value="vicino">{locating && !origin ? "Cerco…" : "Vicino"}</option>
              <option value="recenti">Recenti</option>
              <option value="preferiti">Preferiti</option>
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
        <div data-testid="salvati-comandi" className="-mx-4 mt-2.5 flex items-center gap-1.5 overflow-x-auto px-4 py-0.5 [scrollbar-width:none]">
          {/* Le raccolte nella stessa fila (Places 07, Albo 12): un tocco filtra la lista. "Nuova" è l'ultima;
              senza raccolte resta solo lei, con l'invito scritto. */}
          <ul data-testid="salvati-raccolte" aria-label="Raccolte" className="flex shrink-0 gap-1.5">
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
          </ul>
          {/* Revisore 3/11 (sesto): gli stati dopo le raccolte, con la parola ("📌 Da provare 8"): le raccolte
              entrano per prime nello schermo e lo stato si capisce senza indovinare il simbolo. */}
          <div role="group" aria-label="Stato" data-testid="salvati-stato" className="flex shrink-0 gap-1.5">
            {pills.map((p) => (
              <button
                key={p.label}
                type="button"
                data-testid="salvati-stato-pillola"
                aria-pressed={p.on}
                aria-label={p.n === null ? p.label : `${p.label}, ${p.n}`}
                title={p.label}
                onClick={() => onTag(p.on && p.tag !== null ? null : p.tag)}
                className={`flex min-h-11 shrink-0 items-center gap-1 rounded-pill px-3 text-[14px] font-medium transition-colors active:scale-95 ${p.on ? "bg-brand font-semibold text-white" : "border border-[#e1e5e5] bg-white text-[#33373d]"}`}
              >
                {p.tag === DONE ? <Check size={14} strokeWidth={3} aria-hidden className={p.on ? "" : "text-brand"} /> : <span aria-hidden className="text-[13px] leading-none">📌</span>}
                {p.short} {p.n}
              </button>
            ))}
          </div>
          {/* "Aspettano da mesi" (proposta 40): era una riga sua sotto la fila; Lorenzo 5/11 ("testata più leggera")
              ora è una pillola della fila, dopo gli stati. Con un altro filtro acceso il conteggio non torna: sparisce. */}
          {daMesi.size > 0 && (soloMesi || (!searching && activeTag === null && tipo === null)) && (
            <button
              type="button"
              data-testid="salvati-da-mesi"
              aria-pressed={soloMesi}
              aria-label={soloMesi ? "Aspettano da mesi, togli il filtro" : `${daMesi.size} ${daMesi.size === 1 ? "posto aspetta" : "posti aspettano"} da mesi`}
              onClick={() => { setSoloMesi((v) => !v); if (!soloMesi) trackFeature("salvati_da_mesi", { n: daMesi.size }); }}
              className={`flex min-h-11 shrink-0 items-center gap-1 rounded-pill px-3 text-[14px] font-medium transition-colors active:scale-95 ${soloMesi ? "bg-brand font-semibold text-white" : "border border-[#e1e5e5] bg-white text-[#33373d]"}`}
            >
              <span aria-hidden className="text-[13px] leading-none">⏳</span>
              Da mesi <span className={`text-[12px] font-semibold ${soloMesi ? "text-white/75" : "text-text-muted"}`}>{daMesi.size}</span>
            </button>
          )}
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

        {/* Quanti ne restano su quanti (della città scelta) e "Azzera", solo con un filtro acceso. */}
        {filtrando && !rispostaAI && (
          // Terzo revisore 5/11: anche il riassunto dei filtri ("9 wine bar su 100 a Milano · Azzera") resta fisso
          // sotto la ricerca: scorrendo si capisce sempre che la lista è filtrata.
          <div data-testid="salvati-risultato-riga" className="sticky top-[calc(max(0.5rem,env(safe-area-inset-top))+3rem)] z-10 -mx-4 mt-1 flex min-h-9 items-center justify-between gap-3 bg-[#f6f7f7] px-5">
            <p data-testid="salvati-risultato" aria-live="polite" className="min-w-0 truncate text-[13px] font-medium text-text-muted">
              {tipo ? `${list.length} ${tipo.toLowerCase()} su ${base.length}${zonaOn ? ` a ${zonaOn.nome}` : ""}` : `${list.length} di ${base.length} ${base.length === 1 ? "posto" : "posti"}${zonaOn ? ` a ${zonaOn.nome}` : ""}`}
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
          <ul data-testid="salvati-lista-posti" className={`mt-2 overflow-hidden rounded-card border ${LINE} bg-white shadow-card`}>
            {list.slice(0, quanti).map((p, i) => (
              <Riga key={p.id} p={p} primo={i === 0} foto={fotoMie[p.id]} fonte={reels[p.id]} verdict={verdicts[p.id]?.verdict ?? null} origin={origin} daMese={daQuando(p)} onTap={apriRiga} />
            ))}
          </ul>
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
