import Link from "next/link";
import { BadgeCheck, MapPin } from "lucide-react";
import { categoryLabel } from "@/lib/category-label";
import { displayAddress } from "@/lib/city";
import { mostraPersone, SOGLIA, type PannelloRistoratore, type RistLocale, type Voce } from "@/lib/ristoratore";

// Pannello del ristoratore (piano 8.2): stessa grafica per i dati veri (/ristoratore/[id]) e per
// l'esempio dimostrativo (/ristoratore/demo). Solo numeri aggregati; le etichette dei piani
// (Verified, Growth, Pro) mostrano cosa entra in ciascuno (per il pitch, nessun pagamento).

export const PERIODI = [7, 30] as const;

const FASCIA_LABEL: Record<string, string> = {
  mattina: "Mattina", pranzo: "Pranzo", pomeriggio: "Pomeriggio", aperitivo: "Aperitivo", cena: "Cena", notte: "Notte",
};
const giornoBreve = (key: string) => new Date(`${key}T12:00:00Z`).toLocaleDateString("it-IT", { day: "numeric", month: "short", timeZone: "UTC" });
const fmt = (n: number) => n.toLocaleString("it-IT", { maximumFractionDigits: 1 });

function Piano({ nome }: { nome: "Verified" | "Growth" | "Pro" }) {
  const tone = nome === "Verified" ? "bg-brand/10 text-brand" : nome === "Growth" ? "bg-brand text-white" : "bg-accent text-white";
  return <span className={`rounded-pill px-2 py-0.5 text-[10px] font-display font-semibold uppercase tracking-wider ${tone}`}>{nome}</span>;
}

