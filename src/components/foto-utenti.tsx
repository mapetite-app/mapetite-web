"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Camera, ChevronLeft, ChevronRight, X } from "lucide-react";
import { FOTO_MAX, fotoLabel, type FotoCommunity, type FotoUtente } from "@/lib/foto-utenti";
import { caricaFoto, eliminaFoto } from "@/lib/foto-utenti-write";
import { trackFeature } from "@/lib/track";

// Foto degli utenti (piani 4.4 e 5.6c): l'editor delle proprie (1–3 per locale, scattate o dalla
// galleria), la fila delle foto della community e la vista a schermo intero. Sempre a parte
// dalle foto Google e sempre con l'etichetta di chi le ha scattate.

const subscribeNothing = () => () => {};

type Slide = { url: string; label: string };

export function FotoLightbox({ slides, start, onClose }: { slides: Slide[]; start: number; onClose: () => void }) {
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const [i, setI] = useState(start);
  if (!mounted || slides.length === 0) return null;
  const cur = slides[Math.min(i, slides.length - 1)];
  const nav = "absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white";
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={cur.label}
      data-testid="foto-lightbox"
      className="fixed inset-0 z-[80] flex flex-col bg-black/95"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") onClose();
        if (e.key === "ArrowRight") setI((x) => (x + 1) % slides.length);
        if (e.key === "ArrowLeft") setI((x) => (x - 1 + slides.length) % slides.length);
      }}
    >
      <div className="flex items-center justify-between gap-2 px-3 pt-[calc(0.5rem+env(safe-area-inset-top))]">
        <p data-testid="foto-lightbox-autore" className="min-w-0 truncate font-display text-sm font-semibold text-white">
          {cur.label}{slides.length > 1 && <span className="font-sans font-normal text-white/60"> · {i + 1} di {slides.length}</span>}
        </p>
        <button type="button" autoFocus onClick={onClose} aria-label="Chiudi la foto" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
          <X size={20} />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-3" onClick={(e) => e.stopPropagation()}>
        {/* Foto caricata da un utente (mai Google): passa dal nostro server con i controlli di visibilità. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cur.url} alt={cur.label} className="max-h-full max-w-full rounded-btn object-contain" />
        {slides.length > 1 && (
          <>
            <button type="button" aria-label="Foto precedente" onClick={() => setI((x) => (x - 1 + slides.length) % slides.length)} className={`${nav} left-2`}>
              <ChevronLeft size={22} />
            </button>
            <button type="button" aria-label="Foto successiva" onClick={() => setI((x) => (x + 1) % slides.length)} className={`${nav} right-2`}>
              <ChevronRight size={22} />
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

const ERRORI: Record<string, string> = {
  "non-immagine": "Questa non sembra una foto: scegline un'altra.",
  troppe: `Puoi tenere al massimo ${FOTO_MAX} foto per locale.`,
  "in-arrivo": "Le foto arrivano a breve.",
  errore: "Non sono riuscito a caricarla. Riprova.",
};

/**
 * Le proprie foto di un locale, con "Aggiungi foto" (fotocamera o galleria) e la × per toglierle.
 * Le foto si caricano subito, senza aspettare "Salva": `onChange` riceve la lista aggiornata.
 */
export function FotoMieEditor({
  userId,
  placeId,
  foto,
  onChange,
  pubblica,
  contesto,
  testId = "foto-mie",
}: {
  userId: string;
  placeId: string;
  foto: FotoUtente[];
  onChange: (foto: FotoUtente[]) => void;
  pubblica: boolean; // visibilità delle foto nuove
  contesto: string; // per i segnali d'uso: "diario", "scheda", "locale", "mappa"…
  testId?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const list = useRef(foto);
  useEffect(() => { list.current = foto; }, [foto]);

  const add = async (files: FileList | null) => {
    setMsg(null);
    const scelti = Array.from(files ?? []);
    if (input.current) input.current.value = ""; // la stessa foto si può riscegliere
    if (scelti.length === 0) return;
    const posto = FOTO_MAX - list.current.length;
    if (posto <= 0) { setMsg(ERRORI.troppe); return; }
    const daCaricare = scelti.slice(0, posto);
    if (scelti.length > posto) setMsg(`Ne ho prese ${posto}: al massimo ${FOTO_MAX} foto per locale.`);
    setBusy(daCaricare.length);
    for (const f of daCaricare) {
      const res = await caricaFoto(userId, placeId, f, pubblica, list.current.length);
      setBusy((b) => b - 1);
      if (res.esito === "ok") {
        list.current = [...list.current, res.foto];
        onChange(list.current);
        trackFeature("foto_utente", { stato: "aggiunta", contesto, risultati: list.current.length, fonte: pubblica ? "pubblica" : "privata" });
      } else {
        setMsg(ERRORI[res.esito]);
        if (res.esito !== "non-immagine") break;
      }
    }
    // Dopo un errore il ciclo si ferma: senza, i segnaposto "Carico…" restavano accesi per sempre.
    setBusy(0);
  };

  const remove = async (f: FotoUtente) => {
    setMsg(null);
    const ok = await eliminaFoto(userId, placeId, f.id);
    if (!ok) { setMsg("Non sono riuscito a toglierla. Riprova."); return; }
    list.current = list.current.filter((x) => x.id !== f.id);
    onChange(list.current);
    trackFeature("foto_utente", { stato: "rimossa", contesto, risultati: list.current.length });
  };

  const full = foto.length + busy >= FOTO_MAX;
  return (
    <div data-testid={testId}>
      <ul className="flex flex-wrap gap-2">
        {foto.map((f, i) => (
          <li key={f.id} data-testid="foto-mia" className="relative h-20 w-20 overflow-hidden rounded-btn bg-surface">
            <button type="button" onClick={() => setOpen(i)} aria-label={`Guarda la tua foto ${i + 1}`} className="block h-full w-full">
              {/* Foto scattata dall'utente (mai Google). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt="" className="h-full w-full object-cover" />
            </button>
            <button
              type="button"
              data-testid="foto-togli"
              onClick={() => void remove(f)}
              aria-label={`Togli la foto ${i + 1}`}
              className="absolute -right-1.5 -top-1.5 flex h-11 w-11 items-start justify-end p-2.5"
            >
              <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-white"><X size={14} /></span>
            </button>
          </li>
        ))}
        {Array.from({ length: busy }, (_, i) => (
          <li key={`busy-${i}`} data-testid="foto-in-caricamento" className="flex h-20 w-20 items-center justify-center rounded-btn bg-surface text-xs font-display text-text-muted">
            <span className="animate-pulse">Carico…</span>
          </li>
        ))}
        {!full && (
          <li>
            <label
              data-testid="foto-aggiungi"
              className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-btn border border-dashed border-brand/40 bg-white text-center text-[11px] font-display font-semibold leading-tight text-brand active:scale-95"
            >
              <Camera size={20} aria-hidden />
              {foto.length === 0 ? "Aggiungi foto" : "Un'altra"}
              {/* Niente "capture": il telefono propone sia la fotocamera sia la galleria. */}
              <input
                ref={input}
                type="file"
                accept="image/*"
                multiple
                aria-label="Aggiungi le tue foto"
                className="sr-only"
                onChange={(e) => void add(e.target.files)}
              />
            </label>
          </li>
        )}
      </ul>
      {msg && <p role="alert" data-testid="foto-errore" className="mt-1.5 text-xs font-sans text-error">{msg}</p>}
      {open != null && foto[open] && (
        <FotoLightbox slides={foto.map((f) => ({ url: f.url, label: "La tua foto" }))} start={open} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}

/** Le foto pubbliche degli altri sul locale, ciascuna con "Foto di <nome>". */
export function FotoCommunityStrip({ foto }: { foto: FotoCommunity[] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (foto.length === 0) return null;
  const slides = foto.map((f) => ({ url: f.url, label: fotoLabel(f.autore) }));
  return (
    <div data-testid="foto-community" className="mt-4">
      <p className="font-display text-sm font-semibold text-text">Foto dei membri</p>
      <ul className="-mx-5 mt-2 flex snap-x gap-2 overflow-x-auto px-5 pb-1">
        {foto.map((f, i) => (
          <li key={f.id} className="w-28 shrink-0 snap-start">
            <button type="button" data-testid="foto-community-foto" onClick={() => setOpen(i)} aria-label={`Guarda: ${slides[i].label}`} className="block h-28 w-28 overflow-hidden rounded-card bg-surface active:scale-[0.98]">
              {/* Foto scattata da un utente (mai Google), dal nostro server. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
            <p data-testid="foto-community-autore" className="mt-1 truncate text-[11px] font-sans text-text-muted">{slides[i].label}</p>
          </li>
        ))}
      </ul>
      {open != null && <FotoLightbox slides={slides} start={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
