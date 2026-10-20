"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { completeOnboarding, skipOnboarding } from "./actions";
import { CUISINES, OCCASIONS, ATMOSPHERES, PRICE_RANGES } from "@/lib/preferences";
import { DIETE, SCOPERTE, TIPI, capito, dieteValide, pulisciMappa, scopertaDedotta, type Scoperta } from "@/lib/mappa-gusto";
import { ZONE } from "@/lib/gusti";
import { trackFeature } from "@/lib/track";
import { cityArea } from "@/lib/named-city";
import { saveLastView } from "@/lib/last-view";
import { clearStoredInvite, readStoredInvite } from "@/lib/invito";

// Risposte in corso, conservate sul telefono (decisione 13b del backlog): se al salvataggio
// l'accesso è scaduto si passa dal login e, tornati qui, le risposte sono ancora tutte al loro
// posto. Valgono 2 giorni; si cancellano quando il salvataggio parte o con "Salta".
const DRAFT_KEY = "mapetite.benvenuto";
const DRAFT_TTL_MS = 2 * 24 * 60 * 60 * 1000;

interface Draft {
  step: number;
  cuisines: string[];
  occasions: string[];
  atmospheres: string[];
  priceRange: string | null;
  city: string | null;
  otherCity: string;
  otherOpen: boolean;
  zone: string[];
  su: string[];
  giu: string[];
  visti: string[];
  scoperta: Scoperta | null;
  diete: string[];
}

function readDraftRaw(): string | null {
  try {
    return localStorage.getItem(DRAFT_KEY);
  } catch {
    return null;
  }
}

function saveDraft(d: Draft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...d, ts: Date.now() }));
  } catch { /* archiviazione non disponibile: si va avanti senza */ }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch { /* niente da fare */ }
}

const vuota = (d: Draft) => d.step === 0 && !d.city && !d.otherOpen && !d.zone.length && !d.visti.length && !d.occasions.length && !d.priceRange && !d.diete.length;

// Solo valori che l'onboarding conosce: il contenuto del telefono si ricontrolla come un input.
function parseDraft(raw: string | null): Draft | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object" || typeof o.ts !== "number" || Date.now() - o.ts > DRAFT_TTL_MS) return null;
    const pick = (v: unknown, allowed: readonly { value: string }[]) =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && allowed.some((a) => a.value === x)) : [];
    const city = CITIES.some((c) => c.value === o.city) ? o.city : null;
    const m = pulisciMappa(o, (z) => ZONE.some((x) => x.nome === z && x.citta === city));
    const d: Draft = {
      step: Number.isInteger(o.step) ? Math.min(Math.max(o.step, 0), TOTAL - 1) : 0,
      cuisines: pick(o.cuisines, CUISINES),
      occasions: pick(o.occasions, OCCASIONS),
      atmospheres: pick(o.atmospheres, ATMOSPHERES),
      priceRange: PRICE_RANGES.some((p) => p.value === o.priceRange) ? o.priceRange : null,
      city,
      otherCity: typeof o.otherCity === "string" ? o.otherCity.slice(0, 40) : "",
      otherOpen: o.otherOpen === true,
      zone: m.zone,
      su: m.su,
      giu: m.giu,
      visti: Array.isArray(o.visti) ? o.visti.filter((x: unknown): x is string => typeof x === "string" && TIPI.some((t) => t.id === x)) : [...m.su, ...m.giu],
      scoperta: m.scoperta,
      diete: dieteValide(o.diete),
    };
    return vuota(d) ? null : d;
  } catch {
    return null;
  }
}

// Primo accesso dopo la registrazione: la "mappa del gusto" (sprint 25/10, LORENZO.md).
// 1) città e zone, 2) dieci tipi di posto 👍/👎, 3) occasioni, spesa, diete, famosi o chicche,
// 4) "porta qui i tuoi posti" (Google Maps o il link di un reel), 5) "Ecco cosa ho capito di te"
// e subito i posti per te. Tutto saltabile: chi vuole provare subito l'app non deve rispondere.