function Sezione({ titolo, nota, piano, children, testId }: { titolo: string; nota?: string; piano: "Verified" | "Growth" | "Pro"; children: React.ReactNode; testId?: string }) {
  return (
    <section data-testid={testId} className="mt-6 rounded-card border border-border bg-white p-4 shadow-card sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold text-brand">{titolo}</h2>
        <Piano nome={piano} />
      </div>
      {nota && <p className="mt-0.5 text-xs font-sans leading-snug text-text-muted">{nota}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

// Variazione rispetto al periodo precedente: solo se entrambi i numeri superano la soglia
// (una percentuale su 1 o 2 persone non vuol dire niente e le farebbe riconoscere).
function variazione(cur: number, prima: number): { testo: string; su: boolean } | null {
  if (cur < SOGLIA || prima < SOGLIA) return null;
  const d = Math.round(((cur - prima) / prima) * 100);
  return { testo: `${d > 0 ? "+" : ""}${d}%`, su: d >= 0 };
}

// Barre orizzontali: etichetta, barra e numero di persone (con la soglia).
function Barre({ voci, vuoto, max = 6, etichetta, testId }: { voci: Voce[]; vuoto: string; max?: number; etichetta?: (k: string) => string; testId?: string }) {
  const list = voci.filter((v) => v.persone > 0 || v.volte > 0).slice(0, max);
  if (list.length === 0) return <p className="text-sm font-sans text-text-muted">{vuoto}</p>;
  const top = Math.max(1, ...list.map((v) => v.persone));
  return (
    <ul data-testid={testId} className="space-y-2">
      {list.map((v) => (
        <li key={v.chiave} className="text-sm font-sans">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-text first-letter:uppercase">{etichetta ? etichetta(v.chiave) : v.chiave}</span>
            <span className="shrink-0 tabular-nums text-xs text-text-muted">{mostraPersone(v.persone)} persone</span>
          </div>
          <span className="mt-1 block h-2 overflow-hidden rounded-full bg-surface">
            <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.max(4, (v.persone / top) * 100)}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

// Colonne per fascia oraria: altezza proporzionale, numeri solo sopra la soglia.
function Fasce({ voci }: { voci: Voce[] }) {
  const top = Math.max(1, ...voci.map((v) => v.persone));
  return (
    <div data-testid="pannello-fasce" className="grid grid-cols-6 gap-1.5">
      {voci.map((v) => (
        <div key={v.chiave} className="flex flex-col items-center gap-1" title={`${FASCIA_LABEL[v.chiave] ?? v.chiave}: ${mostraPersone(v.persone)} persone`}>
          <div className="flex h-20 w-full items-end rounded-[6px] bg-surface">
            <div className="w-full rounded-[6px] bg-accent" style={{ height: `${v.persone > 0 ? Math.max(6, (v.persone / top) * 100) : 0}%` }} />
          </div>
          <span className="text-[10px] font-sans text-text-muted sm:text-xs">{FASCIA_LABEL[v.chiave] ?? v.chiave}</span>
        </div>
      ))}
    </div>
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
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-36 w-full" role="img" aria-label="Persone che hanno visto la scheda, giorno per giorno">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={0} x2={W} y1={PAD + f * (H - 2 * PAD)} y2={PAD + f * (H - 2 * PAD)} stroke="var(--color-border)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        <path d={area} fill="var(--color-brand)" opacity={0.12} />
        <path d={line} fill="none" stroke="var(--color-brand)" strokeWidth={2.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {g.map((d, i) => (
          <g key={d.giorno}>
            <title>{`${giornoBreve(d.giorno)}: ${mostraPersone(d.viste)} hanno visto la scheda, ${mostraPersone(d.salvati)} l'hanno salvato`}</title>
            <rect x={x(i) - W / g.length / 2} y={0} width={W / g.length} height={H} fill="transparent" />
            {d.salvati >= SOGLIA && <circle cx={x(i)} cy={y(d.viste)} r={3.5} fill="var(--color-accent)" />}
          </g>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] font-sans text-text-muted">
        <span>{giornoBreve(g[0].giorno)}</span>
        <span>oggi</span>
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-sans text-text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-brand" aria-hidden />Persone che hanno visto la scheda</span>
        {totSalvati >= SOGLIA && <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />Giorni con almeno {SOGLIA} salvataggi</span>}
      </p>
    </div>
  );
}

function Confronto({ p, categoria, citta }: { p: PannelloRistoratore; categoria: string | null; citta: string | null }) {
  const c = p.confronto;
  const dove = [categoria ? categoria.toLowerCase() : "locali", citta ? `a ${citta}` : null].filter(Boolean).join(" ");
  if (c.mediaViste === null || c.mediaSalvati === null) {
    return <p className="text-sm font-sans text-text-muted">Ancora pochi locali simili su Mapetite ({c.simili}) per un confronto che non riveli i numeri di un singolo locale. Servono almeno {SOGLIA} {dove}.</p>;
  }
  const righe = [
    { label: "Hanno visto la scheda", tuo: c.viste, media: c.mediaViste },
    { label: "L'hanno salvato", tuo: c.salvati, media: c.mediaSalvati },
  ];
  return (
    <div data-testid="pannello-confronto" className="space-y-4">
      <p className="text-xs font-sans text-text-muted">Media di {c.simili} {dove} su Mapetite, stesso periodo.</p>
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
                <span className="h-2.5 overflow-hidden rounded-full bg-surface"><span className="block h-full rounded-full bg-brand" style={{ width: `${(r.tuo / top) * 100}%` }} /></span>
                <span className="w-16 text-right tabular-nums text-text">{mostraPersone(r.tuo)}</span>
              </div>
              <div className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-2">
                <span className="text-text-muted">Media zona</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-surface"><span className="block h-full rounded-full bg-text-muted/50" style={{ width: `${(r.media / top) * 100}%` }} /></span>
                <span className="w-16 text-right tabular-nums text-text-muted">{fmt(r.media)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
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
}: {
  p: PannelloRistoratore;
  locale: RistLocale;
  citta: string | null;
  verificato: boolean;
  base: string;
  demo?: boolean;
  avviso?: string | null;
}) {
  const categoria = categoryLabel(locale.category);
  const viste = p.azioni.find((a) => a.tipo === "apri_scheda")!;
  const altre = p.azioni.filter((a) => a.tipo !== "apri_scheda");
  const varViste = variazione(viste.persone, viste.prima);
  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-6" data-testid="pannello-ristoratore">
      {demo && (
        <p data-testid="pannello-demo-etichetta" className="mb-4 rounded-card border-2 border-dashed border-accent bg-accent-light px-4 py-3 text-sm font-sans text-text">
          <strong className="font-display">Esempio dimostrativo.</strong> Locale e numeri sono inventati: mostrano come apparirà il pannello quando Mapetite avrà molti utenti.
        </p>
      )}
      <p className="text-[11px] font-display font-semibold uppercase tracking-wider text-accent">Pannello del ristoratore</p>
      <h1 className="mt-1 font-title text-3xl font-semibold leading-tight text-brand">{locale.name}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-sans text-text-muted">
        {verificato ? (
          <span data-testid="pannello-verificato" className="inline-flex items-center gap-1 rounded-pill bg-brand/10 px-2.5 py-0.5 text-xs font-display font-semibold text-brand"><BadgeCheck size={14} aria-hidden />Verificato</span>
        ) : (
          <span className="rounded-pill bg-surface px-2.5 py-0.5 text-xs font-display font-semibold text-text-muted">Non ancora verificato</span>
        )}
        {categoria && <span>{categoria}</span>}
        {locale.address && <span className="inline-flex items-center gap-1"><MapPin size={13} aria-hidden />{displayAddress(locale.address)}</span>}
      </div>

      <nav aria-label="Periodo" className="mt-4 flex gap-2">
        {PERIODI.map((g) => (
          <Link
            key={g}
            href={`${base}?giorni=${g}`}
            aria-current={g === p.giorni ? "page" : undefined}
            className={`min-h-9 rounded-pill border px-4 py-1.5 text-sm font-display font-semibold ${g === p.giorni ? "border-brand bg-brand text-white" : "border-border bg-white text-brand"}`}
          >
            Ultimi {g} giorni
          </Link>
        ))}
      </nav>

      {avviso && <p className="mt-4 rounded-card bg-accent-light p-3 text-sm font-sans text-text">{avviso}</p>}
      {p.pochiDati && (
        <p data-testid="pannello-pochi-dati" className="mt-4 rounded-card bg-surface p-3 text-sm font-sans text-text">
          <strong className="font-display">Dati ancora pochi:</strong> crescono con i tester. Per proteggere chi usa Mapetite, sotto le {SOGLIA} persone scriviamo “meno di {SOGLIA}”.
        </p>
      )}

      <Sezione titolo="Le persone e il tuo locale" nota={`Persone diverse negli ultimi ${p.giorni} giorni.`} piano="Verified" testId="pannello-azioni">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="col-span-2 rounded-card bg-brand p-4 text-white sm:col-span-1">
            <p className="text-xs font-sans text-white/80">{viste.etichetta}</p>
            <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{mostraPersone(viste.persone)}</p>
            <p className="mt-0.5 text-[11px] font-sans text-white/80">
              {varViste ? <><span className="font-semibold text-white">{varViste.testo}</span> rispetto ai {p.giorni} giorni prima</> : "persone"}
            </p>
          </div>
          {altre.map((a) => {
            const v = variazione(a.persone, a.prima);
            return (
              <div key={a.tipo} className="rounded-card border border-border bg-bg p-3">
                <p className="text-xs font-sans leading-snug text-text-muted">{a.etichetta}</p>
                <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-brand">{mostraPersone(a.persone)}</p>
                {v && <p className={`text-[11px] font-sans ${v.su ? "text-success" : "text-accent"}`}>{v.testo} sul periodo prima</p>}
              </div>
            );
          })}
        </div>
      </Sezione>

      <Sezione titolo="Giorno per giorno" piano="Verified">
        <Andamento p={p} />
      </Sezione>

      <Sezione
        titolo="Come ti trovano"
        nota={p.daRicerca.ricerche > 0 ? `Le ricerche da cui le persone hanno aperto la tua scheda (${mostraPersone(p.daRicerca.persone)} persone).` : undefined}
        piano="Growth"
        testId="pannello-come-ti-trovano"
      >
        {p.daRicerca.ricerche > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-display font-semibold uppercase tracking-wide text-text-muted">Cosa chiedevano</h3>
              <Barre voci={p.daRicerca.richieste} vuoto="Ricerche senza richieste particolari." testId="pannello-richieste-locale" />
            </div>
            <div>
              <h3 className="mb-2 text-xs font-display font-semibold uppercase tracking-wide text-text-muted">Che locale cercavano</h3>
              <Barre voci={p.daRicerca.tipi} vuoto="—" />
              <h3 className="mb-2 mt-4 text-xs font-display font-semibold uppercase tracking-wide text-text-muted">Dove</h3>
              <Barre voci={p.daRicerca.zone} vuoto="—" />
            </div>
          </div>
        ) : (
          <p className="text-sm font-sans text-text-muted">In questo periodo nessuno ha aperto la tua scheda dai risultati di una ricerca. Qui sotto: cosa cercano le persone nella tua zona.</p>
        )}
      </Sezione>

      <Sezione
        titolo={`Cosa cerca la gente${p.zona.nome ? ` a ${p.zona.nome}` : " nella tua zona"}`}
        nota={p.zona.ricerche > 0 ? `${mostraPersone(p.zona.persone)} persone hanno cercato nella tua zona.` : undefined}
        piano="Growth"
        testId="pannello-zona"
      >
        {p.zona.ricerche > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-display font-semibold uppercase tracking-wide text-text-muted">Le richieste più frequenti</h3>
              <Barre voci={p.zona.richieste} vuoto="Ricerche senza richieste particolari." testId="pannello-richieste-zona" />
            </div>
            <div>
              <h3 className="mb-2 text-xs font-display font-semibold uppercase tracking-wide text-text-muted">Che locale cercano</h3>
              <Barre voci={p.zona.tipi} vuoto="—" max={4} />
              <h3 className="mb-2 mt-4 text-xs font-display font-semibold uppercase tracking-wide text-text-muted">Quando cercano</h3>
              <Fasce voci={p.zona.fasce} />
            </div>
          </div>
        ) : (
          <p className="text-sm font-sans text-text-muted">Ancora nessuna ricerca nella tua zona in questo periodo.</p>
        )}
      </Sezione>

      <Sezione titolo="Confronto con la zona" piano="Pro" testId="pannello-confronto-sezione">
        <Confronto p={p} categoria={categoria} citta={citta} />
      </Sezione>

      <p className="mt-6 text-xs font-sans leading-relaxed text-text-muted">
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
