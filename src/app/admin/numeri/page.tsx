import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";
import { computeNumeri, etichettaFunzione, type Conteggio, type EventRow, type Numeri } from "@/lib/numeri";

// Pannello di Lorenzo (PIANO-25-OTTOBRE.md 7.5): i tester usano Mapetite? Tornano? Cosa usano?
// Solo per gli indirizzi in src/lib/admin.ts, per tutti gli altri 404. Legge `events` con la
// chiave di servizio, solo dal server: nessun dato passa dal telefono se non la pagina finita.
export const metadata: Metadata = { title: "Numeri — Mapetite", robots: { index: false, follow: false } };

const PERIODI = [1, 7, 30] as const;
const PAGE = 1000;
const MAX_ROWS = 50_000;

// Solo in sviluppo con E2E_FAKE_USER: accesso ed eventi finti dal cookie "e2e_eventi"
// (scritto da scripts/e2e/giro.mjs), perché il giro non può leggere il database.
async function e2eRows(): Promise<EventRow[] | null> {
  if (process.env.NODE_ENV !== "development" || !process.env.E2E_FAKE_USER) return null;
  const raw = (await cookies()).get("e2e_eventi")?.value;
  if (!raw) return null;
  try {
    const v = JSON.parse(decodeURIComponent(raw));
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

// Tutti gli eventi (servono anche i vecchi per sapere chi è nuovo). A pagine da 1000 righe,
// il massimo che Supabase restituisce per volta. Senza la colonna session_id (migrazione
// 20261015 non applicata) si rilegge senza.
async function loadRows(): Promise<{ rows: EventRow[]; troncato: boolean; errore: string | null }> {
  const db = createAdminClient();
  let cols = "created_at,type,user_id,anon_id,session_id,props";
  const rows: EventRow[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await db.from("events").select(cols).order("id", { ascending: true }).range(from, from + PAGE - 1);
    if (error) {
      if (cols.includes("session_id") && from === 0 && /session_id/.test(error.message)) {
        cols = "created_at,type,user_id,anon_id,props";
        from -= PAGE;
        continue;
      }
      return { rows, troncato: false, errore: error.code === "42P01" || error.code === "PGRST205" ? "La tabella events non esiste ancora." : `Lettura non riuscita (${error.code}).` };
    }
    rows.push(...((data ?? []) as unknown as EventRow[]));
    if (!data || data.length < PAGE) return { rows, troncato: false, errore: null };
  }
  return { rows, troncato: true, errore: null };
}

// Email dei registrati, per riconoscere i tester nella tabella.
async function loadEmails(): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  try {
    const { data } = await createAdminClient().auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of data?.users ?? []) if (u.email) m.set(u.id, u.email);
  } catch {
    // senza email si mostrano gli id abbreviati
  }
  return m;
}

