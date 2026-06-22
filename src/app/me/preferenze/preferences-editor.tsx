"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CUISINES, OCCASIONS, ATMOSPHERES, PRICE_RANGES } from "@/lib/preferences";
import { updatePreferences } from "./actions";

interface Props {
  initialCuisines: string[];
  initialOccasions: string[];
  initialAtmospheres: string[];
  initialPriceRange: string | null;
}

function toggle(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

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

function PriceChip({
  item,
  selected,
  onSelect,
}: {
  item: { value: string; description: string };
  selected: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.value)}
      className={[
        "inline-flex items-center gap-2 rounded-pill px-4 py-2 text-sm font-display font-semibold transition-colors",
        selected
          ? "bg-brand text-white"
          : "border border-border bg-surface text-brand hover:border-brand",
      ].join(" ")}
    >
      <span>{item.value}</span>
      <span className="font-sans font-normal">{item.description}</span>
    </button>
  );
}

export default function PreferencesEditor({
  initialCuisines,
  initialOccasions,
  initialAtmospheres,
  initialPriceRange,
}: Props) {
  const router = useRouter();
  const [cuisines, setCuisines] = useState<string[]>(initialCuisines);
  const [occasions, setOccasions] = useState<string[]>(initialOccasions);
  const [atmospheres, setAtmospheres] = useState<string[]>(initialAtmospheres);
  const [priceRange, setPriceRange] = useState<string | null>(initialPriceRange);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    const result = await updatePreferences({
      cuisines,
      occasions,
      atmospheres,
      price_range: priceRange ?? "",
    });
    if (result.error) {
      setErrorMsg(result.error);
      setSaving(false);
    } else {
      router.push("/me");
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold text-text">
          Modifica le tue preferenze
        </h1>
        <Link
          href="/me"
          className="text-sm font-sans text-text-muted hover:text-text"
        >
          Annulla
        </Link>
      </div>

      <div className="space-y-8">
        <section>
          <p className="mb-3 text-xs font-display font-semibold tracking-widest text-accent">
            CUCINE
          </p>
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
        </section>

        <section>
          <p className="mb-3 text-xs font-display font-semibold tracking-widest text-accent">
            OCCASIONI
          </p>
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
        </section>

        <section>
          <p className="mb-3 text-xs font-display font-semibold tracking-widest text-accent">
            ATMOSFERE
          </p>
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
        </section>

        <section>
          <p className="mb-3 text-xs font-display font-semibold tracking-widest text-accent">
            PREZZO
          </p>
          <div className="flex flex-wrap gap-2">
            {PRICE_RANGES.map((item) => (
              <PriceChip
                key={item.value}
                item={item}
                selected={priceRange === item.value}
                onSelect={setPriceRange}
              />
            ))}
          </div>
        </section>
      </div>

      <div className="mt-10">
        {errorMsg && (
          <p className="mb-4 text-sm font-sans text-red-600">{errorMsg}</p>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-btn bg-brand px-6 py-3.5 font-display font-semibold text-white transition-opacity hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Salvataggio…" : "Salva"}
        </button>
      </div>
    </div>
  );
}
