"use client";

import { useState, useSyncExternalStore } from "react";
import { trackFeature } from "@/lib/track";

// Salva da iPhone (piano 3.3). Su iPhone le app web non compaiono nel menu Condividi:
// la strada più corta è "Copia link" nell'app → qui "Incolla il link copiato" (2 tocchi).
// Su Android, con l'app installata, Mapetite compare direttamente in Condividi.
// Feedback 16/10 ("il dono della sintesi"): è una riga discreta "Come salvare dal telefono" che si
// apre con un tocco; l'unico pulsante Incolla è quello grande in cima a Importa.
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

export default function SalvaDaTelefono() {
  const [open, setOpen] = useState(false);
  const detected = useSyncExternalStore(noop, readPhone, () => null);
  const installed = useSyncExternalStore(noop, readInstalled, () => false);
  // Da computer (né iPhone né Android) si mostra la guida iPhone, la più comune tra i tester.
  const [choice, setChoice] = useState<Phone>(null);
  const phone: Exclude<Phone, null> = choice ?? detected ?? "iphone";

  const steps =
    phone === "iphone"
      ? [
          { icon: "🔗", title: "Copia il link", text: "In Instagram, TikTok o Maps: Condividi → Copia link" },
          { icon: "📋", title: "Incolla qui", text: "Apri Mapetite e tocca Incolla un link" },
        ]
      : [
          { icon: "📤", title: "Tocca Condividi", text: "Sul reel, sul video o sul locale in Maps" },
          { icon: "🍽️", title: "Scegli Mapetite", text: installed ? "Lo salvo io, con nome e posizione" : "Compare dopo aver installato l’app" },
        ];

  return (
    <section data-testid="salva-telefono" data-telefono={phone} className="mt-3">
      <button
        type="button"
        data-testid="salva-telefono-apri"
        aria-expanded={open}
        onClick={() => {
          if (!open) trackFeature("salva_da_telefono_apri", { contesto: phone });
          setOpen((o) => !o);
        }}
        className="flex min-h-11 w-full items-center justify-center gap-1.5 text-sm font-display font-semibold text-brand"
      >
        <span aria-hidden>📱</span> Come salvare dal telefono <span aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>
      {open && (
        <div className="rounded-card bg-brand p-4 text-white shadow-float">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-base font-semibold">{phone === "iphone" ? "Da iPhone" : "Da Android"}</h2>
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
        </div>
      )}
    </section>
  );
}
