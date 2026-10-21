"use client";

import Link from "next/link";
import { withNext } from "@/lib/next-path";
import ReelSave, { type Luogo } from "@/components/reel-save";

const ERRORI: Record<string, string> = {
  illeggibile: "Non riesco a leggere un locale in questa immagine.",
  limite: "Hai condiviso tante immagini in poco tempo: riprova tra qualche minuto.",
  formato: "Non riesco ad aprire questa immagine: prova con uno screenshot (PNG o JPG).",
  grande: "L'immagine è troppo grande (massimo 5 MB): prova con uno screenshot.",
};

// Esito dello screenshot condiviso da Instagram/TikTok (Android): la lettura è già fatta dal ricevi.
// Ricerca su Google, salvataggio da solo quando combacia e "Non è questo": src/components/reel-save.tsx.
export default function ScreenshotResult({
  nome,
  citta,
  categoria = "",
  altri = [],
  autoSave = false,
  errore,
  piu,
  lette = 0,
  userId,
}: {
  nome: string;
  citta: string;
  categoria?: string;
  altri?: Luogo[];
  autoSave?: boolean;
  errore: string;
  piu: boolean;
  // Slide del carosello lette (più di una: si dice quante).
  lette?: number;
  userId: string | null;
}) {
  const luoghi: Luogo[] = nome ? [{ nome, citta: citta || null, categoria: categoria || null }, ...altri] : [];

  const manualLink = (label: string) => (
    <Link
      href="/importa"
      data-testid="screenshot-manuale"
      className="inline-flex min-h-11 items-center rounded-pill border border-border bg-white px-4 text-sm font-display font-semibold text-brand"
    >
      {label}
    </Link>
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 font-title text-3xl font-semibold text-brand">Salva dal reel</h1>

      {(piu || lette > 1) && !errore && (
        <p className="mb-4 rounded-btn bg-accent-light px-4 py-3 text-sm font-semibold text-brand" data-testid="screenshot-piu">
          {piu ? `Ho letto le prime ${lette || 5} immagini` : `Ho letto ${lette} immagini`}
          {luoghi.length > 1 ? `: ${luoghi.length} posti.` : "."}
        </p>
      )}

      {errore && (
        <div className="space-y-3" data-testid="screenshot-errore">
          <p className="rounded-btn bg-error/10 px-4 py-3 text-sm text-error">
            {ERRORI[errore] ?? "Qualcosa è andato storto con l'immagine. Riprova."}
          </p>
          <p className="text-sm text-text-muted">
            Funziona meglio con uno screenshot dove si vedono il nome del locale, il tag del profilo o la posizione del post.
          </p>
          {manualLink("Carica lo screenshot a mano")}
        </div>
      )}

      {!errore && !nome && (
        <div className="space-y-3">
          <p className="rounded-btn bg-error/10 px-4 py-3 text-sm text-error">
            Non è arrivata nessuna immagine. Da Instagram o TikTok fai uno screenshot, tocca Condividi e scegli Mapetite.
          </p>
          {manualLink("Vai a Importa")}
        </div>
      )}

      {!errore && nome && !userId && (
        <div className="space-y-3 rounded-card border border-border bg-surface p-5" data-testid="screenshot-accedi">
          <p className="text-sm text-text">
            Ho letto <span className="font-semibold">{[nome, citta].filter(Boolean).join(", ")}</span>. Per salvarlo accedi a Mapetite: poi torni qui e lo cerco su Google Maps.
          </p>
          {/* Dopo l'accesso si torna a questa pagina con lo stesso nome letto (nessuna nuova lettura AI). */}
          <Link href={withNext("/login", `/importa/condividi/immagine?${new URLSearchParams({ nome, ...(citta ? { citta } : {}), ...(altri.length ? { altri: JSON.stringify(altri) } : {}) })}`)} className="inline-flex min-h-11 items-center rounded-pill bg-brand px-4 text-sm font-display font-semibold text-white">
            Accedi
          </Link>
        </div>
      )}

      {!errore && nome && userId && <ReelSave text="" userId={userId} initial={luoghi} autoSave={autoSave} />}

      {!errore && nome && userId && (
        <p className="mt-6 text-sm text-text-muted">
          <Link href="/importa" className="inline-flex min-h-11 items-center font-display font-semibold text-brand underline underline-offset-2">Salva altri locali</Link>
        </p>
      )}
    </div>
  );
}
