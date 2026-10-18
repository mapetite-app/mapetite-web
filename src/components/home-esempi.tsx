"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { grantedPosition, readLastView } from "@/lib/last-view";
import { cityNear } from "@/lib/named-city";

// Frasi d'esempio della home. Si parte da Roma e Milano (VISIONE.md): chi è a Milano (posizione già
// permessa, o mappa lasciata lì) vede esempi di Milano invece di "a Trastevere" e "a Prati".
type Esempio = { emoji: string; title: string; sub: string; q: string };

const ROMA: Esempio[] = [
  { emoji: "🌇", title: "Rooftop romantico", sub: "per due a Roma", q: "Rooftop romantico per due a Roma" },
  { emoji: "🍝", title: "Trattoria vera", sub: "non turistica a Trastevere", q: "Trattoria autentica non turistica a Trastevere" },
  { emoji: "🍸", title: "Cocktail bar", sub: "elegante per un appuntamento", q: "Cocktail bar elegante per un appuntamento" },
  // Niente "qui vicino": dalla home la posizione non è ancora nota.
  { emoji: "🥐", title: "Colazione buona", sub: "a Prati, con cornetti veri", q: "Colazione buona a Prati con cornetti veri" },
];

const MILANO: Esempio[] = [
  { emoji: "🌇", title: "Rooftop romantico", sub: "per due a Milano", q: "Rooftop romantico per due a Milano" },
  { emoji: "🍝", title: "Trattoria milanese", sub: "vera, a Porta Romana", q: "Trattoria milanese autentica non turistica a Porta Romana" },
  { emoji: "🍸", title: "Cocktail bar", sub: "elegante per un appuntamento", q: "Cocktail bar elegante per un appuntamento" },
  { emoji: "🥐", title: "Colazione buona", sub: "a Brera, con brioche vere", q: "Colazione buona a Brera con brioche vere" },
];

export default function HomeEsempi() {
  const [esempi, setEsempi] = useState(ROMA);
  useEffect(() => {
    let alive = true;
    const last = readLastView();
    if (last && cityNear(last.lat, last.lng) === "Milano") setEsempi(MILANO);
    // La posizione vera (se già permessa) vince sull'ultima vista della mappa.
    void grantedPosition().then((pos) => {
      if (!alive || !pos) return;
      const city = cityNear(pos.lat, pos.lng);
      if (city === "Milano") setEsempi(MILANO);
      else if (city === "Roma") setEsempi(ROMA);
    });
    return () => { alive = false; };
  }, []);

  return (
    <>
      {/* Schede a due righe come Places ("Places worth knowing / in Rome"): titolo e dettaglio. */}
      {esempi.map((e) => (
        <Link
          key={e.q}
          href={`/mappa?q=${encodeURIComponent(e.q)}`}
          aria-label={e.q}
          data-esempio
          className="flex min-h-16 w-52 shrink-0 snap-start items-center gap-2.5 rounded-card border border-border bg-white px-3 py-2.5 text-left shadow-sm active:scale-[0.98]"
        >
          <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface text-lg">{e.emoji}</span>
          <span className="min-w-0">
            <span className="block text-sm font-display font-semibold leading-tight text-text">{e.title}</span>
            <span className="mt-0.5 block text-xs font-sans leading-snug text-text-muted">{e.sub}</span>
          </span>
        </Link>
      ))}
    </>
  );
}
