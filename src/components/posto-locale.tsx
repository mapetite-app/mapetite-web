"use client";

import { useEffect, useState } from "react";
import { frasePosto } from "@/lib/serate";
import { fraseApertura } from "@/lib/aperto-dal";
import { frasePrezzo } from "@/lib/prezzo-locale";
import { oggiRomaFeste, pulisciMenuFeste, rigaMenuFeste } from "@/lib/menu-feste";

// Parola del titolare nella scheda (POSIZIONAMENTO.md: "al massimo un badge e una riga"):
// se il titolare l'ha detto, "🌙 Martedì c'è posto". Solo locali verificati; per tutti gli altri
// non compare niente (nemmeno uno spazio vuoto). Dati da /api/ristoratore/serate.
// Il badge "Verificato" non sta qui: la scheda lo mette come spunta accanto al nome (Semplificare,
// 20/10), la pagina pubblica del locale ha il suo.
export type InfoLocale = { verificato: boolean; giorni: number[]; at: string | null; apertoDal?: string | null; prezzo?: { min?: unknown; max?: unknown; bevande?: unknown } | null; omaggio?: { testo?: unknown; soglia?: unknown } | null; feste?: { prezzo?: unknown; bevande?: unknown; giorni?: unknown; gruppi?: unknown; at?: unknown } | null };

// Una sola richiesta per locale anche se la scheda la chiede da più punti (pillole e omaggio):
// la risposta resta in memoria 60 secondi, poi si rilegge (il titolare può averla cambiata).
const cache = new Map<string, { at: number; p: Promise<InfoLocale | null> }>();

export function leggiInfoLocale(venueId: string): Promise<InfoLocale | null> {
  const c = cache.get(venueId);
  if (c && Date.now() - c.at < 60_000) return c.p;
  // Al massimo 3 secondi (revisore 17/11): la fascia € di Google della scheda aspetta questa risposta.
  const p = fetch(`/api/ristoratore/serate?id=${encodeURIComponent(venueId)}`, { signal: AbortSignal.timeout(3000) })
    .then((r) => (r.ok ? (r.json() as Promise<InfoLocale>) : null))
    .then((j) => (j?.verificato ? j : null))
    .catch(() => { cache.delete(venueId); return null; /* senza rete: niente riga */ });
  cache.set(venueId, { at: Date.now(), p });
  return p;
}

/** Info del titolare per un locale (UUID o Place ID Google); null finché non arriva o se non è verificato. */
export function useInfoLocale(venueId: string): InfoLocale | null {
  return useInfoLocaleStato(venueId).info;
}

/** Come useInfoLocale, più "pronto": la risposta è arrivata (anche vuota o fallita). Serve a non far lampeggiare
 *  la fascia € di Google che va nascosta accanto al prezzo del titolare (revisore 4, 17/11). */
export function useInfoLocaleStato(venueId: string): { info: InfoLocale | null; pronto: boolean } {
  const [info, setInfo] = useState<{ id: string; info: InfoLocale | null } | null>(null);

  useEffect(() => {
    let vivo = true;
    leggiInfoLocale(venueId).then((j) => { if (vivo) setInfo({ id: venueId, info: j }); });
    return () => { vivo = false; };
  }, [venueId]);

  // Scheda passata a un altro locale: niente dati del precedente.
  return info?.id === venueId ? { info: info.info, pronto: true } : { info: null, pronto: false };
}

// Proposta 90 spenta finché un revisore nuovo non la approva (bocciata due volte il 26/11): solo con ?beta=menufeste.
function festeAccese(): boolean {
  try { return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("beta") === "menufeste"; } catch { return false; }
}

/** Il menu delle feste del titolare verificato, se oggi c'è ancora qualcosa da dire (PROPOSTE.md 90). */
function festeDi(info: InfoLocale | null) {
  const f = info?.verificato && info.feste ? pulisciMenuFeste(info.feste.prezzo, info.feste.bevande, info.feste.giorni, info.feste.gruppi, info.feste.at) : null;
  return rigaMenuFeste(f, oggiRomaFeste());
}

/** Pillola "🌙 … c'è posto · dice il locale", o niente. */
export function PostoPillola({ info, conPrezzo = false }: { info: InfoLocale | null; conPrezzo?: boolean }) {
  const posto = frasePosto(info);
  // Nella scheda, con il prezzo del locale, "c'è posto" sta già nel riquadro del prezzo (PrezzoLocale).
  if (!posto || (conPrezzo && info?.verificato && (frasePrezzo(info.prezzo) || (festeAccese() && festeDi(info))))) return null;
  return (
    <span data-testid="posto-stasera" className="inline-flex items-center gap-1 rounded-pill bg-accent-light px-2.5 py-0.5 text-xs font-display font-semibold text-accent">
      🌙 {posto}
      <span className="font-sans font-normal text-text-muted">· dice il locale</span>
    </span>
  );
}

