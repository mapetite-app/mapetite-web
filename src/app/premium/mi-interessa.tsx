"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { trackFeature } from "@/lib/track";

// "Mi interessa" su una funzione Premium: un solo segnale per funzione e per telefono
// (ricordato nel telefono, così ricaricando non si conta due volte). Nessun pagamento.
const KEY = "mapetite.premium_interesse";

function read(): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export default function MiInteressa({ id }: { id: string }) {
  const [fatto, setFatto] = useState(false);
  useEffect(() => {
    // Lettura del telefono solo dopo il primo disegno (il server non la conosce).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (read().includes(id)) setFatto(true);
  }, [id]);

  if (fatto) {
    return (
      <p data-testid="premium-interesse-fatto" className="mt-2 inline-flex min-h-10 items-center gap-1.5 text-sm font-display font-semibold text-success">
        <Check size={16} aria-hidden /> Segnato, grazie
      </p>
    );
  }
  return (
    <button
      type="button"
      data-testid="premium-interesse"
      onClick={() => {
        trackFeature("premium_interesse", { contesto: id });
        try {
          window.localStorage.setItem(KEY, JSON.stringify([...new Set([...read(), id])]));
        } catch {
          // telefono senza memoria locale: il segnale è partito comunque
        }
        setFatto(true);
      }}
      className="mt-2 inline-flex min-h-10 items-center rounded-pill border border-brand px-4 text-sm font-display font-semibold text-brand active:scale-95"
    >
      Mi interessa
    </button>
  );
}
