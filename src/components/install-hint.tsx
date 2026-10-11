"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

// Invito ad aggiungere Mapetite alla schermata Home (PWA), per i tester.
// iPhone: Safari non ha un pulsante "Installa", quindi si spiegano i due tocchi.
// Android/Chrome: si usa l'evento beforeinstallprompt. Nascosto se già installata
// o se l'utente l'ha chiuso (solo su questo telefono).
const KEY = "mapetite.installHint";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice?: Promise<{ outcome: "accepted" | "dismissed" }> };

function readPlatform(): "ios" | "other" | "hidden" {
  try {
    if (window.localStorage.getItem(KEY) === "chiuso") return "hidden";
  } catch {
    // storage non disponibile: si mostra comunque
  }
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "hidden";
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return ios ? "ios" : "other";
}

export default function InstallHint() {
  const platform = useSyncExternalStore(() => () => {}, readPlatform, () => "hidden" as const);
  const [androidPrompt, setAndroidPrompt] = useState<InstallEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setAndroidPrompt(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const close = () => {
    setClosed(true);
    try { window.localStorage.setItem(KEY, "chiuso"); } catch { /* ignorato */ }
  };

  if (closed || platform === "hidden" || (platform === "other" && !androidPrompt)) return null;

  return (
    <div data-testid="installa" className="mt-2 rounded-btn border border-border bg-white px-3 py-2 text-sm font-sans text-text">
      <div className="flex items-center justify-between gap-2">
        {platform === "ios" ? (
          <button type="button" onClick={() => setOpen((v) => !v)} className="min-h-9 flex-1 text-left font-medium text-brand">
            📲 Aggiungi Mapetite alla Home
          </button>
        ) : (
          <button
            type="button"
            onClick={async () => {
              const ev = androidPrompt;
              if (!ev) return;
              await ev.prompt();
              const choice = await ev.userChoice?.catch(() => null);
              // Solo se installata si nasconde per sempre; se la finestra viene chiusa
              // l'invito torna alla prossima occasione (il browser rimanda l'evento).
              if (choice?.outcome === "accepted") close();
              else setAndroidPrompt(null);
            }}
            className="min-h-9 flex-1 text-left font-medium text-brand"
          >
            📲 Installa Mapetite sul telefono
          </button>
        )}
        <button type="button" onClick={close} aria-label="Non mostrare più" className="flex h-9 w-9 shrink-0 items-center justify-center text-text-muted">
          ✕
        </button>
      </div>
      {open && platform === "ios" && (
        <p className="pb-1 text-xs leading-relaxed text-text-muted">
          In Safari tocca <span className="font-semibold text-text">Condividi</span> (il quadrato con la freccia in su), poi{" "}
          <span className="font-semibold text-text">“Aggiungi alla schermata Home”</span>. Si aprirà a tutto schermo, come un&apos;app.
        </p>
      )}
    </div>
  );
}