/** Pillola "🆕 Aperto da 3 mesi" (parola del titolare verificato, primo anno), o niente. */
export function AperturaPillola({ info }: { info: InfoLocale | null }) {
  const f = info?.verificato ? fraseApertura(info.apertoDal) : null;
  if (!f) return null;
  return (
    <span data-testid="aperto-da-poco" className="inline-flex items-center gap-1 rounded-pill bg-brand/10 px-2.5 py-0.5 text-xs font-display font-semibold text-brand">
      <span aria-hidden>🆕</span> {f}
    </span>
  );
}

/** "💶 25–35 € a testa · dice il locale" (parola del titolare verificato, PROPOSTE.md 65), o niente.
 *  Mai mescolata con la fascia € di Google: è un'altra fonte e lo dice.
 *  Revisore 3 (17/11): con anche "c'è posto" le due frasi del titolare stanno in UN solo riquadro che finisce
 *  con "· dice il locale" (prima il prezzo restava senza fonte e i segnali andavano su 3–4 righe). */
export function PrezzoLocale({ info }: { info: InfoLocale | null }) {
  const prezzo = info?.verificato ? frasePrezzo(info.prezzo, true) : null;
  // "Menu delle feste" (PROPOSTE.md 90): nello stesso riquadro, al posto del prezzo di tutti i giorni (revisore 26/11:
  // due riquadri del titolare e due "dice il locale" portavano i segnali a 5 righe). Il prezzo di sempre resta nel title.
  const feste = festeAccese() ? festeDi(info) : null;
  if (!prezzo && !feste) return null;
  // Con il menu delle feste "c'è posto" resta corto (revisore 26/11 (2): con l'elenco dei giorni il riquadro andava su 5 righe a 360 px).
  const posto0 = frasePosto(info);
  const posto = feste && posto0 ? posto0.replace(/\s*\(anche [^)]*\)$/, "") : posto0;
  // Ogni pezzo porta il suo "·" in fondo, così una riga che va a capo non comincia mai con un punto.
  const pezzi: { id: string; testo: string }[] = [
    ...(feste ? [{ id: "menu-feste-scheda", testo: `🎄 ${feste.prezzo}, ${feste.dettagli.join("\u00a0· ")}` }] : [{ id: "prezzo-locale", testo: `💶 ${prezzo}` }]),
    ...(posto ? [{ id: "posto-stasera", testo: `🌙 ${posto}` }] : []),
  ];
  return (
    <span data-testid="parola-locale" title={frasePrezzo(info?.prezzo) ?? undefined} className={`inline-flex flex-wrap items-center gap-x-1 ${posto || feste ? "rounded-btn py-[3px]" : "rounded-pill py-0.5"} bg-accent-light px-2.5 text-xs font-display font-semibold text-accent`}>
      {pezzi.map((x) => (
        <span key={x.id}><span data-testid={x.id}>{x.testo}</span><span aria-hidden className="font-sans font-normal text-text-muted">{"\u00a0·"}</span></span>
      ))}
      <span className="font-sans font-normal text-text-muted">dice il locale</span>
    </span>
  );
}

export default function PostoLocale({ venueId, prezzo = null }: { venueId: string; prezzo?: InfoLocale["prezzo"] }) {
  const letta = useInfoLocale(venueId);
  // Pagina pubblica: il prezzo arriva già dal server (niente salto della pagina, e resta anche se la richiesta fallisce).
  const info: InfoLocale | null = prezzo ? { verificato: true, giorni: letta?.giorni ?? [], at: letta?.at ?? null, prezzo, feste: letta?.feste ?? null } : letta;
  // Pagina pubblica del locale: anche il prezzo a testa del titolare (PROPOSTE.md 65), nello stesso riquadro di "c'è posto".
  const conPrezzo = !!(info?.verificato && frasePrezzo(info.prezzo));
  const conFeste = festeAccese() && !!festeDi(info);
  if (!frasePosto(info) && !conPrezzo && !conFeste) return null;
  return (
    <p data-testid="posto-locale" className="mt-2 flex flex-wrap items-center gap-1.5">
      <PrezzoLocale info={info} />
      <PostoPillola info={info} conPrezzo />
    </p>
  );
}
