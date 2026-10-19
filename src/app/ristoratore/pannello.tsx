import Link from "next/link";
import { BadgeCheck, Check, ChevronDown, ChevronRight, MapPin, Megaphone, Sparkles, X } from "lucide-react";
import { categoryLabel } from "@/lib/category-label";
import { displayAddress } from "@/lib/city";
import { cosaDiconoINumeri, mostraPersone, SOGLIA, TREND_ESEMPIO, type Azione, type PannelloRistoratore, type RistLocale, type TrendFascia, type Voce } from "@/lib/ristoratore";
import { adattoAllaRicerca, RICERCHE_DEMO, SPONSOR_DEMO } from "@/lib/evidenza";
import TracciaFunzione from "@/components/traccia-funzione";
import Schede from "./schede";
import SerateTranquille from "./serate";

// Pannello del ristoratore (piano 8.2): stessa grafica per i dati veri (/ristoratore/[id]) e per
// l'esempio dimostrativo (/ristoratore/demo). Solo numeri aggregati; le etichette dei piani
// (Verified, Growth, Pro) mostrano cosa entra in ciascuno (per il pitch, nessun pagamento).
//
// Struttura (feedback di Lorenzo 16/10: "tante funzioni, uso semplice"): in cima 4 numeri chiave
// e due frasi "Cosa ti dicono i numeri"; il dettaglio è diviso in quattro schede (Panoramica ·
// Clienti · Zona · Promozione) e ogni elenco mostra i primi 3 con "Vedi tutto". Nessun dato tolto.

export const PERIODI = [7, 30] as const;
const VISTE = ["panoramica", "clienti", "zona", "promozione"] as const;

const FASCIA_LABEL: Record<string, string> = {
  mattina: "Mattina", pranzo: "Pranzo", pomeriggio: "Pomeriggio", aperitivo: "Aperitivo", cena: "Cena", notte: "Notte",
};
const giornoBreve = (key: string) => new Date(`${key}T12:00:00Z`).toLocaleDateString("it-IT", { day: "numeric", month: "short", timeZone: "UTC" });
const fmt = (n: number) => n.toLocaleString("it-IT", { maximumFractionDigits: 1 });

function Piano({ nome }: { nome: "Verified" | "Growth" | "Pro" }) {
  const tone = nome === "Verified" ? "text-brand/70" : nome === "Growth" ? "text-brand" : "text-accent";
  return <span className={`text-[10px] font-display font-semibold uppercase tracking-wider ${tone}`}>{nome}</span>;
}

