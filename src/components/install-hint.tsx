"use client";

import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";

// Proposta in prova (?beta=installa): dopo la prima ricerca suggerisce di aggiungere
// Mapetite alla schermata Home, così i tester la aprono come un'app.
// iPhone: spiega il gesto (Safari non ha un pulsante); Android/Chrome: usa il prompt del browser.
// Non compare se l'app è già installata o se l'utente l'ha chiusa una volta.

type InstallPromptEvent = Event & { prompt: () => Promise<void> };

const KEY = "mapetite.installa.chiuso";

function alreadyHandled(): boolean {
  try {
    if (window.localStorage.getItem(KEY) === "1") return true;
  } catch {
    // localStorage non disponibile: si mostra comunque
  }
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone;
}

export default function InstallHint({ ready }: { ready: boolean }) {
  const [kind, setKind] = useState<"ios" | "android" | null>(null);
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  useEffect(() => {
    if (!ready || alreadyHandled()) return;
    const ua = navigator.userAgent;
    const iosSafari = /iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    const id = setTimeout(() => setKind(iosSafari ? "ios" : promptEvent ? "android" : null), 1500);
    return () => clearTimeout(id);
  }, [ready, promptEvent]);

  if (!kind) return null;

  const close = () => {
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      // ignorato
    }
    setKind(null);
  };

  return (
    <div
      role="dialog"
      aria-label="Aggiungi Mapetite alla schermata Home"
      data-testid="installa"
      className="absolute inset-x-3 top-[7.5rem] z-20 mx-auto flex max-w-md items-start gap-3 rounded-card bg-brand p-3.5 text-white shadow-float"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="" className="h-10 w-10 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 text-sm font-sans leading-snug">
        <p className="font-display font-semibold">Tienila come un&apos;app</p>
        {kind === "ios" ? (
          <p className="mt-0.5 text-white/85">
            Tocca <Share size={14} className="inline -mt-0.5" aria-label="Condividi" /> in basso e poi
            «Aggiungi alla schermata Home».
          </p>
        ) : (
          <button
            type="button"
            onClick={async () => {
              await promptEvent?.prompt();
              close();
            }}
            className="mt-2 min-h-10 rounded-pill bg-accent px-4 font-display font-semibold text-white active:scale-95"
          >
            Installa Mapetite
          </button>
        )}
      </div>
      <button type="button" onClick={close} aria-label="Chiudi suggerimento" className="-m-1 flex h-9 w-9 shrink-0 items-center justify-center text-white/80">
        <X size={18} />
      </button>
    </div>
  );
}
