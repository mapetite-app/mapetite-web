"use client";

import { useState } from "react";
import { completeOnboarding } from "./actions";
import { CUISINES, OCCASIONS, ATMOSPHERES, PRICE_RANGES } from "@/lib/preferences";

// ─── Tipi ─────────────────────────────────────────────────────────────────────

interface StepConfig {
  kicker: string;
  title: string;
  subtitle: string;
}

const STEPS: StepConfig[] = [
  {
    kicker: "CUCINA",
    title: "Che tipo di cucina ami?",
    subtitle: "Scegli tutte quelle che ti piacciono.",
  },
  {
    kicker: "OCCASIONE",
    title: "Per quale occasione esci?",
    subtitle: "Seleziona tutte le situazioni in cui vuoi trovare consigli.",
  },
  {
    kicker: "ATMOSFERA",
    title: "Che atmosfera preferisci?",
    subtitle: "Puoi scegliere più di una.",
  },
  {
    kicker: "BUDGET",
    title: "Qual è il tuo range di spesa?",
    subtitle: "Scegli il budget tipico per un pasto.",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toggle(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

// ─── Componenti interni ───────────────────────────────────────────────────────

function MultiChip({
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
      onClick={() => onToggle(item.value)}
      className={[
        "inline-flex items-center gap-1.5 rounded-pill px-4 py-2 text-sm font-display font-semibold transition-colors",
        selected
          ? "bg-brand text-white"
          : "border border-border bg-surface text-brand hover:border-brand",
      ].join(" ")}
    >
      <span>{item.emoji}</span>
      <span>{item.label}</span>
    </button>
  );
}

function PriceCard({
  value,
  description,
  selected,
  onSelect,
}: {
  value: string;
  description: string;
  selected: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={[
        "w-full rounded-card border-2 px-6 py-5 text-left transition-colors",
        selected
          ? "border-accent bg-accent-light"
          : "border-border bg-surface hover:border-accent",
      ].join(" ")}
    >
      <p className="text-2xl font-display font-bold text-brand">{value}</p>
      <p className="mt-1 text-sm font-sans text-text-muted">{description}</p>
    </button>
  );
}

// ─── Pagina principale ────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [occasions, setOccasions] = useState<string[]>([]);
  const [atmospheres, setAtmospheres] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalSteps = 4;
  const progress = ((step + 1) / totalSteps) * 100;
  const config = STEPS[step];

  const handleContinue = () => {
    if (step < totalSteps - 1) {
      setStep((s) => s + 1);
    }
  };

  const handleComplete = async () => {
    setSubmitting(true);
    setError(null);
    const result = await completeOnboarding({ cuisines, occasions, atmospheres, priceRange });
    if (result?.error) {
      setError(result.error);
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      {/* Progress bar */}
      <div className="sticky top-0 z-10 bg-bg px-6 pt-6 pb-4">
        <div className="mx-auto max-w-lg">
          <div className="mb-1.5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
              aria-label="Indietro"
              className="text-xl font-display font-semibold text-text-muted disabled:opacity-0"
            >
              ‹
            </button>
            <span className="text-xs font-sans text-text-muted">
              {step + 1}/{totalSteps}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-pill bg-accent-light">
            <div
              className="h-full rounded-pill bg-accent transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto w-full max-w-lg flex-1 px-6 pb-32 pt-6">
        <p className="mb-2 text-xs font-display font-semibold tracking-widest text-accent">
          {config.kicker}
        </p>
        <h1 className="mb-1 text-2xl font-display font-bold text-brand">
          {config.title}
        </h1>
        <p className="mb-8 text-sm font-sans text-text-muted">
          {config.subtitle}
        </p>

        {step === 0 && (
          <div className="flex flex-wrap gap-2">
            {CUISINES.map((item) => (
              <MultiChip
                key={item.value}
                item={item}
                selected={cuisines.includes(item.value)}
                onToggle={(v) => setCuisines((prev) => toggle(prev, v))}
              />
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-wrap gap-2">
            {OCCASIONS.map((item) => (
              <MultiChip
                key={item.value}
                item={item}
                selected={occasions.includes(item.value)}
                onToggle={(v) => setOccasions((prev) => toggle(prev, v))}
              />
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-wrap gap-2">
            {ATMOSPHERES.map((item) => (
              <MultiChip
                key={item.value}
                item={item}
                selected={atmospheres.includes(item.value)}
                onToggle={(v) => setAtmospheres((prev) => toggle(prev, v))}
              />
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            {PRICE_RANGES.map((item) => (
              <PriceCard
                key={item.value}
                value={item.value}
                description={item.description}
                selected={priceRange === item.value}
                onSelect={setPriceRange}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer button */}
      <div className="fixed bottom-0 left-0 right-0 bg-bg px-6 pb-8 pt-4 shadow-float">
        <div className="mx-auto max-w-lg">
          <button
            type="button"
            onClick={step < totalSteps - 1 ? handleContinue : handleComplete}
            disabled={submitting}
            className={[
              "w-full rounded-btn px-6 py-3.5 font-display font-semibold text-white transition-opacity active:scale-95 disabled:cursor-not-allowed disabled:opacity-60",
              step < totalSteps - 1 ? "bg-accent hover:opacity-90" : "bg-brand hover:opacity-90",
            ].join(" ")}
          >
            {step < totalSteps - 1
              ? "Continua →"
              : submitting
              ? "Un attimo…"
              : "Esplora Mapetite ✓"}
          </button>
          {error && (
            <p className="mt-3 text-center text-sm text-red-600">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
