"use client";

import Link from "next/link";
import { useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft } from "lucide-react";

// Primo accesso (stile Albo): tre schermate, un'idea per schermata, poi la home con la ricerca.
// Si vede una sola volta per telefono (localStorage "mapetite.intro"); "Come funziona" la riapre.
// Niente lampo al primo disegno: lo script in layout.tsx mette <html data-intro="nuovo"> prima del
// disegno se l'intro non è mai stata vista (o con ?intro=1); finché React non è pronto la
// visibilità la decide il CSS su quell'attributo.
export const INTRO_KEY = "mapetite.intro";
const EVENT = "mapetite-intro";
let forced = false;

function read(): "si" | "no" {
  if (forced || document.documentElement.dataset.intro === "nuovo") return "si";
  try {
    return window.localStorage.getItem(INTRO_KEY) ? "no" : "si";
  } catch {
    // storage non disponibile (navigazione privata): non la si ripropone a ogni visita
    return "no";
  }
}
function subscribe(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}
function emit() {
  window.dispatchEvent(new Event(EVENT));
}

function markSeen() {
  try {
    window.localStorage.setItem(INTRO_KEY, "visto");
  } catch {
    // ignorato
  }
  forced = false;
  delete document.documentElement.dataset.intro;
  const url = new URL(window.location.href);
  if (url.searchParams.has("intro")) {
    url.searchParams.delete("intro");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }
  emit();
}

// ─── Illustrazioni (solo Tailwind ed emoji) ─────────────────────────────────

function IlluRaccogli() {
  const sources = [
    { e: "📸", t: "Post di Instagram" },
    { e: "🎬", t: "Video su TikTok" },
    { e: "📍", t: "Link di Google Maps" },
    { e: "🖼️", t: "Screenshot" },
    { e: "💬", t: "«Devi andarci!»" },
  ];
  return (
    <div className="relative mx-auto w-full max-w-xs">
      <div className="flex flex-wrap justify-center gap-2">
        {sources.map((s, i) => (
          <span
            key={s.t}
            className={`flex items-center gap-1.5 rounded-pill border border-border bg-white px-3 py-1.5 text-sm font-sans text-text shadow-card ${i % 2 ? "rotate-2" : "-rotate-2"}`}
          >
            <span aria-hidden>{s.e}</span> {s.t}
          </span>
        ))}
      </div>
      <div aria-hidden className="my-3 text-center text-2xl text-accent">↓</div>
      <div className="mx-auto flex max-w-[16rem] items-center gap-3 rounded-card bg-brand p-3 text-left text-white shadow-float">
        <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-2xl">🍕</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-display font-semibold uppercase tracking-wider text-white/70">Salvato</p>
          <p className="text-sm font-display font-semibold">Nella tua mappa</p>
        </div>
        <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold">✓</span>
      </div>
    </div>
  );
}

