"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { getCategoryEmoji } from "@/lib/emoji";
import { dayKey, daysAgoKey, dateLabel, type Voto } from "@/lib/diario";
import type { FotoUtente } from "@/lib/foto-utenti";
import { cambiaVisibilita } from "@/lib/foto-utenti-write";
import { trackFeature } from "@/lib/track";
import { FotoMieEditor } from "@/components/foto-utenti";

// Foglio leggero "Com'è andata?" (piano 4.4): dopo "Ci sono stato" (o da "Modifica" nel diario)
// chiede quando, il voto (👍/👎, lo stesso "Com'era?" della scheda) e una nota privata.
// Tutto saltabile. Chi lo apre decide dove scrivere (onSave).
// Foto (piano 4.4): 1–3 foto tue, caricate subito (senza aspettare "Salva"); private come la nota,
// a meno di scegliere "Mostrale nella scheda del locale" (stesse regole delle recensioni).
export type DiarioValori = { date: string | null; voto: Voto | null; note: string };

export type DiarioFoto = {
  userId: string;
  placeId: string; // UUID Supabase
  initial?: FotoUtente[]; // assente = si leggono da /api/foto-utenti
  onChange?: (foto: FotoUtente[]) => void;
  contesto: string;
};

const subscribeNothing = () => () => {};