const STEPS = [
  { kicker: "DOVE ESCI", title: "Dove esci di solito?", subtitle: "Città e zone: i consigli partono da lì." },
  { kicker: "I TUOI GUSTI", title: "Ti piace o no?", subtitle: "Dieci tipi di posto. Rispondi d'istinto." },
  { kicker: "COME ESCI", title: "Famosi o chicche?", subtitle: "E cosa eviti: lo terrò sempre presente." },
  { kicker: "IL TUO PROFILO", title: "Ecco cosa ho capito", subtitle: "Tocca una riga per cambiarla." },
] as const;
const TOTAL = STEPS.length;
const PASSO_TIPI = 1;
const PASSO_COME = 2;
const PASSO_CAPITO = 3;

const CITIES = [
  { value: "Roma", emoji: "🏛️" },
  { value: "Milano", emoji: "🏙️" },
];

function toggle(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

function Chip({
  item,
  selected,
  onToggle,
}: {
  item: { value: string; label: string; emoji: string };
  selected: boolean;
  onToggle: (value: string) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onToggle(item.value)}
      className={[
        "inline-flex min-h-10 items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-sm font-display font-semibold transition-colors",
        selected ? "bg-brand text-white" : "border border-border bg-surface text-brand hover:border-brand",
      ].join(" ")}
    >
      <span aria-hidden>{item.emoji}</span>
      <span>{item.label}</span>
    </button>
  );
}

function Gruppo({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="mb-2.5 text-xs font-display font-semibold uppercase tracking-wide text-text-muted">{title}</h2>
      {children}
    </div>
  );
}

// Le risposte salvate sul telefono si leggono dopo l'idratazione (sul server non ci sono):
// con una bozza il modulo riparte da lì, senza effetti che rimettono a posto lo stato.
const noSubscribe = () => () => {};
// Risposte già salvate nel profilo (per "Rifalla"): servono da punto di partenza, mai come bozza.
export type DalProfilo = { city: string | null; occasions: string[]; priceRange: string | null; zone: string[]; su: string[]; giu: string[]; scoperta: Scoperta | null; diete: string[] };

export default function OnboardingView({ next = null, dalProfilo = null }: { next?: string | null; dalProfilo?: DalProfilo | null }) {
  const raw = useSyncExternalStore(noSubscribe, readDraftRaw, () => null);
  const draft = parseDraft(raw);
  const base: Draft | null = dalProfilo
    ? {
        step: 0, cuisines: [], atmospheres: [],
        otherCity: dalProfilo.city && !CITIES.some((c) => c.value === dalProfilo.city) ? dalProfilo.city : "",
        city: CITIES.some((c) => c.value === dalProfilo.city) ? dalProfilo.city : null,
        otherOpen: !!dalProfilo.city && !CITIES.some((c) => c.value === dalProfilo.city),
        occasions: dalProfilo.occasions.filter((o) => OCCASIONS.some((x) => x.value === o)),
        priceRange: PRICE_RANGES.some((x) => x.value === dalProfilo.priceRange) ? dalProfilo.priceRange : null,
        zone: dalProfilo.zone, su: dalProfilo.su, giu: dalProfilo.giu, visti: [...dalProfilo.su, ...dalProfilo.giu],
        scoperta: dalProfilo.scoperta, diete: dalProfilo.diete,
      }
    : null;
  return <Benvenuto key={draft ? "ripreso" : "nuovo"} next={next} initial={draft ?? base} ripreso={draft != null} />;
}

