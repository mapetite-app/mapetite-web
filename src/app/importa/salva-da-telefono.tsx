"use client";

import { useState, useSyncExternalStore } from "react";
import { trackFeature } from "@/lib/track";

// Salva da iPhone (piano 3.3). Su iPhone le app web non compaiono nel menu Condividi:
// la strada più corta è "Copia link" nell'app → qui "Incolla il link copiato" (2 tocchi).
// Su Android, con l'app installata, Mapetite compare direttamente in Condividi.
// La lettura degli appunti e il salvataggio sono quelli di "Da Google Maps" (onPaste):
// Maps, TikTok, YouTube e Instagram seguono lo stesso percorso, con lo stesso ripiego a mano.
type Phone = "iphone" | "android" | null;

function readPhone(): Phone {
  const ua = navigator.userAgent;
  // iPad con iPadOS si presenta come Mac: lo riconosce il tocco.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "iphone";
  return /Android/.test(ua) ? "android" : null;
}

function readInstalled(): boolean {
  try {
    return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
}

const noop = () => () => {};

export default function SalvaDaTelefono({ onPaste }: { onPaste: () => void }) {
  const detected = useSyncExternalStore(noop, readPhone, () => null);
  const installed = useSyncExternalStore(noop, readInstalled, () => false);
  // Da computer (né iPhone né Android) si mostra la guida iPhone, la più comune tra i tester.
  const [choice, setChoice] = useState<Phone>(null);
  const phone: Exclude<Phone, null> = choice ?? detected ?? "iphone";

  const steps =
    phone === "iphone"
      ? [
          { icon: "🔗", title: "Copia il link", text: "In Instagram, TikTok o Maps: Condividi → Copia link" },
          { icon: "📋", title: "Incolla qui", text: "Apri Mapetite e tocca il pulsante qui sotto" },
        ]
      : [
          { icon: "📤", title: "Tocca Condividi", text: "Sul reel, sul video o sul locale in Maps" },
          { icon: "🍽️", title: "Scegli Mapetite", text: installed ? "Lo salvo io, con nome e posizione" : "Compare dopo aver installato l’app" },
        ];

  const paste = () => {
    trackFeature("salva_da_telefono_incolla", { contesto: phone });
    document.getElementById("importa-google-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    onPaste();
  };

  return (
    <section data-testid="salva-telefono" data-telefono={phone} className="mb-6 rounded-card bg-brand p-4 text-white shadow-float">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-base font-semibold">Salva un posto in 2 tocchi</h2>
        <button
          type="button"
          data-testid="salva-telefono-cambia"
          onClick={() => {
            const next = phone === "iphone" ? "android" : "iphone";
            setChoice(next);
            trackFeature("salva_da_telefono_cambia", { contesto: next });
          }}
          className="min-h-9 shrink-0 text-xs font-display font-semibold text-white/75 underline"
        >
          {phone === "iphone" ? "Hai un Android?" : "Hai un iPhone?"}
        </button>
      </div>
      <ol className="mt-3 grid grid-cols-2 gap-2">
        {steps.map((s, i) => (
          <li key={s.title} data-testid="salva-telefono-passo" className="rounded-card bg-white/10 p-3">
            <span className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold">{i + 1}</span>
              <span aria-hidden className="text-xl">{s.icon}</span>
            </span>
            <span className="mt-2 block font-display text-sm font-semibold leading-tight">{s.title}</span>
            <span className="mt-0.5 block text-xs leading-snug text-white/75">{s.text}</span>
          </li>
        ))}
      </ol>
      <button
        type="button"
        data-testid="salva-telefono-incolla"
        onClick={paste}
        className={`mt-3 min-h-12 w-full rounded-pill px-4 font-display text-base font-semibold active:scale-[0.99] ${phone === "iphone" ? "bg-accent text-white" : "border border-white/40 bg-transparent text-white"}`}
      >
        {phone === "iphone" ? "📋 Incolla il link copiato" : "Oppure 📋 incolla il link copiato"}
      </button>
    </section>
  );
}