function IlluRitrova() {
  const pins = [
    { e: "🍝", x: "left-[14%]", y: "top-[22%]" },
    { e: "🍸", x: "left-[58%]", y: "top-[14%]" },
    { e: "🥐", x: "left-[34%]", y: "top-[56%]" },
    { e: "🍕", x: "left-[72%]", y: "top-[52%]" },
  ];
  return (
    <div className="mx-auto w-full max-w-xs">
      <div className="mb-3 flex rounded-pill bg-surface p-1 text-sm font-display font-semibold">
        <span className="flex-1 rounded-pill bg-brand py-1.5 text-center text-white">⭐ Voglio andarci</span>
        <span className="flex-1 py-1.5 text-center text-text-muted">✓ Ci sono stato</span>
      </div>
      <div
        aria-hidden
        className="relative h-40 overflow-hidden rounded-card border border-border bg-[#eef3ef] bg-[linear-gradient(#dfe8e2_1px,transparent_1px),linear-gradient(90deg,#dfe8e2_1px,transparent_1px)] bg-[size:28px_28px]"
      >
        <span className="absolute left-0 top-[44%] h-2.5 w-full -rotate-6 bg-white" />
        <span className="absolute left-[46%] top-0 h-full w-2.5 rotate-12 bg-white" />
        <span className="absolute left-[8%] top-[70%] h-10 w-24 rounded-[40%] bg-[#cfe3f0]" />
        {pins.map((p) => (
          <span
            key={p.e}
            className={`absolute ${p.x} ${p.y} flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-white text-xl shadow-float`}
          >
            {p.e}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-2 text-sm font-sans">
        {["💕 Romantici", "✈️ Lisbona", "🍝 Cene con amici"].map((t) => (
          <span key={t} className="rounded-pill bg-accent-light px-3 py-1.5 text-accent">{t}</span>
        ))}
      </div>
    </div>
  );
}

function IlluScegli() {
  return (
    <div className="mx-auto w-full max-w-xs text-left">
      <p className="ml-auto w-fit max-w-[85%] rounded-card rounded-br-sm bg-brand px-3.5 py-2.5 text-sm font-sans text-white">
        Una trattoria vera, non turistica, a Testaccio
      </p>
      <div className="mt-3 rounded-card border border-border bg-white p-3.5 shadow-card">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-xl">🍝</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-display font-semibold text-text">Trattoria di quartiere</p>
            <p className="text-xs font-sans text-text-muted">Testaccio · €€</p>
          </div>
          <span className="rounded-pill bg-surface px-2 py-0.5 text-[11px] font-sans text-text-muted">esempio</span>
        </div>
        <p className="mt-3 text-[11px] font-display font-semibold uppercase tracking-wider text-accent">Il verdetto</p>
        <p className="text-sm font-sans text-text">Cucina romana fatta bene, gente del quartiere, prezzi onesti.</p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-sans">
          <span className="rounded-pill bg-accent-light px-2.5 py-1 text-accent">Vai per: cacio e pepe</span>
          <span className="rounded-pill bg-surface px-2.5 py-1 text-text-muted">Non aspettarti: fretta</span>
        </div>
      </div>
    </div>
  );
}

const SCREENS = [
  {
    title: "Non perdere più i posti che scopri",
    text: "Un reel, un video, un amico che dice «devi andarci». Lo salvi in Mapetite in un gesto, da qualsiasi app.",
    Illu: IlluRaccogli,
  },
  {
    title: "Ritrovali quando devi scegliere",
    text: "«Dove andiamo stasera?» Apri la tua mappa: Voglio andarci, Ci sono stato, le tue raccolte. Decidi in pochi secondi.",
    Illu: IlluRitrova,
  },
  {
    title: "Posti giusti per te, non quelli di tutti",
    text: "Chiedi come a un amico. L'AI legge le recensioni vere e ti dà un verdetto onesto su ogni locale, anche su quelli di quartiere.",
    Illu: IlluScegli,
  },
];

export default function HomeIntro({ loggedIn }: { loggedIn: boolean }) {
  const state = useSyncExternalStore(subscribe, read, () => "ssr" as const);
  const [step, setStep] = useState(0);
  const touchX = useRef<number | null>(null);
  if (state === "no") return null;

  const last = step === SCREENS.length - 1;
  const close = () => {
    setStep(0);
    markSeen();
  };
  const go = (to: number) => setStep(Math.max(0, Math.min(SCREENS.length - 1, to)));
  const { title, text, Illu } = SCREENS[step];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="intro-titolo"
      data-testid="intro"
      data-step={step + 1}
      // Prima di React: visibile solo se lo script del layout ha segnato <html data-intro="nuovo">.
      className={`fixed inset-0 z-[60] flex-col overflow-y-auto bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] ${
        state === "ssr" ? "hidden [html[data-intro=nuovo]_&]:flex" : "flex"
      }`}
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX;
        touchX.current = null;
        if (start == null || end == null || Math.abs(end - start) < 60) return;
        go(step + (end < start ? 1 : -1));
      }}
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="flex h-11 items-center justify-between">
          <button
            type="button"
            onClick={() => go(step - 1)}
            aria-label="Indietro"
            className={`flex h-11 w-11 items-center justify-center rounded-full text-text ${step === 0 ? "invisible" : ""}`}
          >
            <ArrowLeft size={22} aria-hidden />
          </button>
          <div className="flex items-center gap-2" aria-label={`Schermata ${step + 1} di ${SCREENS.length}`} role="img">
            {SCREENS.map((s, i) => (
              <span key={s.title} className={`h-2 rounded-full transition-all ${i === step ? "w-6 bg-accent" : i < step ? "w-2 bg-brand" : "w-2 bg-border"}`} />
            ))}
          </div>
          <button
            type="button"
            onClick={close}
            data-testid="intro-salta"
            className={`min-h-11 px-2 text-sm font-display font-semibold text-text-muted ${last ? "invisible" : ""}`}
          >
            Salta
          </button>
        </div>

        <div className="flex flex-1 flex-col justify-center py-6">
          <div className="mb-8">
            <Illu />
          </div>
          <h2 id="intro-titolo" className="font-display text-[1.75rem] font-bold leading-tight tracking-tight text-brand">
            {title}
          </h2>
          <p className="mt-3 text-base leading-relaxed font-sans text-text-muted">{text}</p>
        </div>

        <div className="flex flex-col gap-2">
          {!last ? (
            <button
              type="button"
              onClick={() => go(step + 1)}
              data-testid="intro-avanti"
              className="min-h-13 rounded-pill bg-brand py-3.5 text-base font-display font-semibold text-white active:scale-[0.98]"
            >
              Avanti
            </button>
          ) : loggedIn ? (
            <button
              type="button"
              onClick={close}
              data-testid="intro-inizia"
              className="min-h-13 rounded-pill bg-accent py-3.5 text-base font-display font-semibold text-white active:scale-[0.98]"
            >
              Inizia a cercare
            </button>
          ) : (
            <>
              <Link
                href="/signup"
                onClick={markSeen}
                data-testid="intro-registrati"
                className="min-h-13 rounded-pill bg-accent py-3.5 text-center text-base font-display font-semibold text-white active:scale-[0.98]"
              >
                Crea il tuo account
              </Link>
              <button
                type="button"
                onClick={close}
                data-testid="intro-prova"
                className="min-h-13 rounded-pill border border-border py-3.5 text-base font-display font-semibold text-brand active:scale-[0.98]"
              >
                Prova senza account
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// "Come funziona" nella home: riapre l'intro dalla prima schermata.
export function IntroAgain() {
  return (
    <button
      type="button"
      onClick={() => {
        forced = true;
        emit();
      }}
      className="font-semibold text-brand"
    >
      Come funziona
    </button>
  );
}