function Benvenuto({ next, initial, ripreso }: { next: string | null; initial: Draft | null; ripreso: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(initial?.step ?? 0);
  const cuisines = initial?.cuisines ?? [];
  const atmospheres = initial?.atmospheres ?? [];
  const [occasions, setOccasions] = useState<string[]>(initial?.occasions ?? []);
  const [priceRange, setPriceRange] = useState<string | null>(initial?.priceRange ?? null);
  const [city, setCity] = useState<string | null>(initial?.city ?? null);
  const [otherCity, setOtherCity] = useState(initial?.otherCity ?? "");
  const [otherOpen, setOtherOpen] = useState(initial?.otherOpen ?? false);
  const [zone, setZone] = useState<string[]>(initial?.zone ?? []);
  const [su, setSu] = useState<string[]>(initial?.su ?? []);
  const [giu, setGiu] = useState<string[]>(initial?.giu ?? []);
  const [visti, setVisti] = useState<string[]>(initial?.visti ?? []);
  const [scoperta, setScoperta] = useState<Scoperta | null>(initial?.scoperta ?? null);
  const [diete, setDiete] = useState<string[]>(initial?.diete ?? []);
  // Diete mandate solo se la persona è passata da "Come esci": saltandolo restano quelle di prima.
  const [vistoCome, setVistoCome] = useState((initial?.step ?? 0) >= PASSO_COME);
  const [submitting, setSubmitting] = useState<"importa" | "mappa" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Ogni risposta si conserva subito sul telefono (vedi DRAFT_KEY). La prima schermata ancora
  // vuota non lascia niente: chi apre e chiude l'onboarding non si ritrova una bozza vuota.
  const draftNow: Draft = { step, cuisines, occasions, atmospheres, priceRange, city, otherCity, otherOpen, zone, su, giu, visti, scoperta, diete };
  const draftJson = JSON.stringify(draftNow);
  useEffect(() => {
    const d = JSON.parse(draftJson) as Draft;
    if (vuota(d)) return;
    saveDraft(d);
  }, [draftJson]);

  // Ogni schermata parte dall'alto (prima restava lo scorrimento della precedente: titolo tagliato).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);
  // Arrivati a "Come esci" una volta, le diete contano (aggiornamento durante il render, non in un effetto).
  if (step >= PASSO_COME && !vistoCome) setVistoCome(true);

  // Arrivato da un link d'invito: la registrazione è fatta, il pannello lo conta una volta.
  useEffect(() => {
    const codice = readStoredInvite();
    if (!codice) return;
    trackFeature("invito_registrato", { contesto: codice });
    clearStoredInvite();
  }, []);

  const progress = ((step + 1) / TOTAL) * 100;
  const config = STEPS[step];
  const chosenCity = otherOpen ? otherCity.trim() || null : city;
  const zoneCitta = !otherOpen && city ? ZONE.filter((z) => z.citta === city) : [];
  const dedotta = scopertaDedotta(su);
  const scopertaOra = scoperta ?? dedotta;
  // Il tipo di posto da valutare adesso (il primo non ancora visto).
  const corrente = TIPI.find((t) => !visti.includes(t.id)) ?? null;
  const gusto = { v: 1 as const, zone, su, giu, scoperta };

  const vota = (id: string, voto: "su" | "giu" | "boh") => {
    setSu((p) => (voto === "su" ? [...p.filter((x) => x !== id), id] : p.filter((x) => x !== id)));
    setGiu((p) => (voto === "giu" ? [...p.filter((x) => x !== id), id] : p.filter((x) => x !== id)));
    const dopo = [...visti.filter((x) => x !== id), id];
    setVisti(dopo);
    // Finiti i dieci: si passa da soli alla schermata dopo.
    if (dopo.length >= TIPI.length) setTimeout(() => setStep(PASSO_COME), 250);
  };
  const annullaUltimo = () => {
    const ultimo = visti[visti.length - 1];
    if (!ultimo) return;
    setVisti((p) => p.slice(0, -1));
    setSu((p) => p.filter((x) => x !== ultimo));
    setGiu((p) => p.filter((x) => x !== ultimo));
  };

  const finish = async (dest: "importa" | null) => {
    setSubmitting(dest ?? "mappa");
    setError(null);
    trackFeature(dest === "importa" ? "benvenuto_importa" : "benvenuto_fine", { contesto: `passo_${step + 1}`, tipi: visti.length, chicche: scopertaOra ?? "nessuna" });
    // La bozza si toglie prima: se il salvataggio va a buon fine il server porta altrove e qui
    // non si torna. Se non va (accesso scaduto, rete), si rimette com'era.
    clearDraft();
    // La città scelta diventa il punto di partenza di mappa, assistente e Sorprendimi su questo
    // telefono, anche senza gusti scelti o passando da Importa (18/10: un tester di Milano partiva da Roma).
    const area = chosenCity ? cityArea(chosenCity) : null;
    if (area) saveLastView({ lat: area.lat, lng: area.lng, zoom: 12 });
    let result: Awaited<ReturnType<typeof completeOnboarding>>;
    try {
      result = await completeOnboarding({ cuisines, occasions, atmospheres, priceRange, city: chosenCity, dest, next, gusto, diete: vistoCome ? diete : undefined });
    } catch (err) {
      // Il rimando di Next dopo il salvataggio passa di qui come errore: va lasciato andare.
      if (err && typeof err === "object" && "digest" in err && String((err as { digest: unknown }).digest).startsWith("NEXT_")) throw err;
      // Rete caduta (succede in metro): la bozza torna e il pulsante si sblocca.
      saveDraft(draftNow);
      setError("Non sono riuscito a salvare: controlla la connessione e riprova.");
      setSubmitting(null);
      return;
    }
    if (result && "login" in result) {
      saveDraft(draftNow);
      router.push(result.login);
      return;
    }
    if (result?.error) {
      saveDraft(draftNow);
      setError(result.error);
      setSubmitting(null);
    }
  };

  // "Salta" dalla seconda schermata in poi: si salta solo quella, le risposte date restano.
  const skipStep = () => setStep((s) => Math.min(s + 1, TOTAL - 1));

  const saltaCls = "-mr-2 min-h-11 inline-flex items-center px-2 text-sm font-display font-semibold text-text-muted underline-offset-2 hover:underline";
  const righe = capito(gusto, {
    citta: chosenCity,
    priceRange,
    diete,
    occasions: OCCASIONS.filter((o) => occasions.includes(o.value)),
  });
  const PASSO_DI: Record<string, number> = { zone: 0, su: PASSO_TIPI, giu: PASSO_TIPI, scoperta: PASSO_COME, occasioni: PASSO_COME, spesa: PASSO_COME, diete: PASSO_COME };
  // Scorrimento col dito sulla card (come Beli e Tinder): a destra 👍, a sinistra 👎.
  const [drag, setDrag] = useState<{ x0: number; dx: number } | null>(null);

  return (
    <div className="flex min-h-screen flex-col bg-bg" data-testid="benvenuto" data-passo={step + 1}>
      {/* Barra di avanzamento */}
      <div className="sticky top-0 z-10 bg-bg px-6 pb-3 pt-5">
        <div className="mx-auto max-w-lg">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
              aria-label="Indietro"
              className="-ml-2 flex min-h-11 min-w-11 items-center justify-center text-brand disabled:opacity-0"
            >
              <ArrowLeft size={22} aria-hidden />
            </button>
            <span className="text-xs font-sans text-text-muted" data-testid="benvenuto-passo">
              {step + 1} di {TOTAL}
            </span>
            {/* Prima schermata: "Salta" salta tutto (i gusti si danno dopo in "I tuoi gusti").
                Dalla seconda: salta solo quella schermata. Le ultime due hanno già il loro
                "Lo faccio dopo" / "Mostrami": niente doppioni in alto, lo spazio resta. */}
            {step >= PASSO_CAPITO ? (
              <span aria-hidden className="-mr-2 min-h-11 w-12" />
            ) : step === 0 ? (
              <form action={skipOnboarding}>
                {next && <input type="hidden" name="next" value={next} />}
                <button type="submit" data-testid="onboarding-salta" onClick={clearDraft} className={saltaCls}>
                  Salta
                </button>
              </form>
            ) : (
              <button type="button" data-testid="onboarding-salta" onClick={skipStep} disabled={!!submitting} className={saltaCls}>
                Salta
              </button>
            )}
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-pill bg-accent-light"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={TOTAL}
            aria-valuenow={step + 1}
            aria-label="Avanzamento"
          >
            <div className="h-full rounded-pill bg-accent transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* Contenuto */}
      <div className="mx-auto w-full max-w-lg flex-1 px-6 pb-56 pt-4">
        <p className="mb-2 text-xs font-display font-semibold tracking-widest text-accent">{config.kicker}</p>
        <h1 className="mb-1 font-title text-[1.75rem] font-semibold leading-tight text-brand">{config.title}</h1>
        <p className="mb-6 text-sm font-sans text-text-muted">{config.subtitle}</p>
        {ripreso && (
          <p data-testid="benvenuto-ripreso" role="status" className="-mt-3 mb-5 rounded-btn bg-accent-light px-3 py-2 text-sm font-sans text-brand">
            Ho ritrovato le risposte che avevi già dato: puoi continuare da qui.
          </p>
        )}

        {step === 0 && (
          <div className="flex flex-col gap-3" data-testid="benvenuto-citta">
            {CITIES.map((c) => {
              const on = !otherOpen && city === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setOtherOpen(false);
                    setCity(on ? null : c.value);
                    setZone([]);
                  }}
                  className={[
                    "flex min-h-16 w-full items-center gap-4 rounded-card border-2 px-4 text-left transition-colors",
                    on ? "border-accent bg-accent-light" : "border-border bg-surface",
                  ].join(" ")}
                >
                  <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl shadow-card">{c.emoji}</span>
                  <span className="flex-1 font-display text-lg font-semibold text-brand">{c.value}</span>
                  {on && <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">✓</span>}
                </button>
              );
            })}
            <div
              className={[
                "rounded-card border-2 px-4 py-3 transition-colors",
                otherOpen ? "border-accent bg-accent-light" : "border-border bg-surface",
              ].join(" ")}
            >
              <button
                type="button"
                aria-pressed={otherOpen}
                onClick={() => { setOtherOpen((o) => !o); setZone([]); }}
                className="flex min-h-10 w-full items-center gap-4 text-left"
              >
                <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl shadow-card">📍</span>
                <span className="flex-1 font-display text-lg font-semibold text-brand">Un&apos;altra città</span>
              </button>
              {otherOpen && (
                <input
                  autoFocus
                  value={otherCity}
                  onChange={(e) => setOtherCity(e.target.value)}
                  maxLength={40}
                  placeholder="es. Torino"
                  aria-label="La tua città"
                  data-testid="benvenuto-altra-citta"
                  className="mt-3 w-full rounded-btn border border-border bg-white px-3 py-2.5 text-base focus:border-brand focus:outline-none"
                />
              )}
            </div>
            {zoneCitta.length > 0 && (
              <div data-testid="benvenuto-zone" className="rounded-card bg-surface px-4 py-3">
                <p className="mb-2 text-xs font-display font-semibold uppercase tracking-wide text-text-muted">Le tue zone (fino a 3)</p>
                <div className="flex flex-wrap gap-2">
                  {zoneCitta.map((z) => (
                    <Chip
                      key={z.nome}
                      item={{ value: z.nome, label: z.nome, emoji: "📍" }}
                      selected={zone.includes(z.nome)}
                      onToggle={(v) => setZone((p) => (p.includes(v) ? p.filter((x) => x !== v) : p.length >= 3 ? p : [...p, v]))}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === PASSO_TIPI && (
          <div data-testid="benvenuto-tipi">
            {corrente ? (
              <>
                <p data-testid="tipi-contatore" className="mb-2 text-xs font-sans text-text-muted">{visti.length + 1} di {TIPI.length}</p>
                <div
                  data-testid="tipo-card"
                  key={corrente.id}
                  onPointerDown={(e) => setDrag({ x0: e.clientX, dx: 0 })}
                  onPointerMove={(e) => drag && setDrag({ ...drag, dx: e.clientX - drag.x0 })}
                  onPointerUp={() => {
                    if (drag && Math.abs(drag.dx) > 90) vota(corrente.id, drag.dx > 0 ? "su" : "giu");
                    setDrag(null);
                  }}
                  onPointerCancel={() => setDrag(null)}
                  className="relative flex min-h-[20rem] touch-pan-y select-none flex-col justify-end overflow-hidden rounded-[1.5rem] p-5 text-white shadow-float"
                  style={{
                    background: `linear-gradient(160deg, ${corrente.sfondo})`,
                    transform: drag ? `translateX(${drag.dx}px) rotate(${drag.dx / 25}deg)` : undefined,
                    transition: drag ? "none" : "transform 200ms",
                  }}
                >
                  {drag && Math.abs(drag.dx) > 30 && (
                    <span aria-hidden className={`absolute left-4 top-4 rounded-pill px-3 py-1 font-display text-sm font-bold ${drag.dx > 0 ? "bg-accent" : "bg-black/50"}`}>
                      {drag.dx > 0 ? "👍 Sì" : "👎 No"}
                    </span>
                  )}
                  <span aria-hidden className="absolute right-4 top-3 text-[5.5rem] leading-none drop-shadow">{corrente.emoji}</span>
                  <span className="mb-2 w-fit rounded-pill bg-black/25 px-2.5 py-0.5 text-[11px] font-display font-semibold uppercase tracking-wider">
                    {corrente.famoso ? "Molto noto" : "Poco noto"}
                  </span>
                  <h2 className="font-title text-2xl font-semibold leading-tight">{corrente.titolo}</h2>
                  <p className="mt-1 text-sm font-sans text-white/90">{corrente.riga}</p>
                </div>
                <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <button type="button" data-testid="tipo-giu" onClick={() => vota(corrente.id, "giu")} className="min-h-14 rounded-pill border-2 border-border bg-white font-display text-base font-semibold text-brand active:scale-95">
                    👎 No
                  </button>
                  <button type="button" data-testid="tipo-boh" onClick={() => vota(corrente.id, "boh")} className="min-h-11 px-2 text-sm font-display font-semibold text-text-muted">
                    Non so
                  </button>
                  <button type="button" data-testid="tipo-su" onClick={() => vota(corrente.id, "su")} className="min-h-14 rounded-pill bg-accent font-display text-base font-semibold text-white active:scale-95">
                    👍 Sì
                  </button>
                </div>
                <p aria-hidden className="mt-2 text-center text-xs font-sans text-text-muted">← trascina la card, oppure tocca →</p>
                {visti.length > 0 && (
                  <button type="button" onClick={annullaUltimo} className="mx-auto mt-2 flex min-h-11 items-center text-sm font-display font-semibold text-accent">
                    ↶ Torna al precedente
                  </button>
                )}
              </>
            ) : (
              <p data-testid="tipi-finiti" className="rounded-card bg-accent-light px-4 py-3 text-sm font-sans text-brand">
                Fatto: {su.length} {su.length === 1 ? "ti piace" : "ti piacciono"}, {giu.length} no. <button type="button" onClick={() => { setVisti([]); setSu([]); setGiu([]); }} className="font-display font-semibold text-accent">Rifai</button>
              </p>
            )}
          </div>
        )}

        {step === PASSO_COME && (
          <div data-testid="benvenuto-come">
            <Gruppo title="Famosi o chicche?">
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Famosi o chicche?">
                {SCOPERTE.map((sc) => {
                  const on = scopertaOra === sc.value;
                  return (
                    <button
                      key={sc.value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setScoperta(sc.value)}
                      className={["flex min-h-16 flex-col items-center justify-center rounded-btn border-2 px-1.5 py-2 text-center", on ? "border-accent bg-accent-light" : "border-border bg-surface"].join(" ")}
                    >
                      <span className="font-display text-sm font-semibold text-brand">{sc.label}</span>
                      <span className="mt-0.5 text-[11px] leading-tight font-sans text-text-muted">{sc.riga}</span>
                    </button>
                  );
                })}
              </div>
              {!scoperta && dedotta && <p className="mt-1.5 text-xs font-sans text-text-muted">Scelto dai tuoi 👍: cambialo se non è così.</p>}
            </Gruppo>
            <Gruppo title="A tavola">
              <div className="flex flex-wrap gap-2">
                {DIETE.map((d) => (
                  <Chip key={d.id} item={{ value: d.id, label: d.label, emoji: d.emoji }} selected={diete.includes(d.id)} onToggle={(v) => setDiete((p) => toggle(p, v))} />
                ))}
              </div>
            </Gruppo>
            <details data-testid="come-altro" className="group rounded-card border border-border bg-surface px-4 py-2" open={occasions.length > 0 || priceRange != null}>
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-display font-semibold text-brand [&::-webkit-details-marker]:hidden">
                Occasioni e spesa <span className="text-xs font-sans font-normal text-text-muted">facoltativo</span>
              </summary>
              <div className="pt-2">
              <Gruppo title="Occasioni">
              <div className="flex flex-wrap gap-2">
                {OCCASIONS.map((item) => (
                  <Chip key={item.value} item={item} selected={occasions.includes(item.value)} onToggle={(v) => setOccasions((p) => toggle(p, v))} />
                ))}
              </div>
              </Gruppo>
              <Gruppo title="Spesa tipica">
              <div className="grid grid-cols-4 gap-2">
                {PRICE_RANGES.map((item) => {
                  const on = priceRange === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setPriceRange(on ? null : item.value)}
                      className={[
                        "flex min-h-14 flex-col items-center justify-center rounded-btn border-2 px-1 py-1.5 transition-colors",
                        on ? "border-accent bg-accent-light" : "border-border bg-surface",
                      ].join(" ")}
                    >
                      <span className="font-display text-base font-bold text-brand">{item.value}</span>
                      <span className="text-[11px] leading-tight font-sans text-text-muted">{item.description}</span>
                    </button>
                  );
                })}
              </div>
              </Gruppo>
              </div>
            </details>
          </div>
        )}

        {step === PASSO_CAPITO && (
          <div data-testid="benvenuto-capito">
            {righe.length > 0 ? (
              <ul className="overflow-hidden rounded-card border border-border bg-white shadow-card">
                {righe.map((r, i) => (
                  <li key={r.chiave} className={i > 0 ? "border-t border-border" : ""}>
                    <button type="button" data-testid="capito-riga" onClick={() => setStep(PASSO_DI[r.chiave] ?? 0)} className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-surface">
                      <span aria-hidden className="text-xl">{r.emoji}</span>
                      <span className="min-w-0 flex-1 text-[15px] font-sans leading-snug text-text">{r.testo}</span>
                      <ChevronRight aria-label="Cambia" size={18} className="shrink-0 text-text-muted" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p data-testid="capito-vuoto" className="rounded-card bg-surface px-4 py-3 text-sm font-sans text-text">
                Non mi hai detto ancora niente: imparo da quello che salvi e cerchi. Puoi sempre cambiare tutto in &quot;I tuoi gusti&quot;.
              </p>
            )}
            <p className="mt-3 text-xs font-sans text-text-muted">Da ora ricerca, verdetti e ordine dei risultati tengono conto di questo.</p>
          </div>
        )}
      </div>

      {/* Pulsanti in basso */}
      {/* Senza la barra in basso (primo accesso a schermo intero): i pulsanti stanno sul fondo dello schermo. */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-bg px-6 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-float">
        <div className="mx-auto max-w-lg">
          {step < PASSO_CAPITO ? (
            step === PASSO_TIPI && corrente ? (
              <button type="button" onClick={() => setStep(PASSO_COME)} className="flex min-h-11 w-full items-center justify-center font-display text-sm font-semibold text-brand">
                Basta così, continua
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="w-full rounded-pill bg-accent px-6 py-3.5 font-display font-semibold text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
              >
                Continua
              </button>
            )
          ) : (
            <>
              <button
                type="button"
                data-testid="benvenuto-fine"
                onClick={() => finish(null)}
                disabled={!!submitting}
                className="w-full rounded-pill bg-accent px-6 py-3.5 font-display font-semibold text-white transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
              >
                {submitting === "mappa" ? (next ? "Salvo i tuoi gusti…" : "Cerco i posti per te…") : next ? "Salva e continua" : "✨ Mostrami i posti per me"}
              </button>
              {/* I posti già salvati altrove (Google Maps, il link di un reel): dopo la sintesi, non al posto suo. */}
              <button
                type="button"
                data-testid="benvenuto-importa-si"
                onClick={() => finish("importa")}
                disabled={!!submitting}
                className="mt-1 flex min-h-11 w-full items-center justify-center font-display text-sm font-semibold text-brand disabled:opacity-60"
              >
                {submitting === "importa" ? "Un attimo…" : "📍 Prima porta qui i tuoi posti salvati"}
              </button>
            </>
          )}
          {error && <p className="mt-3 text-center text-sm text-error">{error}</p>}
        </div>
      </div>
    </div>
  );
}