function Sezione({ titolo, nota, piano, children, testId }: { titolo: string; nota?: string; piano?: "Verified" | "Growth" | "Pro"; children: React.ReactNode; testId?: string }) {
  return (
    <section data-testid={testId} className="mt-4 rounded-card border border-border bg-white p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-[15px] font-semibold text-text">{titolo}</h2>
        {piano && <Piano nome={piano} />}
      </div>
      {nota && <p className="mt-0.5 text-xs font-sans leading-snug text-text-muted">{nota}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Sottotitolo({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <h3 className={`mb-2 text-[11px] font-display font-semibold uppercase tracking-wide text-text-muted ${className}`}>{children}</h3>;
}

// "Vedi tutto": il resto dell'elenco, chiuso. Nativo (<details>), funziona anche senza JS.
function VediTutto({ n, children, testId }: { n: number; children: React.ReactNode; testId?: string }) {
  return (
    <details data-testid={testId} className="group mt-2">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-display font-semibold text-brand [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">Vedi tutto ({n})</span>
        <span className="hidden group-open:inline">Mostra meno</span>
        <ChevronDown size={14} aria-hidden className="transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

// Variazione rispetto al periodo precedente: solo se entrambi i numeri superano la soglia
// (una percentuale su 1 o 2 persone non vuol dire niente e le farebbe riconoscere).
function variazione(cur: number, prima: number): { testo: string; su: boolean } | null {
  if (cur < SOGLIA || prima < SOGLIA) return null;
  const d = Math.round(((cur - prima) / prima) * 100);
  return { testo: `${d > 0 ? "+" : ""}${d}%`, su: d >= 0 };
}

// Barre orizzontali: etichetta, barra e numero di persone (con la soglia). Primi 3, poi "Vedi tutto".
const PRIMI = 3;
function Barre({ voci, vuoto, max = 10, etichetta, testId }: { voci: Voce[]; vuoto: string; max?: number; etichetta?: (k: string) => string; testId?: string }) {
  const list = voci.filter((v) => v.persone > 0 || v.volte > 0).slice(0, max);
  if (list.length === 0) return <p className="text-sm font-sans text-text-muted">{vuoto}</p>;
  const top = Math.max(1, ...list.map((v) => v.persone));
  const riga = (v: Voce) => (
    <li key={v.chiave} className="text-sm font-sans">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-text first-letter:uppercase">{etichetta ? etichetta(v.chiave) : v.chiave}</span>
        <span className="shrink-0 tabular-nums text-xs text-text-muted">{mostraPersone(v.persone)}</span>
      </div>
      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface">
        <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.max(4, (v.persone / top) * 100)}%` }} />
      </span>
    </li>
  );
  return (
    <div data-testid={testId}>
      <ul className="space-y-2.5">{list.slice(0, PRIMI).map(riga)}</ul>
      {list.length > PRIMI && (
        <VediTutto n={list.length}>
          <ul className="space-y-2.5">{list.slice(PRIMI).map(riga)}</ul>
        </VediTutto>
      )}
    </div>
  );
}

// Fasce orarie nell'ordine della giornata (barre orizzontali: leggibili anche a 390 px),
// numeri solo sopra la soglia.
function Fasce({ voci }: { voci: Voce[] }) {
  const top = Math.max(1, ...voci.map((v) => v.persone));
  return (
    <ul data-testid="pannello-fasce" className="space-y-1.5">
      {voci.map((v) => (
        <li key={v.chiave} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-2 text-sm font-sans">
          <span className="text-text">{FASCIA_LABEL[v.chiave] ?? v.chiave}</span>
          <span className="h-2 overflow-hidden rounded-full bg-surface">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${v.persone > 0 ? Math.max(4, (v.persone / top) * 100) : 0}%` }} />
          </span>
          <span className="w-16 text-right text-xs tabular-nums text-text-muted">{mostraPersone(v.persone)}</span>
        </li>
      ))}
    </ul>
  );
}

// Andamento giorno per giorno in SVG: area delle persone che hanno visto la scheda e punti
// dei salvataggi. Niente librerie: si legge sul telefono e scala su computer.
function Andamento({ p }: { p: PannelloRistoratore }) {
  const W = 600, H = 150, PAD = 6;
  const g = p.perGiorno;
  const top = Math.max(SOGLIA, ...g.map((d) => d.viste));
  const x = (i: number) => (g.length === 1 ? W / 2 : PAD + (i * (W - 2 * PAD)) / (g.length - 1));
  const y = (v: number) => H - PAD - (v / top) * (H - 2 * PAD);
  const line = g.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.viste).toFixed(1)}`).join(" ");
  const area = `${line} L${x(g.length - 1).toFixed(1)},${H - PAD} L${x(0).toFixed(1)},${H - PAD} Z`;
  const totSalvati = g.reduce((s, d) => s + d.salvati, 0);
  return (
    <div data-testid="pannello-andamento">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-28 w-full" role="img" aria-label="Persone che hanno visto la scheda, giorno per giorno">
        {[0.5].map((f) => (
          <line key={f} x1={0} x2={W} y1={PAD + f * (H - 2 * PAD)} y2={PAD + f * (H - 2 * PAD)} stroke="var(--color-border)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        <path d={area} fill="var(--color-brand)" opacity={0.1} />
        <path d={line} fill="none" stroke="var(--color-brand)" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {g.map((d, i) => (
          <g key={d.giorno}>
            <title>{`${giornoBreve(d.giorno)}: ${mostraPersone(d.viste)} hanno visto la scheda, ${mostraPersone(d.salvati)} l'hanno salvato`}</title>
            <rect x={x(i) - W / g.length / 2} y={0} width={W / g.length} height={H} fill="transparent" />
            {d.salvati >= SOGLIA && <circle cx={x(i)} cy={y(d.viste)} r={3} fill="var(--color-accent)" />}
          </g>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] font-sans text-text-muted">
        <span>{giornoBreve(g[0].giorno)}</span>
        <span>oggi</span>
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-sans text-text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-brand" aria-hidden />Hanno visto la scheda</span>
        {totSalvati >= SOGLIA && <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-accent" aria-hidden />Giorni con almeno {SOGLIA} salvataggi</span>}
      </p>
    </div>
  );
}

