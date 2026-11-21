"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { CalendarCheck, Check } from "lucide-react";
import PlacePhoto from "@/components/place-photo";
import BookingSheet from "@/components/booking-sheet";
import CondividiLink from "@/components/condividi-link";
import { getCategoryEmoji } from "@/lib/emoji";
import { categoryLabel } from "@/lib/category-label";
import { withNext } from "@/lib/next-path";
import { trackFeature } from "@/lib/track";
import { NOME_MAX, oraChiusura, vincitore, type VotoPosto, type VotoStato } from "@/lib/voto-gruppo";
import { postoRicordato } from "@/lib/voto-gruppo-memoria";

// Pagina del voto (proposta 56): una cosa sola da fare, toccare il posto preferito. Il nome si scrive una
// volta (si ricorda nel telefono, lo stesso di "Prenota"). Mentre il voto è aperto la pagina si aggiorna
// da sola ogni 15 secondi; all'ora scelta mostra il vincitore.

const NAME_KEY = "mapetite.nome";
const AGGIORNA_MS = 15_000;
const subscribeNothing = () => () => {};

function leggiNome(): string {
  try { return localStorage.getItem(NAME_KEY)?.slice(0, NOME_MAX) ?? ""; } catch { return ""; }
}
function salvaNome(n: string) {
  try { localStorage.setItem(NAME_KEY, n.slice(0, 40)); } catch { /* storage non disponibile */ }
}

// "Giulia e Marco", "Giulia, Marco e altri 3": con nomi lunghi la riga non si taglia a metà di un nome
// senza dire quanti sono. I nomi lunghi si accorciano a 14 caratteri.
export function chiHaVotato(chi: string[]): string {
  // Con il conto ("e altri 28") i nomi si accorciano di più, così il numero resta sempre in vista.
  const max = chi.length > 2 ? 10 : 14;
  const corto = (n: string) => (n.length > max ? `${n.slice(0, max - 1).trimEnd()}…` : n);
  if (chi.length <= 2) return chi.map(corto).join(" e ");
  const altri = chi.length - 2;
  return `${corto(chi[0])}, ${corto(chi[1])} e ${altri === 1 ? "un altro" : `altri ${altri}`}`;
}

