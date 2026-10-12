"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic } from "lucide-react";

// Microfono nel campo di ricerca (come Places): usa il riconoscimento vocale del browser,
// nessun servizio a pagamento. Compare solo dove il telefono lo supporta.
type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export default function VoiceButton({ onText, onError }: { onText: (text: string) => void; onError?: (message: string) => void }) {
  const supported = useSyncExternalStore(() => () => {}, () => getCtor() != null, () => false);
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  // Se il pulsante sparisce (si scrive, si tocca un esempio) si smette di ascoltare:
  // un risultato in ritardo farebbe partire una seconda ricerca.
  useEffect(() => () => {
    const r = rec.current;
    if (!r) return;
    r.onresult = null; r.onend = null; r.onerror = null;
    try { r.stop(); } catch { /* già fermo */ }
  }, []);
  if (!supported) return null;
  return (
    <button
      type="button"
      data-testid="microfono"
      aria-label={listening ? "Sto ascoltando: tocca per fermare" : "Detta la ricerca"}
      aria-pressed={listening}
      onClick={() => {
        if (listening) { rec.current?.stop(); return; }
        const Ctor = getCtor();
        if (!Ctor) return;
        const r = new Ctor();
        r.lang = "it-IT";
        r.interimResults = false;
        r.maxAlternatives = 1;
        r.onresult = (e) => {
          const text = e.results[0]?.[0]?.transcript?.trim();
          if (text) onText(text);
        };
        r.onerror = (e) => {
          setListening(false);
          // "no-speech" / "aborted": niente da dire. Il resto si spiega in italiano.
          if (e?.error === "not-allowed" || e?.error === "service-not-allowed") onError?.("Microfono non disponibile: controlla i permessi del browser, oppure scrivi.");
          else if (e?.error === "network") onError?.("Per dettare serve la connessione: riprova o scrivi.");
          else if (e?.error && e.error !== "no-speech" && e.error !== "aborted") onError?.("Non ho capito: riprova o scrivi.");
        };
        r.onend = () => setListening(false);
        rec.current = r;
        setListening(true);
        try { r.start(); } catch { setListening(false); }
      }}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${listening ? "animate-pulse bg-accent text-white" : "text-brand"}`}
    >
      <Mic size={18} aria-hidden />
    </button>
  );
}