function Confronto({ p, categoria, citta }: { p: PannelloRistoratore; categoria: string | null; citta: string | null }) {
  const c = p.confronto;
  const dove = [categoria ? `categoria “${categoria}”` : null, citta ? `a ${citta}` : null].filter(Boolean).join(", ");
  const tra = dove ? ` (${dove})` : "";
  if (c.mediaViste === null || c.mediaSalvati === null) {
    return <p className="text-sm font-sans text-text-muted">Ancora pochi locali simili su Mapetite ({c.simili}) per un confronto che non riveli i numeri di un singolo locale. Servono almeno {SOGLIA} locali simili{tra}.</p>;
  }
  const righe = [
    { label: "Hanno visto la scheda", tuo: c.viste, media: c.mediaViste },
    { label: "L'hanno salvato", tuo: c.salvati, media: c.mediaSalvati },
  ];
  return (
    <div data-testid="pannello-confronto" className="space-y-4">
      {righe.map((r) => {
        const top = Math.max(1, r.tuo, r.media);
        const volte = r.media > 0 ? r.tuo / r.media : null;
        return (
          <div key={r.label}>
            <div className="flex items-baseline justify-between gap-2 text-sm font-sans">
              <span className="text-text">{r.label}</span>
              {volte !== null && r.tuo >= SOGLIA && (
                <span className={`text-xs font-display font-semibold ${volte >= 1 ? "text-success" : "text-accent"}`}>
                  {volte >= 1 ? `${fmt(volte)}× la media` : `${Math.round(volte * 100)}% della media`}
                </span>
              )}
            </div>
            <div className="mt-1.5 space-y-1 text-xs font-sans">
              <div className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-2">
                <span className="text-text">Tu</span>
                <span className="h-2 overflow-hidden rounded-full bg-surface"><span className="block h-full rounded-full bg-brand" style={{ width: `${(r.tuo / top) * 100}%` }} /></span>
                <span className="w-14 text-right tabular-nums text-text">{mostraPersone(r.tuo)}</span>
              </div>
              <div className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-2">
                <span className="text-text-muted">Media zona</span>
                <span className="h-2 overflow-hidden rounded-full bg-surface"><span className="block h-full rounded-full bg-text-muted/50" style={{ width: `${(r.media / top) * 100}%` }} /></span>
                <span className="w-14 text-right tabular-nums text-text-muted">{fmt(r.media)}</span>
              </div>
            </div>
          </div>
        );
      })}
      <p className="text-[11px] font-sans text-text-muted">Media di {c.simili} locali simili su Mapetite{tra}, stesso periodo.</p>
    </div>
  );
}

