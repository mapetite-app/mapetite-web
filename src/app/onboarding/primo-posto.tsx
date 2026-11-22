"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight } from "lucide-react";
import { readInstalled, readPhone } from "@/app/importa/salva-da-telefono";
import { primoLink } from "@/lib/primo-link";
import { LISTA_MSG } from "@/lib/maps-link";
import { trackFeature } from "@/lib/track";

// "Salva il primo posto" (proposta 52): l'ultimo passo del primo accesso insegna il gesto con cui si salva
// da Instagram, TikTok e Google Maps, e lascia salvare subito un posto vero. Facoltativo: in basso
// "Più tardi" apre la mappa come prima. Nessuna chiamata parte da qui: il link va alla pagina del
// link condiviso (la stessa del "Condividi"), che legge il reel o il posto come sempre.
const noop = () => () => {};

export default function PrimoPosto({ onSalva, busy }: { onSalva: (link: string) => void; busy: boolean }) {
  const phone = useSyncExternalStore(noop, readPhone, () => null);
  const installed = useSyncExternalStore(noop, readInstalled, () => false);
  // Su Android con l'app installata Mapetite è nel menu Condividi; altrimenti si copia il link e si incolla.
  const diretto = phone === "android" && installed;
  const passi = diretto
    ? [
        { icon: "📤", testo: "Nel reel tocca Condividi" },
        { icon: "🍽️", testo: "Scegli Mapetite" },
        { icon: "📍", testo: "Lo salvo io" },
      ]
    : [
        { icon: "📤", testo: "Nel reel tocca Condividi" },
        { icon: "🔗", testo: "Poi Copia link" },
        { icon: "📋", testo: "Incollalo qui" },
      ];
  const [campo, setCampo] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const prova = (testo: string) => {
    const r = primoLink(testo);
    if (r && "link" in r) {
      setErrore(null);
      trackFeature("benvenuto_primo_posto", { contesto: r.tipo });
      onSalva(r.link);
      return true;
    }
    setErrore(r?.tipo === "lista" ? LISTA_MSG : testo.trim() ? "Non è il link di un reel o di un posto su Google Maps." : null);
    return false;
  };

  const incolla = async () => {
    let clip = "";
    try {
      clip = (await navigator.clipboard?.readText?.()) ?? "";
    } catch {
      // Permesso negato o browser che non lo consente: si incolla a mano nel campo.
    }
    if (clip && prova(clip)) return;
    setCampo(clip);
    if (!clip) setErrore(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <section data-testid="primo-posto" data-diretto={diretto ? "si" : "no"} className="flex flex-col">
      <p className="text-[15px] font-sans leading-snug text-text-muted">Hai visto un posto in un reel o su Google Maps? Così non lo perdi più.</p>
      <ol aria-label="Come si salva" className="mt-5 grid grid-cols-3 gap-2">
        {passi.map((p, i) => (
          <li key={p.testo} data-testid="primo-posto-passo" className="gesto-passo flex flex-col items-center rounded-card border-2 border-[#e3e7e7] bg-white px-2 pb-3 pt-2.5 text-center">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">{i + 1}</span>
            <span aria-hidden className="mt-1.5 text-[26px] leading-none">{p.icon}</span>
            <span className="mt-2 font-display text-[13px] font-semibold leading-tight text-[#141414]">{p.testo}</span>
          </li>
        ))}
      </ol>
      {diretto ? (
        <p data-testid="primo-posto-diretto" className="mt-5 text-[15px] font-sans leading-snug text-text">Prova adesso: apri Instagram, scegli un reel e condividilo con Mapetite.</p>
      ) : null}
      {/* Il link si incolla anche su Android con l'app installata: è la strada per chi ha già copiato un link. */}
      {campo === null ? (
        <button
          type="button"
          data-testid="primo-posto-incolla"
          onClick={() => void incolla()}
          disabled={busy}
          className={`mt-5 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl px-6 font-display text-[17px] font-semibold transition-opacity active:scale-[0.98] disabled:opacity-60 ${diretto ? "border-2 border-accent bg-white text-accent" : "bg-accent text-white shadow-float"}`}
        >
          <span aria-hidden>📋</span> {busy ? "Apro il posto…" : diretto ? "Hai già copiato un link? Incolla" : "Incolla il link"}
        </button>
      ) : (
        <form
          className="mt-5 flex gap-2"
          onSubmit={(e) => { e.preventDefault(); prova(campo); }}
        >
          <input
            ref={inputRef}
            data-testid="primo-posto-campo"
            value={campo}
            onChange={(e) => { setCampo(e.target.value); setErrore(null); }}
            inputMode="url"
            autoComplete="off"
            aria-label="Link del reel o del posto"
            aria-invalid={!!errore}
            placeholder="Incolla qui il link"
            className="min-h-[52px] min-w-0 flex-1 rounded-2xl border-2 border-border bg-white px-4 text-[16px] font-sans text-text outline-none focus:border-brand aria-[invalid=true]:border-error"
          />
          <button type="submit" data-testid="primo-posto-salva" disabled={busy || !campo.trim()} aria-label="Salva" className="flex min-h-[52px] min-w-[52px] items-center justify-center rounded-2xl bg-accent px-4 font-display text-[16px] font-semibold text-white disabled:opacity-40">
            {busy ? "…" : <ArrowRight size={20} aria-hidden />}
          </button>
        </form>
      )}
      {errore && <p role="alert" data-testid="primo-posto-errore" className="mt-2 text-sm text-error">{errore}</p>}
    </section>
  );
}