const fmt = (n: number | null, suffix = "") => (n === null ? "—" : `${n.toLocaleString("it-IT")}${suffix}`);
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");
const quando = (iso: string) => new Date(iso).toLocaleString("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const giornoBreve = (key: string) => new Date(`${key}T12:00:00Z`).toLocaleDateString("it-IT", { day: "numeric", month: "short", timeZone: "UTC" });
const etichetta = etichettaFunzione;
// Funzioni con eventi dedicati, raggruppate (anche quelle mai usate, a 0).
const GRUPPI = [
  { titolo: "Assistente", prefissi: ["assistente_"] },
  { titolo: "Prenotazioni", prefissi: ["prenota_"] },
  { titolo: "Raccolte", prefissi: ["raccolta_", "raccolte_"] },
];

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-card border border-border bg-white p-3">
      <p className="text-xs font-sans text-text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold text-brand tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] font-sans leading-snug text-text-muted">{hint}</p>}
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-base font-semibold text-brand">{title}</h2>
      {note && <p className="mt-0.5 text-xs font-sans text-text-muted">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

// Barre orizzontali con il numero accanto: si leggono sul telefono senza assi né legende.
function Bars({ items, max: maxProp, empty, testId }: { items: Conteggio[]; max?: number; empty: string; testId?: string }) {
  if (items.length === 0) return <p className="text-sm font-sans text-text-muted">{empty}</p>;
  const max = maxProp ?? Math.max(1, ...items.map((i) => i.volte));
  return (
    <ul data-testid={testId} className="space-y-1.5">
      {items.map((i) => (
        <li key={i.chiave} title={`${i.volte} volte, ${i.persone} persone`} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 text-sm font-sans">
          <span className={`truncate ${i.volte === 0 ? "text-text-muted" : "text-text"}`}>{etichetta(i.chiave)}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-surface">
            <span className="block h-full rounded-full bg-brand" style={{ width: `${(i.volte / max) * 100}%` }} />
          </span>
          <span className="w-16 text-right tabular-nums text-text-muted">
            <span className="font-semibold text-text">{i.volte}</span>{i.persone > 0 && <> · {i.persone}👤</>}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Pannello({ n, troncato }: { n: Numeri; troncato: boolean }) {
  const maxGiorno = Math.max(1, ...n.perGiorno.map((g) => g.attivi));
  const usate = n.funzioni.filter((f) => f.volte > 0);
  const maiUsate = n.funzioni.filter((f) => f.volte === 0);
  const votiUtile = n.utile.si + n.utile.no;
  return (
    <>
      {n.senzaTracciamento && (
        <p data-testid="numeri-migrazione" className="mt-4 rounded-card bg-accent-light p-3 text-sm font-sans text-text">
          Nessuna visita, pagina o errore registrati finora: se dura più di un giorno, va applicata la migrazione <code>20261015_events_tracking.sql</code>.
        </p>
      )}
      {troncato && <p className="mt-4 text-xs font-sans text-text-muted">Letti solo i primi 50.000 eventi: i numeri più vecchi possono mancare.</p>}

      <Section title="Chi usa Mapetite">
        <div data-testid="numeri-riepilogo" className="grid grid-cols-2 gap-2">
          <Tile label="Persone attive" value={fmt(n.attivi.totale)} hint={`${n.attivi.registrati} registrati · ${n.attivi.anonimi} senza accesso`} />
          <Tile label="Nuove" value={fmt(n.nuovi)} hint="prima volta in questo periodo" />
          <Tile label="Visite a testa" value={fmt(n.sessioni.perUtente)} hint={`${n.sessioni.totale} visite in tutto`} />
          <Tile label="Durata tipica" value={fmt(n.sessioni.durataMediana, " min")} hint="mediana delle visite" />
          <Tile label="Ricerche" value={fmt(n.ricerche.totale)} hint={`${fmt(n.ricerche.perUtente)} a testa · ${n.ricerche.senzaRisultati} senza risultati`} />
          <Tile label="Salvati a testa" value={fmt(n.salvataggi.perUtente)} hint={`${n.salvataggi.totale} salvataggi`} />
        </div>
      </Section>

      <Section title="Tornano?" note="Tra chi è arrivato per la prima volta in questo periodo: quanti sono tornati dopo 1, 3, 7 giorni.">
        <div data-testid="numeri-ritorni" className="grid grid-cols-3 gap-2">
          {n.ritorni.map((r) => (
            <Tile key={r.giorni} label={`Dopo ${r.giorni} ${r.giorni === 1 ? "giorno" : "giorni"}`} value={pct(r.tornati, r.base)} hint={r.base > 0 ? `${r.tornati} su ${r.base}` : "ancora presto"} />
          ))}
        </div>
      </Section>

      {n.perGiorno.length > 1 && (
        <Section title="Giorno per giorno" note="Persone attive al giorno (tocca una barra per i dettagli).">
          <div className="flex h-28 items-end gap-[2px]" role="img" aria-label="Persone attive per giorno">
            {n.perGiorno.map((g) => (
              <div key={g.giorno} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${giornoBreve(g.giorno)}: ${g.attivi} persone, ${g.sessioni} visite, ${g.ricerche} ricerche, ${g.salvataggi} salvataggi`}>
                <div className="rounded-t-[4px] bg-brand" style={{ height: `${Math.max(g.attivi > 0 ? 4 : 0, (g.attivi / maxGiorno) * 100)}%` }} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[11px] font-sans text-text-muted">
            <span>{giornoBreve(n.perGiorno[0].giorno)}</span>
            <span>oggi</span>
          </div>
          <details className="mt-2 text-sm font-sans">
            <summary className="cursor-pointer text-xs text-text-muted">Vedi la tabella</summary>
            <table className="mt-2 w-full text-left text-xs tabular-nums">
              <thead className="text-text-muted"><tr><th className="py-1 font-normal">Giorno</th><th className="font-normal">Persone</th><th className="font-normal">Visite</th><th className="font-normal">Ricerche</th><th className="font-normal">Salvati</th></tr></thead>
              <tbody>
                {[...n.perGiorno].reverse().map((g) => (
                  <tr key={g.giorno} className="border-t border-border"><td className="py-1">{giornoBreve(g.giorno)}</td><td>{g.attivi}</td><td>{g.sessioni}</td><td>{g.ricerche}</td><td>{g.salvataggi}</td></tr>
                ))}
              </tbody>
            </table>
          </details>
        </Section>
      )}

      <Section title="Dalla ricerca all'azione" note="Volte e persone; la percentuale è sul passo precedente (persone).">
        <ol data-testid="numeri-imbuto" className="space-y-2">
          {n.imbuto.map((s, i) => {
            const base = n.imbuto[0].volte || 1;
            return (
              <li key={s.passo} className="rounded-card border border-border bg-white p-3">
                <div className="flex items-baseline justify-between gap-2 text-sm font-sans">
                  <span className="text-text">{s.passo}</span>
                  <span className="tabular-nums text-text-muted">
                    <span className="font-semibold text-text">{s.volte}</span> · {s.persone}👤{i > 0 && <> · {pct(s.persone, n.imbuto[i - 1].persone)}</>}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (s.volte / base) * 100)}%` }} />
                </div>
              </li>
            );
          })}
        </ol>
      </Section>

      <Section title="Funzioni più usate" note="Volte · persone diverse.">
        <Bars testId="numeri-funzioni" items={usate} empty="Nessuna funzione usata in questo periodo." />
        {maiUsate.length > 0 && (
          <p className="mt-3 text-xs font-sans text-text-muted">
            <span className="font-semibold">Mai usate:</span> {maiUsate.map((f) => etichetta(f.chiave)).join(", ")}
          </p>
        )}
      </Section>

      <Section title="Assistente, prenotazioni e raccolte" note="Le stesse funzioni, raggruppate. Volte · persone diverse.">
        <div data-testid="numeri-dedicate" className="space-y-4">
          {GRUPPI.map((g) => {
            const voci = n.funzioni.filter((f) => g.prefissi.some((x) => f.chiave.startsWith(x)));
            const max = Math.max(1, ...voci.map((v) => v.volte));
            return (
              <div key={g.titolo}>
                <h3 className="mb-1.5 text-xs font-display font-semibold uppercase tracking-wide text-text-muted">{g.titolo}</h3>
                <Bars items={voci} max={max} empty="Nessun dato." />
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Ti è stato utile?">
        <div data-testid="numeri-utile" className="grid grid-cols-3 gap-2">
          <Tile label="👍 Sì" value={fmt(n.utile.si)} />
          <Tile label="👎 No" value={fmt(n.utile.no)} />
          <Tile label="Soddisfatti" value={pct(n.utile.si, votiUtile)} hint={votiUtile > 0 ? `su ${votiUtile} voti` : "nessun voto"} />
        </div>
      </Section>

      <Section title="Cosa cercano" note={`${n.ricerche.ai} con l'AI · ${n.ricerche.filtri} con i filtri`}>
        <h3 className="mb-2 text-xs font-display font-semibold uppercase tracking-wide text-text-muted">Tipo di locale</h3>
        <Bars items={n.ricerchePerTipo.slice(0, 8)} empty="Nessuna ricerca." />
        <h3 className="mb-2 mt-4 text-xs font-display font-semibold uppercase tracking-wide text-text-muted">Zona</h3>
        <Bars items={n.ricerchePerZona.slice(0, 8)} empty="Nessuna ricerca." />
        {n.requisiti.length > 0 && (
          <>
            <h3 className="mb-2 mt-4 text-xs font-display font-semibold uppercase tracking-wide text-text-muted">Richieste</h3>
            <Bars items={n.requisiti.slice(0, 8)} empty="" />
          </>
        )}
      </Section>

      <Section title="Pagine viste">
        <Bars items={n.pagine} empty="Nessuna pagina registrata." />
      </Section>

      <Section title="Errori sul telefono" note="I più frequenti, con la pagina in cui succedono.">
        {n.errori.length === 0 ? (
          <p data-testid="numeri-errori" className="text-sm font-sans text-text-muted">Nessun errore registrato. 🎉</p>
        ) : (
          <ul data-testid="numeri-errori" className="space-y-2">
            {n.errori.slice(0, 10).map((e) => (
              <li key={`${e.pagina}|${e.messaggio}`} className="rounded-card border border-border bg-white p-3 text-sm font-sans">
                <p className="break-words font-mono text-xs text-error">{e.messaggio}</p>
                <p className="mt-1 text-xs text-text-muted">
                  {etichetta(e.pagina)} · {e.volte} {e.volte === 1 ? "volta" : "volte"} · {e.persone}👤 · ultima {quando(e.ultima)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Tester" note="Chi ha usato l'app in questo periodo, dal più recente.">
        {n.tester.length === 0 ? (
          <p className="text-sm font-sans text-text-muted">Nessuno.</p>
        ) : (
          <ul data-testid="numeri-tester" className="divide-y divide-border rounded-card border border-border bg-white">
            {n.tester.slice(0, 50).map((t) => (
              <li key={`${t.chi}|${t.prima}`} className="p-3 text-sm font-sans">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`truncate ${t.registrato ? "font-semibold text-text" : "text-text-muted"}`}>{t.chi}</span>
                  <span className="shrink-0 text-xs text-text-muted">{quando(t.ultima)}</span>
                </div>
                <p className="mt-0.5 text-xs tabular-nums text-text-muted">
                  dal {giornoBreve(t.prima)} · {t.giorniAttivi} {t.giorniAttivi === 1 ? "giorno" : "giorni"} · {t.sessioni} visite · {t.ricerche} ricerche · {t.salvati} salvati{t.errori > 0 && <span className="text-error"> · {t.errori} errori</span>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

export default async function NumeriPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const fake = await e2eRows();
  if (!fake) {
    const { data } = await getUser();
    if (!isAdminEmail(data?.user?.email)) notFound();
  }

  const sp = await searchParams;
  const giorni = PERIODI.find((p) => String(p) === sp.giorni) ?? 7;
  const [{ rows, troncato, errore }, emails] = fake
    ? [{ rows: fake, troncato: false, errore: null }, new Map<string, string>()]
    : await Promise.all([loadRows(), loadEmails()]);
  const n = computeNumeri(rows, giorni, undefined, emails);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-12 pt-6">
      <h1 className="font-title text-2xl font-semibold text-brand">Numeri dei tester</h1>
      <p className="mt-1 text-sm font-sans text-text-muted">Solo per te. Aggiornati a ogni apertura della pagina.</p>

      <nav aria-label="Periodo" className="mt-4 flex gap-2">
        {PERIODI.map((p) => (
          <Link
            key={p}
            href={`/admin/numeri?giorni=${p}`}
            aria-current={p === giorni ? "page" : undefined}
            className={`min-h-9 rounded-pill border px-4 py-1.5 text-sm font-display font-semibold ${p === giorni ? "border-brand bg-brand text-white" : "border-border bg-white text-brand"}`}
          >
            {p === 1 ? "Oggi" : `${p} giorni`}
          </Link>
        ))}
      </nav>

      {errore ? (
        <p className="mt-8 rounded-card bg-accent-light p-4 text-sm font-sans text-text">{errore}</p>
      ) : rows.length === 0 ? (
        <div data-testid="numeri-vuoto" className="mt-10 rounded-card border border-dashed border-border p-6 text-center">
          <p className="text-4xl" aria-hidden>📭</p>
          <p className="mt-3 font-display text-base font-semibold text-brand">Ancora nessun dato</p>
          <p className="mt-1 text-sm font-sans text-text-muted">Quando i tester apriranno l&apos;app, qui compariranno visite, ricerche, salvataggi ed errori.</p>
        </div>
      ) : (
        <Pannello n={n} troncato={troncato} />
      )}
    </main>
  );
}