// Trend di zona (piano 8.4): per fascia oraria, le richieste più frequenti di chi cerca nella
// zona. Anonimi e aggregati. Con pochi dati veri si mostra un esempio DICHIARATO come tale.
// Le 3 fasce più cercate sono aperte; le altre dietro "Vedi tutto".
const TREND_MIN = 20;
function TrendZona({ trend, esempio }: { trend: TrendFascia[]; esempio: boolean }) {
  const top = Math.max(1, ...trend.map((t) => t.persone));
  const picco = trend.reduce((a, b) => (b.persone > a.persone ? b : a), trend[0]);
  const forti = new Set([...trend].sort((a, b) => b.persone - a.persone).slice(0, PRIMI).map((t) => t.fascia));
  const riga = (t: TrendFascia) => (
    <li key={t.fascia} data-testid="trend-fascia">
      <div className="flex items-baseline justify-between gap-2 text-sm font-sans">
        <span className="font-display font-semibold text-text">{FASCIA_LABEL[t.fascia] ?? t.fascia}</span>
        <span className="shrink-0 text-xs tabular-nums text-text-muted">{mostraPersone(t.persone)} persone</span>
      </div>
      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface">
        <span className="block h-full rounded-full bg-accent" style={{ width: `${t.persone > 0 ? Math.max(4, (t.persone / top) * 100) : 0}%` }} />
      </span>
      {t.richieste.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {t.richieste.map((r) => (
            <span key={r.chiave} className="inline-flex max-w-full items-center gap-1 rounded-pill bg-surface px-2.5 py-0.5 text-xs font-sans text-text">
              <span className="truncate first-letter:uppercase">{r.chiave}</span>
              <span className="shrink-0 text-text-muted">· {mostraPersone(r.persone)}</span>
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-xs font-sans text-text-muted">Nessuna richiesta particolare.</p>
      )}
    </li>
  );
  const resto = trend.filter((t) => !forti.has(t.fascia));
  return (
    <div data-testid="trend-zona">
      {esempio && (
        <p data-testid="trend-esempio" className="mb-3 rounded-card border border-dashed border-accent bg-accent-light px-3 py-2 text-xs font-sans text-text">
          <strong className="font-display">Esempio.</strong> Le ricerche nella tua zona sono ancora poche: questi numeri sono inventati e mostrano come apparirà il trend.
        </p>
      )}
      {picco && picco.persone >= SOGLIA && (
        <p data-testid="trend-picco" className="mb-3 text-sm font-sans text-text">
          Il momento in cui si cerca di più: <strong className="font-display text-brand">{(FASCIA_LABEL[picco.fascia] ?? picco.fascia).toLowerCase()}</strong>
          {picco.richieste[0] && <>, soprattutto “{picco.richieste[0].chiave}”</>}.
        </p>
      )}
      <ul className="space-y-3">{trend.filter((t) => forti.has(t.fascia)).map(riga)}</ul>
      {resto.length > 0 && (
        <VediTutto n={trend.length}>
          <ul className="space-y-3">{resto.map(riga)}</ul>
        </VediTutto>
      )}
    </div>
  );
}

// Posti in evidenza (piano 8.3), SOLO dimostrativo: come appare un locale sponsorizzato e la
// regola che lo fa comparire. Nei risultati veri della ricerca non c'è nessuno sponsorizzato.
function InEvidenzaDemo() {
  const verifiche = RICERCHE_DEMO.map((r) => ({ r, v: adattoAllaRicerca(SPONSOR_DEMO, r) }));
  return (
    <div data-testid="evidenza-demo">
      <TracciaFunzione nome="ristoratore_evidenza" contesto="demo" />
      <p className="text-sm font-sans text-text">Come lo vede chi cerca “{RICERCHE_DEMO[0].frase}”:</p>
      <div data-testid="evidenza-card" className="mt-2 rounded-card border-2 border-accent/60 bg-white p-3 shadow-card">
        <div className="flex items-start gap-3">
          <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-accent-light text-2xl">🍝</span>
          <div className="min-w-0 flex-1">
            <span className="block truncate font-display text-base font-semibold text-text">{SPONSOR_DEMO.nome}</span>
            <span data-testid="etichetta-sponsorizzato" className="mt-0.5 inline-flex items-center gap-1 rounded-pill bg-text px-2 py-0.5 text-[10px] font-display font-semibold uppercase tracking-wider text-white">
              <Megaphone size={11} aria-hidden />In evidenza · Sponsorizzato
            </span>
            <p className="mt-1 text-xs font-sans text-text-muted">Osteria · Pigneto, Roma</p>
            <p className="mt-1.5 text-sm font-sans leading-snug text-text">{verifiche[0].v.motivo}</p>
          </div>
        </div>
      </div>
      <p className="mt-1.5 text-[11px] font-sans text-text-muted">Si aggiunge dopo i primi risultati, non prende il posto di nessuno.</p>

      <Sottotitolo className="mt-5">Quando compare (e quando no)</Sottotitolo>
      <ul className="space-y-2">
        {verifiche.map(({ r, v }) => (
          <li key={r.frase} data-testid={v.mostra ? "evidenza-si" : "evidenza-no"} className="flex gap-2.5 rounded-card bg-surface p-3">
            <span aria-hidden className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${v.mostra ? "bg-success text-white" : "bg-white text-text-muted"}`}>
              {v.mostra ? <Check size={14} /> : <X size={14} />}
            </span>
            <span className="min-w-0 text-sm font-sans">
              <span className="block font-display font-semibold text-text">“{r.frase}”</span>
              <span className="block text-text-muted">{v.mostra ? "Compare. " : "Non compare. "}{v.motivo}</span>
            </span>
          </li>
        ))}
      </ul>

      <VediTutto n={4} testId="evidenza-regole-apri">
        <ul data-testid="evidenza-regole" className="space-y-1.5 text-sm font-sans leading-snug text-text">
          <li>• Compare solo se rispetta <strong>tutto</strong> quello che la persona ha chiesto: tipo di locale, zona, caratteristiche. Nel dubbio non compare.</li>
          <li>• Sempre con l&apos;etichetta “Sponsorizzato”, ben visibile.</li>
          <li>• Al massimo uno per ricerca, e non cambia l&apos;ordine degli altri risultati.</li>
          <li>• Il verdetto resta quello delle recensioni: pagare non lo cambia.</li>
        </ul>
      </VediTutto>
    </div>
  );
}

// Numero chiave della prima schermata: grande, con la tendenza sul periodo prima.
function Numero({ a, giorni, forte = false }: { a: Azione; giorni: number; forte?: boolean }) {
  const v = variazione(a.persone, a.prima);
  return (
    <div data-testid="numero-chiave" className={`rounded-card p-3.5 ${forte ? "bg-brand text-white" : "bg-surface"}`}>
      <p className={`text-[12px] font-sans leading-snug ${forte ? "text-white/80" : "text-text-muted"}`}>{a.etichetta}</p>
      <p className={`mt-1 font-display font-semibold tabular-nums leading-none ${a.persone > 0 && a.persone < SOGLIA ? "text-lg" : "text-[28px]"} ${forte ? "text-white" : "text-brand"}`}>{mostraPersone(a.persone)}</p>
      <p className={`mt-1.5 text-[11px] font-sans ${forte ? "text-white/80" : "text-text-muted"}`}>
        {v ? (
          <><span className={`font-semibold ${forte ? "text-white" : v.su ? "text-success" : "text-accent"}`}>{v.su ? "↑" : "↓"} {v.testo}</span> sui {giorni} giorni prima</>
        ) : (
          "persone"
        )}
      </p>
    </div>
  );
}

// Scorciatoie dalla Panoramica alle altre schede (gestite da schede.tsx con data-vai).
function Vai({ id, titolo, testo }: { id: string; titolo: string; testo: string }) {
  return (
    <a href={`?vista=${id}`} data-vai={id} className="flex items-center gap-3 py-3 active:opacity-70">
      <span className="min-w-0 flex-1">
        <span className="block font-display text-sm font-semibold text-text">{titolo}</span>
        <span className="block truncate text-xs font-sans text-text-muted">{testo}</span>
      </span>
      <ChevronRight size={18} aria-hidden className="shrink-0 text-text-muted" />
    </a>
  );
}

export default function Pannello({
  p,
  locale,
  citta,
  verificato,
  base,
  demo = false,
  avviso,
  vista,
  serate = { giorni: [], at: null },
}: {
  p: PannelloRistoratore;
  locale: RistLocale;
  citta: string | null;
  verificato: boolean;
  base: string;
  demo?: boolean;
  avviso?: string | null;
  vista?: string;
  serate?: { giorni: number[]; at: string | null };
}) {
  const categoria = categoryLabel(locale.category);
  const az = (t: Azione["tipo"]) => p.azioni.find((a) => a.tipo === t)!;
  const chiave = [az("apri_scheda"), az("salva"), az("ci_sono_stato"), az("percorso")];
  const frasi = cosaDiconoINumeri(p);
  const trendEsempio = !demo && p.zona.ricerche < TREND_MIN;
  const zonaNome = p.zona.nome ? `a ${p.zona.nome}` : "nella tua zona";

  const attesa = p.inAttesa;
  const risposte = p.visite.piaciuto + p.visite.nonPiaciuto;
  const panoramica = (
    <>
      <section data-testid="pannello-azioni" aria-label={`Le persone e il tuo locale negli ultimi ${p.giorni} giorni`} className="mt-3 grid grid-cols-2 gap-2">
        {chiave.map((a, i) => <Numero key={a.tipo} a={a} giorni={p.giorni} forte={i === 0} />)}
      </section>

      {/* Domanda latente: il dato che nessun altro dà al ristoratore (POSIZIONAMENTO.md, proposta 2).
          Compatta, sotto i 4 numeri: la prima schermata resta quella. */}
      {(attesa.persone > 0 || risposte >= SOGLIA || p.disdette.n > 0) && (
        <section data-testid="pannello-in-attesa" className="mt-2 rounded-card bg-brand px-4 py-3 text-white shadow-card">
          {attesa.persone > 0 && (
            <p className="flex items-baseline gap-2">
              <span className="font-title text-2xl font-semibold leading-none">{mostraPersone(attesa.persone)}</span>
              <span className="text-sm font-sans leading-snug text-white/90">ti vogliono provare: hanno salvato il locale e non ci sono ancora state</span>
            </p>
          )}
          {attesa.occasioni.some((o) => o.persone >= SOGLIA) && (
            <p className="mt-2 flex flex-wrap gap-1.5" aria-label="Per quale occasione">
              {attesa.occasioni.filter((o) => o.persone >= SOGLIA).map((o) => (
                <span key={o.chiave} className="rounded-pill bg-white/15 px-2.5 py-0.5 text-xs font-display font-semibold">{o.chiave} · {o.persone}</span>
              ))}
            </p>
          )}
          {/* Visite vere (POSIZIONAMENTO.md, proposta 4): il "Com'è andata?" di chi ci è stato davvero.
              Solo sopra la soglia di risposte: con 1 o 2 si riconoscerebbe chi ha risposto. */}
          {risposte >= SOGLIA && (
            <p data-testid="pannello-visite-vere" className={`flex items-baseline gap-2 ${attesa.persone > 0 ? "mt-2.5 border-t border-white/15 pt-2.5" : ""}`}>
              <span className="whitespace-nowrap font-title text-2xl font-semibold leading-none">👍 {p.visite.piaciuto.toLocaleString("it-IT")}</span>
              <span className="text-sm font-sans leading-snug text-white/90">
                su {risposte.toLocaleString("it-IT")}: chi ti aveva salvato, ci è andato e ha detto com&apos;è andata ({p.giorni} giorni)
              </span>
            </p>
          )}
          {/* Tavoli liberati per tempo (PROBLEMI.md 1): chi aveva prenotato da Mapetite e non poteva più venire
              ti ha avvisato con "Non vado più", invece di non presentarsi. */}
          {p.disdette.n > 0 && (
            <p data-testid="pannello-disdette" className={`flex items-baseline gap-2 ${attesa.persone > 0 || risposte >= SOGLIA ? "mt-2.5 border-t border-white/15 pt-2.5" : ""}`}>
              <span className="whitespace-nowrap font-title text-2xl font-semibold leading-none">🔁 {p.disdette.n.toLocaleString("it-IT")}</span>
              <span className="text-sm font-sans leading-snug text-white/90">
                {p.disdette.n === 1 ? "tavolo liberato per tempo" : "tavoli liberati per tempo"}: chi aveva prenotato da Mapetite ti ha avvisato invece di non presentarsi{p.disdette.orePrimaMedia != null ? `, in media ${p.disdette.orePrimaMedia} ${p.disdette.orePrimaMedia === 1 ? "ora" : "ore"} prima` : ""} ({p.giorni} giorni)
              </span>
            </p>
          )}
        </section>
      )}

      {frasi.length > 0 && (
        <section data-testid="pannello-insight" className="mt-3 rounded-card border border-accent/30 bg-accent-light/60 p-4">
          <h2 className="flex items-center gap-1.5 text-[11px] font-display font-semibold uppercase tracking-wide text-accent">
            <Sparkles size={13} aria-hidden />Cosa ti dicono i numeri
          </h2>
          <ul className="mt-2 space-y-1.5">
            {frasi.map((f) => <li key={f} className="text-[15px] font-sans leading-snug text-text">{f}</li>)}
          </ul>
        </section>
      )}

      <Sezione titolo="Giorno per giorno" piano="Verified">
        {/* Con meno di 3 persone anche la forma della curva direbbe chi è passato e quando. */}
        {p.pochiDati ? (
          <p data-testid="pannello-andamento-nascosto" className="text-sm font-sans text-text-muted">L&apos;andamento compare quando almeno {SOGLIA} persone hanno visto la scheda nel periodo.</p>
        ) : (
          <Andamento p={p} />
        )}
      </Sezione>

      <Sezione titolo="Rispetto ai locali simili" piano="Pro" testId="pannello-confronto-sezione">
        <Confronto p={p} categoria={categoria} citta={citta} />
      </Sezione>

      <nav aria-label="Approfondisci" className="mt-4 divide-y divide-border rounded-card border border-border bg-white px-4">
        <Vai id="clienti" titolo="Clienti" testo="Cosa chiedeva chi ti ha trovato, e tutte le azioni" />
        <Vai id="zona" titolo={`Zona`} testo={`Cosa cerca la gente ${zonaNome}, ora per ora`} />
        <Vai id="promozione" titolo="Promozione" testo="Serate tranquille e posti in evidenza" />
      </nav>
    </>
  );

  const clienti = (
    <>
      <Sezione
        titolo="Come ti trovano"
        nota={p.daRicerca.ricerche > 0 ? `Le ricerche da cui ${mostraPersone(p.daRicerca.persone)} persone hanno aperto la tua scheda.` : undefined}
        piano="Growth"
        testId="pannello-come-ti-trovano"
      >
        {p.daRicerca.ricerche > 0 ? (
          <div className="space-y-5">
            <div>
              <Sottotitolo>Cosa chiedevano</Sottotitolo>
              <Barre voci={p.daRicerca.richieste} vuoto="Ricerche senza richieste particolari." testId="pannello-richieste-locale" />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Sottotitolo>Che locale cercavano</Sottotitolo>
                <Barre voci={p.daRicerca.tipi} vuoto="—" />
              </div>
              <div>
                <Sottotitolo>Dove</Sottotitolo>
                <Barre voci={p.daRicerca.zone} vuoto="—" />
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm font-sans text-text-muted">In questo periodo nessuno ha aperto la tua scheda dai risultati di una ricerca. Nella scheda Zona: cosa cercano le persone intorno a te.</p>
        )}
      </Sezione>

      <Sezione titolo="Tutte le azioni" nota={`Persone diverse negli ultimi ${p.giorni} giorni, e la differenza con i ${p.giorni} giorni prima.`} piano="Verified" testId="pannello-tutte-azioni">
        <ul className="divide-y divide-border">
          {p.azioni.map((a) => {
            const v = variazione(a.persone, a.prima);
            return (
              <li key={a.tipo} className="flex items-baseline justify-between gap-3 py-2 text-sm font-sans">
                <span className="text-text">{a.etichetta}</span>
                <span className="shrink-0 tabular-nums">
                  <span className="font-display font-semibold text-brand">{mostraPersone(a.persone)}</span>
                  {v && <span className={`ml-2 text-xs ${v.su ? "text-success" : "text-accent"}`}>{v.testo}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      </Sezione>
    </>
  );

  const zona = (
    <>
      <Sezione
        titolo={`Cosa cerca la gente ${zonaNome}`}
        nota={p.zona.ricerche > 0 ? `${mostraPersone(p.zona.persone)} persone hanno cercato nella tua zona.` : undefined}
        piano="Growth"
        testId="pannello-zona"
      >
        {p.zona.ricerche > 0 ? (
          <div className="space-y-5">
            <div>
              <Sottotitolo>Le richieste più frequenti</Sottotitolo>
              <Barre voci={p.zona.richieste} vuoto="Ricerche senza richieste particolari." testId="pannello-richieste-zona" />
            </div>
            <div>
              <Sottotitolo>Che locale cercano</Sottotitolo>
              <Barre voci={p.zona.tipi} vuoto="—" />
            </div>
            <div>
              <Sottotitolo>Quando cercano</Sottotitolo>
              <Fasce voci={p.zona.fasce} />
            </div>
          </div>
        ) : (
          <p className="text-sm font-sans text-text-muted">Ancora nessuna ricerca nella tua zona in questo periodo.</p>
        )}
      </Sezione>

      <Sezione titolo="Trend per fascia oraria" nota="Cosa chiede chi cerca nella tua zona, fascia per fascia. Anonimo e aggregato." piano="Pro" testId="pannello-trend">
        <TrendZona trend={trendEsempio ? TREND_ESEMPIO : p.zona.trend} esempio={trendEsempio} />
      </Sezione>
    </>
  );

  const evidenza = demo ? (
    <Sezione titolo="Posti in evidenza" nota="Esempio: attivo quando ci saranno ristoratori. Oggi nei risultati veri non c'è nessuno sponsorizzato." piano="Pro" testId="pannello-evidenza">
      <InEvidenzaDemo />
    </Sezione>
  ) : (
    <Sezione titolo="Posti in evidenza" piano="Pro" testId="pannello-promozione">
      <p className="text-sm font-sans leading-snug text-text">
        In arrivo. Un locale in evidenza compare solo quando è adatto a quello che la persona ha chiesto, sempre con l&apos;etichetta “Sponsorizzato”.
      </p>
      <Link href="/ristoratore/demo?vista=promozione" className="mt-3 inline-flex items-center gap-1 text-sm font-display font-semibold text-brand">
        Guarda come funziona<ChevronRight size={16} aria-hidden />
      </Link>
    </Sezione>
  );

  // Serate tranquille (POSIZIONAMENTO.md, proposta 1): lo strumento gratuito contro i tavoli vuoti, prima dei posti in evidenza.
  const promozione = (
    <>
      <Sezione titolo="Serate tranquille" nota="I giorni in cui di solito hai posto. Chi ti ha salvato lo vede nella tua scheda: niente sconti, niente commissioni." piano="Verified" testId="pannello-serate">
        <SerateTranquille placeId={locale.id} iniziali={demo ? [2, 3] : serate.giorni} at={demo ? new Date().toISOString() : serate.at} verificato={verificato} demo={demo} />
      </Sezione>
      {evidenza}
    </>
  );

  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-4" data-testid="pannello-ristoratore">
      {demo && (
        <p data-testid="pannello-demo-etichetta" className="mb-3 rounded-pill border border-dashed border-accent bg-accent-light px-3 py-1.5 text-center text-xs font-sans text-text">
          <strong className="font-display">Esempio dimostrativo</strong> · locale e numeri inventati
        </p>
      )}
      <p className="text-[11px] font-display font-semibold uppercase tracking-wider text-accent">Pannello del ristoratore</p>
      <h1 className="mt-0.5 font-title text-[26px] font-semibold leading-tight text-brand">{locale.name}</h1>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-sans text-text-muted">
        {verificato ? (
          <span data-testid="pannello-verificato" className="inline-flex items-center gap-1 font-display font-semibold text-brand"><BadgeCheck size={14} aria-hidden />Verificato</span>
        ) : (
          <span className="font-display font-semibold">Non ancora verificato</span>
        )}
        {categoria && <span>· {categoria}</span>}
        {locale.address && <span className="inline-flex min-w-0 items-center gap-1"><MapPin size={12} aria-hidden /><span className="truncate">{displayAddress(locale.address)}</span></span>}
      </div>

      {avviso && <p className="mt-3 rounded-card bg-accent-light p-3 text-sm font-sans text-text">{avviso}</p>}
      {p.pochiDati && (
        <p data-testid="pannello-pochi-dati" className="mt-3 rounded-card bg-surface p-3 text-sm font-sans text-text">
          <strong className="font-display">Dati ancora pochi:</strong> crescono con i tester. Per proteggere chi usa Mapetite, sotto le {SOGLIA} persone scriviamo “meno di {SOGLIA}”.
        </p>
      )}

      <Schede
        iniziale={vista ?? VISTE[0]}
        periodi={PERIODI}
        giorni={p.giorni}
        base={base}
        schede={[
          { id: "panoramica", label: "Panoramica", content: panoramica },
          { id: "clienti", label: "Clienti", content: clienti },
          { id: "zona", label: "Zona", content: zona },
          { id: "promozione", label: "Promozione", content: promozione },
        ]}
      />

      <p className="mt-6 text-[11px] font-sans leading-relaxed text-text-muted">
        Solo numeri aggregati: non vedi mai chi è una persona. Sotto le {SOGLIA} persone scriviamo “meno di {SOGLIA}”. Le ricerche sono quello che l&apos;AI ha capito (tipo di locale, richieste, zona), mai la frase scritta.
      </p>
      {demo && (
        <p className="mt-4 text-center text-sm font-sans text-text-muted">
          Hai un locale? <Link href="/per-i-ristoratori/rivendica" className="font-semibold text-brand underline">Rivendicalo</Link> e vedrai i tuoi numeri veri.
        </p>
      )}
    </main>
  );
}
