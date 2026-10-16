"use client";

import { ensureSession, track } from "@/lib/track";

// Tracciamento automatico (PIANO-25-OTTOBRE.md 7.2 e 7.4): visite, pagine viste ed errori del
// telefono, senza toccare le singole pagine. Avviato da src/instrumentation-client.ts.

// Nome della pagina, mai l'indirizzo intero: ?q= contiene la frase cercata (testo personale).
export function pageName(pathname: string, search = ""): string {
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname === "/") return "home";
  if (pathname.startsWith("/mappa")) return new URLSearchParams(search).get("vista") === "salvati" ? "salvati" : "mappa";
  if (pathname.startsWith("/miei-locali")) return "salvati";
  if (pathname.startsWith("/importa")) return "importa";
  if (pathname.startsWith("/stasera")) return "stasera";
  if (pathname.startsWith("/prenotazioni")) return "prenotazioni";
  if (pathname.startsWith("/assistente")) return "assistente";
  if (pathname.startsWith("/raccolte/")) return "raccolta";
  if (/^\/u\/[^/]+\/raccolte\//.test(pathname)) return "raccolta_pubblica";
  if (pathname.startsWith("/locali/")) return "scheda_pubblica";
  if (pathname.startsWith("/onboarding")) return "onboarding";
  if (pathname.startsWith("/me/preferenze")) return "preferenze";
  if (pathname.startsWith("/profilo") || pathname === "/me") return "profilo";
  if (/^\/(login|signup|password-dimenticata|reimposta-password)/.test(pathname)) return "accesso";
  return "altro";
}

const currentPage = () => pageName(window.location.pathname, window.location.search);

let lastPage: string | null = null;
// Una vista per pagina: i cambi di ?q= o ?at= sulla mappa non sono pagine nuove.
// Il pannello di Lorenzo non si conta (falserebbe i numeri dei tester).
export function trackPage(url: string): void {
  try {
    const u = new URL(url, window.location.href);
    const name = pageName(u.pathname, u.search);
    if (name === "admin" || name === lastPage) return;
    lastPage = name;
    track("pagina", null, { pagina: name });
  } catch {
    // indirizzo non valido: niente segnale
  }
}

// Errori: al massimo 5 per caricamento e mai due volte lo stesso, così un errore in un ciclo
// non riempie la tabella (il server ha anche il suo tetto orario).
const MAX_ERRORS = 5;
const sentErrors = new Set<string>();
export function reportError(message: unknown, origine: "finestra" | "promessa" | "schermata"): void {
  try {
    const text = (typeof message === "string" ? message : message instanceof Error ? message.message : String(message ?? "")).trim();
    // "Script error." = errore di un altro sito (estensioni, mappe): non ci dice niente.
    // ResizeObserver: avviso innocuo del browser, non un errore dell'app.
    if (!text || text === "Script error." || /ResizeObserver loop/i.test(text)) return;
    const msg = text.slice(0, 200);
    const page = currentPage();
    if (page === "admin" || sentErrors.has(msg) || sentErrors.size >= MAX_ERRORS) return;
    sentErrors.add(msg);
    track("errore", null, { messaggio: msg, pagina: page, origine });
  } catch {
    // il segnalatore di errori non deve mai crearne altri
  }
}

let started = false;
export function startAutoTracking(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  try {
    trackPage(window.location.href);
    // App lasciata aperta in background (PWA): tornando dopo 30 minuti è una nuova visita.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      if (ensureSession()) { lastPage = null; trackPage(window.location.href); }
    });
    window.addEventListener("error", (e) => {
      // Errori di caricamento (immagini, script esterni) e file di altri siti: esclusi.
      if (e.filename && !e.filename.startsWith(window.location.origin)) return;
      reportError(e.error ?? e.message, "finestra");
    });
    window.addEventListener("unhandledrejection", (e) => reportError(e.reason, "promessa"));
  } catch {
    // mai bloccare l'avvio dell'app
  }
}