export default function DiarioFoglio({
  place,
  initial,
  withDate,
  mode,
  onEditNote,
  onSave,
  onClose,
  foto,
}: {
  place: { name: string; category: string | null };
  initial: { date: string | null; voto: Voto | null; note: string | null };
  withDate: boolean; // false finché la colonna visited_at non esiste
  mode: "nuova" | "modifica";
  // Nella scheda della mappa la nota si scrive con il foglio "Modifica" che c'è già (stessi dati).
  onEditNote?: () => void;
  onSave: (v: DiarioValori) => Promise<boolean>;
  onClose: () => void;
  foto?: DiarioFoto;
}) {
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const today = dayKey(new Date());
  const yesterday = daysAgoKey(1);
  const [date, setDate] = useState<string | null>(initial.date);
  const [voto, setVoto] = useState<Voto | null>(initial.voto);
  const [note, setNote] = useState(initial.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const other = date !== null && date !== today && date !== yesterday;
  const [showPicker, setShowPicker] = useState(other);
  // Foto: null = in lettura; pronte false = migrazione delle foto non applicata (sezione nascosta).
  const [fotoList, setFotoList] = useState<FotoUtente[] | null>(foto?.initial ?? null);
  const [fotoPronte, setFotoPronte] = useState(true);
  const [condividi, setCondividi] = useState(() => (foto?.initial ?? []).some((f) => f.pubblica));
  const [visErr, setVisErr] = useState(false);
  const fotoPlace = foto && !foto.initial ? foto.placeId : null;

  useEffect(() => {
    if (!fotoPlace) return;
    const ctrl = new AbortController();
    fetch(`/api/foto-utenti?place=${encodeURIComponent(fotoPlace)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { foto: FotoUtente[]; pronte: boolean } | null) => {
        setFotoList(d?.foto ?? []);
        setFotoPronte(d?.pronte ?? false);
        setCondividi((d?.foto ?? []).some((f) => f.pubblica));
      })
      .catch(() => { /* rete assente o foglio chiuso: niente sezione foto */ });
    return () => ctrl.abort();
  }, [fotoPlace]);

  if (!mounted) return null;

  const save = async (): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    setError(false);
    const ok = await onSave({ date: withDate ? date : initial.date, voto, note: note.trim() });
    setBusy(false);
    if (!ok) setError(true);
    return ok;
  };

  const changeFoto = (list: FotoUtente[]) => {
    setFotoList(list);
    foto?.onChange?.(list);
  };

  const toggleCondividi = async () => {
    if (!foto || !fotoList) return;
    const next = !condividi;
    setVisErr(false);
    setCondividi(next);
    const ok = await cambiaVisibilita(foto.userId, foto.placeId, next);
    if (!ok) { setCondividi(!next); setVisErr(true); return; }
    changeFoto(fotoList.map((f) => ({ ...f, pubblica: next })));
    trackFeature("foto_utente", { stato: next ? "pubblicate" : "private", contesto: foto.contesto, risultati: fotoList.length });
  };

  const chip = (on: boolean) =>
    `min-h-10 shrink-0 rounded-pill border px-3 text-sm font-display font-semibold active:scale-95 ${on ? "border-brand bg-brand text-white" : "border-border bg-white text-brand"}`;

  return createPortal(
    // Eventi fermati: il pannello trascinabile della mappa sotto non deve prenderli (come BookingSheet).
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape") onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Com'è andata da ${place.name}?`}
        data-testid="diario-foglio"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[1.5rem] bg-bg px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-float"
      >
        <div aria-hidden className="mx-auto mb-2 h-1 w-10 rounded-full bg-border" />
        <div className="flex items-start gap-3">
          <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-btn bg-accent-light text-2xl">
            {getCategoryEmoji(place.category, place.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-display font-semibold uppercase tracking-wide text-accent">
              {mode === "nuova" ? "✓ Ci sei stato" : "Il tuo diario"}
            </p>
            <h2 className="mt-0.5 font-title text-xl font-semibold leading-tight text-text [overflow-wrap:anywhere]">{place.name}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Chiudi" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-text-muted">
            <X size={18} />
          </button>
        </div>

        {withDate && (
          <>
            <p className="mt-4 text-sm font-display font-semibold text-text">Quando ci sei stato?</p>
            <div data-testid="diario-quando" className="mt-2 flex flex-wrap gap-2">
              <button type="button" aria-pressed={date === today} onClick={() => { setDate(today); setShowPicker(false); }} className={chip(date === today)}>Oggi</button>
              <button type="button" aria-pressed={date === yesterday} onClick={() => { setDate(yesterday); setShowPicker(false); }} className={chip(date === yesterday)}>Ieri</button>
              <button type="button" aria-pressed={showPicker} onClick={() => setShowPicker(true)} className={chip(showPicker)}>
                {other ? dateLabel(date!) : "Altro giorno"}
              </button>
              <button type="button" aria-pressed={date === null && !showPicker} onClick={() => { setDate(null); setShowPicker(false); }} className={chip(date === null && !showPicker)}>Non ricordo</button>
            </div>
            {showPicker && (
              <input
                type="date"
                aria-label="Giorno della visita"
                data-testid="diario-data"
                max={today}
                value={date ?? ""}
                onChange={(e) => setDate(e.target.value || null)}
                className="mt-2 min-h-11 w-full rounded-btn border border-border bg-white px-3 text-base text-text"
              />
            )}
          </>
        )}

        <p className="mt-4 text-sm font-display font-semibold text-text">Com&apos;era?</p>
        <div data-testid="diario-voto" className="mt-2 flex gap-2">
          {([["su", "👍 Mi è piaciuto"], ["giu", "👎 Non fa per me"]] as const).map(([v, label]) => (
            <button
              key={v}
              type="button"
              aria-pressed={voto === v}
              onClick={() => setVoto((cur) => (cur === v ? null : v))}
              className={`min-h-11 min-w-0 flex-1 rounded-pill border px-2 text-sm font-display font-semibold active:scale-95 ${voto === v ? "border-accent bg-accent text-white" : "border-border bg-white text-brand"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {foto && fotoPronte && fotoList && (
          <div data-testid="diario-foto" className="mt-4">
            <p className="text-sm font-display font-semibold text-text">
              Le tue foto{" "}
              <span className="font-sans font-normal text-text-muted">
                · {condividi && fotoList.length > 0 ? "visibili nella scheda del locale" : "le vedi solo tu"}
              </span>
            </p>
            <div className="mt-2">
              <FotoMieEditor
                userId={foto.userId}
                placeId={foto.placeId}
                foto={fotoList}
                onChange={changeFoto}
                pubblica={condividi}
                contesto={foto.contesto}
              />
            </div>
            {fotoList.length > 0 && (
              <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-sans text-text">
                <input
                  type="checkbox"
                  data-testid="diario-foto-condividi"
                  checked={condividi}
                  onChange={() => void toggleCondividi()}
                  className="h-5 w-5 shrink-0 accent-brand"
                />
                Mostrale nella scheda del locale (&ldquo;Dalla community&rdquo;)
              </label>
            )}
            {visErr && <p role="alert" className="text-xs text-error">Non sono riuscito a cambiarlo. Riprova.</p>}
          </div>
        )}

        {onEditNote ? (
          <button
            type="button"
            data-testid="diario-scrivi-nota"
            disabled={busy}
            // Prima salva data e voto scelti, poi apre il foglio della nota.
            onClick={() => void save().then((ok) => { if (ok) onEditNote(); })}
            className="mt-4 flex min-h-11 w-full items-center justify-center rounded-pill border border-dashed border-brand/40 px-4 text-sm font-display font-semibold text-brand"
          >
            ✏️ {initial.note ? "Cambia la nota" : "Scrivi una nota"}
          </button>
        ) : (
          <label className="mt-4 block">
            <span className="text-sm font-display font-semibold text-text">Nota <span className="font-sans font-normal text-text-muted">· la vedi solo tu</span></span>
            <textarea
              data-testid="diario-nota"
              value={note}
              maxLength={500}
              rows={3}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Cosa hai preso, con chi eri, cosa rifaresti…"
              className="mt-1.5 w-full resize-none rounded-btn border border-border bg-white px-3 py-2 text-base text-text placeholder:text-text-muted"
            />
          </label>
        )}

        {error && <p role="alert" className="mt-2 text-sm text-error">Non sono riuscito a salvare. Riprova.</p>}
        <button
          type="button"
          data-testid="diario-salva"
          disabled={busy}
          onClick={() => void save()}
          className="mt-4 flex min-h-12 w-full items-center justify-center rounded-pill bg-brand px-4 text-[15px] font-display font-semibold text-white active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? "Salvo…" : "Salva nel diario"}
        </button>
        <button
          type="button"
          data-testid="diario-salta"
          onClick={onClose}
          className="mt-1 flex min-h-11 w-full items-center justify-center text-sm font-display font-semibold text-text-muted"
        >
          {mode === "nuova" ? "Salta" : "Annulla"}
        </button>
      </div>
    </div>,
    document.body,
  );
}