export default function VotoGruppo({ iniziale, foto, percorso, collegato }: { iniziale: VotoStato; foto: Record<string, string>; percorso: string; collegato: boolean }) {
  const [stato, setStato] = useState(iniziale);
  const [nome, setNome] = useState("");
  const [invio, setInvio] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [prenota, setPrenota] = useState<VotoPosto | null>(null);
  const campo = useRef<HTMLInputElement>(null);
  // La memoria del telefono (telefono e sito per "Prenota") si legge solo dopo l'idratazione.
  const montato = useSyncExternalStore(subscribeNothing, () => true, () => false);

  // Il nome ricordato arriva dopo il primo disegno (il server non vede il telefono).
  useEffect(() => { const n = leggiNome(); if (n) setNome(n); }, []); // eslint-disable-line react-hooks/set-state-in-effect

  const aggiorna = async () => {
    try {
      const res = await fetch(`/api/voto/${stato.codice}`, { cache: "no-store" });
      if (res.ok) setStato((await res.json()) as VotoStato);
    } catch { /* rete assente: resta quello che c'è */ }
  };

  // Aggiornamento mentre è aperto (solo con la pagina in vista) e una volta all'ora di chiusura.
  useEffect(() => {
    if (stato.chiuso) return;
    const ogni = window.setInterval(() => { if (document.visibilityState === "visible") void aggiorna(); }, AGGIORNA_MS);
    const mancano = new Date(stato.chiudeAlle).getTime() - Date.now();
    const alla = mancano > 0 && mancano < 2 ** 31 ? window.setTimeout(() => void aggiorna(), mancano + 1000) : undefined;
    return () => { window.clearInterval(ogni); if (alla) window.clearTimeout(alla); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- si riarma solo quando cambia lo stato di chiusura
  }, [stato.chiuso, stato.chiudeAlle]);

  const votaPer = async (p: VotoPosto) => {
    if (stato.chiuso || invio) return;
    const n = nome.replace(/\s+/g, " ").trim();
    if (!n) {
      setErrore("Prima scrivi il tuo nome.");
      campo.current?.focus();
      return;
    }
    setErrore(null);
    setInvio(p.id);
    try {
      const res = await fetch(`/api/voto/${stato.codice}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome: n, posto: p.id }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrore(typeof data?.error === "string" ? data.error : "Non sono riuscito a salvare il voto. Riprova.");
        if (data?.esito === "chiuso") void aggiorna();
        return;
      }
      salvaNome(n);
      if (data?.posti) setStato(data as VotoStato);
      trackFeature("voto_gruppo", { cambiato: stato.mioVoto ? 1 : 0 });
    } catch {
      setErrore("Sei offline? Riprova tra poco.");
    } finally {
      setInvio(null);
    }
  };

  const vince = stato.chiuso ? vincitore(stato) : null;
  const votanti = new Set(stato.voti.map((v) => v.nome)).size;
  const quanti = stato.voti.length;
  const sottotitolo = stato.chiuso
    ? quanti === 0 ? "Voto chiuso: nessuno ha votato." : `Voto chiuso · ${quanti === 1 ? "1 voto" : `${quanti} voti`}`
    : `Si vota fino ${oraChiusura(stato.chiudeAlle)}${quanti > 0 ? ` · ${quanti === 1 ? "1 voto" : `${quanti} voti`}` : ""}`;
  const ordinati = vince ? [...stato.posti].sort((a, b) => (a.id === vince.id ? -1 : b.id === vince.id ? 1 : 0)) : stato.posti;
  const ricordato = prenota ? postoRicordato(stato.codice, prenota.id) : null;

  return (
    <main data-testid="voto-pagina" data-voto="" data-chiuso={stato.chiuso ? "1" : undefined} className="mx-auto flex min-h-dvh max-w-md flex-col bg-bg pb-6">
      <header className="relative overflow-hidden rounded-b-[1.75rem] bg-brand px-5 pb-5 pt-5 text-white">
        <span aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-accent/25" />
        <div className="relative flex items-center justify-between gap-3">
          <p className="inline-flex items-center gap-1.5 rounded-pill bg-white/10 px-3 py-1 font-display text-xs font-semibold">
            <span aria-hidden className="h-2 w-2 rounded-full bg-accent" />Mapetite
          </p>
          {stato.sonoIo && !stato.chiuso && (
            <CondividiLink path={percorso} cosa="voto" title="Dove andiamo? Vota" text="Dove andiamo? Tocca il posto che preferisci:" label="Rimanda" testId="voto-rimanda" className="!min-h-9 !border-white/20 !bg-white/10 !text-white" />
          )}
        </div>
        <h1 data-testid="voto-titolo" className="relative mt-3 font-title text-[1.6rem] font-semibold leading-tight">
          {vince ? "Si va qui" : stato.chiuso ? "Il voto è chiuso" : "Dove andiamo?"}
        </h1>
        <p data-testid="voto-sottotitolo" className="relative mt-1 text-sm font-sans text-white/80">{sottotitolo}</p>
      </header>

      {!stato.chiuso && (
        <div className="px-4 pt-4">
          <label htmlFor="voto-nome" className="sr-only">Il tuo nome</label>
          <input
            ref={campo}
            id="voto-nome"
            data-testid="voto-nome"
            value={nome}
            onChange={(e) => { setNome(e.target.value.slice(0, NOME_MAX)); setErrore(null); }}
            maxLength={NOME_MAX}
            autoComplete="given-name"
            placeholder="Il tuo nome"
            className="min-h-12 w-full rounded-pill border border-border bg-surface px-5 text-[16px] font-sans text-text outline-none focus:border-brand"
          />
        </div>
      )}

      <ul className="flex flex-col gap-2.5 px-4 pt-3" aria-label="Posti da votare">
        {ordinati.map((p) => {
          const chi = stato.voti.filter((v) => v.posto === p.id).map((v) => v.nome);
          const mio = stato.mioVoto === p.id;
          const vinto = vince?.id === p.id;
          const tipo = categoryLabel(p.categoria, p.nome);
          return (
            <li key={p.id}>
              <button
                type="button"
                data-testid="voto-posto"
                data-id={p.id}
                aria-pressed={mio}
                disabled={stato.chiuso || invio != null}
                onClick={() => void votaPer(p)}
                aria-label={stato.chiuso ? `${p.nome}: ${chi.length} voti` : `Vota ${p.nome}`}
                className={`flex w-full items-stretch gap-3 rounded-card border-2 bg-bg p-2.5 text-left shadow-card transition-transform active:scale-[0.99] disabled:active:scale-100 ${mio || vinto ? "border-accent" : "border-transparent"} ${stato.chiuso && !vinto ? "opacity-60" : ""}`}
              >
                <span className="relative h-[84px] w-[84px] shrink-0 overflow-hidden rounded-[14px] bg-brand-light">
                  <PlacePhoto
                    photoRef={foto[p.id]}
                    alt=""
                    priority
                    className="h-full w-full object-cover"
                    fallback={<span aria-hidden className="flex h-full w-full items-center justify-center text-3xl">{getCategoryEmoji(p.categoria, p.nome)}</span>}
                  />
                  {vinto && <span data-testid="voto-vince" className="absolute left-1.5 top-1.5 rounded-pill bg-accent px-2 py-0.5 font-display text-[10px] font-semibold text-white">Vince</span>}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-start justify-between gap-2">
                    <span className="line-clamp-1 font-display text-[15px] font-semibold text-text">{p.nome}</span>
                    <span data-testid="voto-conto" className={`flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full px-2 font-display text-[13px] font-semibold ${chi.length > 0 ? "bg-brand text-white" : "bg-surface text-text-muted"}`}>
                      {invio === p.id ? "…" : mio && !stato.chiuso ? <Check size={14} aria-label="Il tuo voto" /> : chi.length}
                    </span>
                  </span>
                  {(tipo || p.zona) && <span className="truncate text-[13px] font-sans text-text-muted">{[tipo, p.zona].filter(Boolean).join(" · ")}</span>}
                  {p.verdetto && <span data-testid="voto-verdetto" className="mt-0.5 line-clamp-2 text-[13px] font-sans leading-snug text-text">{p.verdetto}</span>}
                  {chi.length > 0 && <span data-testid="voto-chi" title={chi.join(", ")} className="mt-auto truncate pt-1 text-[12px] font-sans font-medium text-brand">{chiHaVotato(chi)}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {errore && <p role="alert" data-testid="voto-errore" className="px-5 pt-2 text-sm font-sans text-error">{errore}</p>}

      {/* Subito sotto i posti (prima stava in fondo allo schermo, con mezza pagina vuota in mezzo). */}
      <div className="px-4 pt-4">
        {vince && stato.sonoIo ? (
          (() => {
            const p = stato.posti.find((x) => x.id === vince.id)!;
            const r = montato ? postoRicordato(stato.codice, p.id) : null;
            return r && (r.phone || r.websiteUri) ? (
              <button type="button" data-testid="voto-prenota" onClick={() => setPrenota(p)} className="flex min-h-13 w-full items-center justify-center gap-2 rounded-pill bg-accent px-6 font-display text-base font-semibold text-white shadow-float active:scale-[0.98]">
                <CalendarCheck size={18} aria-hidden /> Prenota
              </button>
            ) : (
              <a data-testid="voto-prenota" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.nome)}${p.gid ? `&query_place_id=${encodeURIComponent(p.gid)}` : ""}`} target="_blank" rel="noopener noreferrer" className="flex min-h-13 w-full items-center justify-center gap-2 rounded-pill bg-accent px-6 font-display text-base font-semibold text-white shadow-float active:scale-[0.98]">
                <CalendarCheck size={18} aria-hidden /> Prenota su Maps
              </a>
            );
          })()
        ) : !stato.chiuso ? (
          <p data-testid="voto-aiuto" className="text-center text-[13px] font-sans text-text-muted">
            {stato.pieno ? "Hanno già votato in 30: il voto è pieno." : stato.mioVoto ? "Fatto. Puoi cambiare voto finché è aperto." : votanti > 0 ? "Tocca un posto per votarlo." : "Tocca un posto per votarlo: sei il primo."}
          </p>
        ) : null}
        {/* Iscriversi è un invito alla fine, mai un obbligo per votare. */}
        {!collegato && (stato.mioVoto || stato.chiuso) && (
          <Link data-testid="voto-iscriviti" href={withNext("/signup", percorso)} className="mt-4 flex items-center gap-3 rounded-card bg-surface px-4 py-3.5 active:scale-[0.99]">
            <span aria-hidden className="text-2xl">📍</span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[15px] font-semibold text-brand">Fai anche tu la tua mappa</span>
              <span className="block text-[13px] font-sans text-text-muted">Salvi i posti dai reel e li ritrovi quando serve.</span>
            </span>
            <span aria-hidden className="font-display text-lg font-semibold text-brand">→</span>
          </Link>
        )}
      </div>

      {prenota && ricordato && (
        <BookingSheet
          place={{ id: ricordato.gid ?? ricordato.uuid, name: prenota.nome, phone: ricordato.phone, websiteUri: ricordato.websiteUri, openNow: null, lat: ricordato.lat, lng: ricordato.lng }}
          onClose={() => setPrenota(null)}
        />
      )}
    </main>
  );
}
