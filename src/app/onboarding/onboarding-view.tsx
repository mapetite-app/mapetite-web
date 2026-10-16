"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { completeOnboarding, skipOnboarding } from "./actions";
import { CUISINES, OCCASIONS, ATMOSPHERES, PRICE_RANGES } from "@/lib/preferences";
import { trackFeature } from "@/lib/track";
import { clearStoredInvite, readStoredInvite } from "@/lib/invito";

// Primo accesso dopo la registrazione (piano 9.1): tre schermate al massimo, stile Albo.
// 1) i gusti in una schermata sola, 2) la città, 3) "porta qui i tuoi salvati di Google Maps".
// Ogni schermata ha la barra di avanzamento; le prime due "Salta", l'ultima "Lo faccio dopo".

const STEPS = [
  { kicker: "I TUOI GUSTI", title: "Cosa ti piace?", subtitle: "Tocca quello che ti somiglia: bastano due o tre scelte." },
  { kicker: "LA TUA CITTÀ", title: "Dove esci di solito?", subtitle: "Così i primi consigli sono già vicino a te." },
  { kicker: "I TUOI SALVATI", title: "Hai posti salvati su Google Maps?", subtitle: "Portali qui adesso: è il modo più veloce per avere subito la tua mappa." },
] as const;
const TOTAL = STEPS.length;

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

// Illustrazione della terza schermata: i salvati di Google Maps che diventano la tua mappa.
function IlluImporta() {
  const rows = [
    { e: "🍝", n: "Trattoria da provare", c: "Roma" },
    { e: "🍸", n: "Cocktail bar di Marco", c: "Milano" },
    { e: "🥐", n: "Colazione in centro", c: "Roma" },
  ];
  return (
    <div aria-hidden className="mx-auto w-full max-w-xs">
      <div className="rounded-card border border-border bg-white p-3 shadow-card">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-display font-semibold uppercase tracking-wide text-text-muted">
          <span>📍</span> Salvati su Google Maps
        </p>
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.n} className="flex items-center gap-2 rounded-btn bg-surface px-2.5 py-2 text-sm font-sans text-text">
              <span>{r.e}</span>
              <span className="min-w-0 flex-1 truncate">{r.n}</span>
              <span className="text-xs text-text-muted">{r.c}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="my-2 text-center text-2xl text-accent">↓</div>
      <div className="flex items-center gap-3 rounded-card bg-brand p-3 text-white shadow-float">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-2xl">🗺️</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-display font-semibold uppercase tracking-wider text-white/70">Tutti insieme</p>
          <p className="text-sm font-display font-semibold">Sulla tua mappa Mapetite</p>
        </div>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold">✓</span>
      </div>
    </div>
  );
}

export default function OnboardingView({ next = null }: { next?: string | null }) {
  const [step, setStep] = useState(0);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [occasions, setOccasions] = useState<string[]>([]);
  const [atmospheres, setAtmospheres] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [otherCity, setOtherCity] = useState("");
  const [otherOpen, setOtherOpen] = useState(false);
  const [submitting, setSubmitting] = useState<"importa" | "mappa" | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const finish = async (dest: "importa" | null) => {
    setSubmitting(dest ?? "mappa");
    setError(null);
    trackFeature(dest === "importa" ? "benvenuto_importa" : "benvenuto_fine", { contesto: `passo_${step + 1}` });
    const result = await completeOnboarding({ cuisines, occasions, atmospheres, priceRange, city: chosenCity, dest, next });
    if (result?.error) {
      setError(result.error);
      setSubmitting(null);
    }
  };

  // "Salta" della seconda schermata: si salta solo la città.
  const skipStep = () => {
    setCity(null);
    setOtherOpen(false);
    setStep(2);
  };

  const saltaCls = "-mr-2 min-h-11 inline-flex items-center px-2 text-sm font-display font-semibold text-text-muted underline-offset-2 hover:underline";

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
                Seconda: salta solo la città, così i gusti già scelti non si perdono.
                Terza: niente "Salta" in alto, basta "Lo faccio dopo" sotto (erano due pulsanti per
                la stessa cosa). Lo spazio resta vuoto, così "3 di 3" non si sposta. */}
            {step === TOTAL - 1 ? (
              <span aria-hidden className="-mr-2 min-h-11 w-12" />
            ) : step === 0 ? (
              <form action={skipOnboarding}>
                {next && <input type="hidden" name="next" value={next} />}
                <button type="submit" data-testid="onboarding-salta" className={saltaCls}>
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

        {step === 0 && (
          <div data-testid="benvenuto-gusti">
            <Gruppo title="Cucina">
              <div className="flex flex-wrap gap-2">
                {CUISINES.map((item) => (
                  <Chip key={item.value} item={item} selected={cuisines.includes(item.value)} onToggle={(v) => setCuisines((p) => toggle(p, v))} />
                ))}
              </div>
            </Gruppo>
            <Gruppo title="Occasione">
              <div className="flex flex-wrap gap-2">
                {OCCASIONS.map((item) => (
                  <Chip key={item.value} item={item} selected={occasions.includes(item.value)} onToggle={(v) => setOccasions((p) => toggle(p, v))} />
                ))}
              </div>
            </Gruppo>
            <Gruppo title="Atmosfera">
              <div className="flex flex-wrap gap-2">
                {ATMOSPHERES.map((item) => (
                  <Chip key={item.value} item={item} selected={atmospheres.includes(item.value)} onToggle={(v) => setAtmospheres((p) => toggle(p, v))} />
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
        )}

        {step === 1 && (
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
                onClick={() => setOtherOpen((o) => !o)}
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
          </div>
        )}

        {step === 2 && (
          <div data-testid="benvenuto-importa">
            <IlluImporta />
            <ol className="mt-6 space-y-2.5">
              {[
                "Apri Google Maps e i tuoi elenchi salvati",
                "Copia i link dei posti, o la chat dove te li mandi",
                "Incollali in Mapetite: li salvo tutti insieme",
              ].map((s, i) => (
                <li key={s} className="flex items-start gap-3 text-sm font-sans text-text">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">{i + 1}</span>
                  <span className="pt-0.5">{s}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {/* Pulsanti in basso */}
      <div className="fixed left-0 right-0 z-40 bg-bg px-6 pb-[calc(1rem+var(--nav-sporgenza))] pt-4 shadow-float" style={{ bottom: "var(--nav-height-mobile)" }}>
        <div className="mx-auto max-w-lg">
          {step < TOTAL - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="w-full rounded-pill bg-accent px-6 py-3.5 font-display font-semibold text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
            >
              Continua
            </button>
          ) : (
            <>
              <button
                type="button"
                data-testid="benvenuto-importa-si"
                onClick={() => finish("importa")}
                disabled={!!submitting}
                className="w-full rounded-pill bg-accent px-6 py-3.5 font-display font-semibold text-white transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
              >
                {submitting === "importa" ? "Un attimo…" : "📍 Importa da Google Maps"}
              </button>
              <button
                type="button"
                data-testid="benvenuto-dopo"
                onClick={() => finish(null)}
                disabled={!!submitting}
                className="mt-1 flex min-h-11 w-full items-center justify-center font-display text-sm font-semibold text-brand disabled:opacity-60"
              >
                {submitting === "mappa" ? (next ? "Salvo i tuoi gusti…" : "Cerco i posti per te…") : next ? "Lo faccio dopo, continua" : "Lo faccio dopo: mostrami i posti per me"}
              </button>
            </>
          )}
          {error && <p className="mt-3 text-center text-sm text-error">{error}</p>}
        </div>
      </div>
    </div>
  );
}
