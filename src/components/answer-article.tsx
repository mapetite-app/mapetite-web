"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUp } from "lucide-react";
import { getCategoryEmoji } from "@/lib/emoji";
import type { Place } from "@/app/mappa/map-view";
import PlacePhoto from "@/components/place-photo";
import { PHOTO_CARDS, googleLine, metaLine, type ListDetails } from "@/components/bottom-sheet";

// Risposta della ricerca "come un articolo" (Places, places-02): la richiesta,
// cosa ho capito, un titolo grande e ogni locale raccontato in due righe
// (verdetto + perché è adatto) sopra una foto grande. In fondo, fisso,
// "Fai un'altra domanda". Usa solo dati già arrivati: nessuna chiamata in più.
export default function AnswerArticle({
  title,
  understood,
  places,
  details,
  loadingVerdicts,
  origin,
  isSaved,
  onSave,
  onSelect,
  onAsk,
  onClose,
}: {
  title: string;
  understood: string[];
  places: Place[];
  details: Record<string, ListDetails | undefined> | undefined;
  loadingVerdicts: boolean;
  origin: { lat: number; lng: number } | null;
  isSaved?: (id: string) => boolean;
  onSave?: (place: Place) => void;
  onSelect: (place: Place) => void;
  onAsk?: (q: string) => void;
  onClose: () => void;
}) {
  const [followUp, setFollowUp] = useState("");
  // Il tasto "indietro" del telefono chiude l'articolo, non la pagina.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  useEffect(() => {
    window.history.pushState({ articolo: true }, "");
    const onPop = () => onCloseRef.current();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const close = () => {
    if (window.history.state?.articolo) window.history.back();
    else onClose();
  };

  const n = places.length;
  const intro = `${n === 1 ? "Ho scelto un posto" : `Ho scelto ${n} posti`} per te${understood.length > 0 ? `: ${understood.map((u) => u.charAt(0).toLowerCase() + u.slice(1)).join(", ")}` : ""}.`;

  return (
    <div
      data-testid="articolo"
      role="dialog"
      aria-label={title}
      className="fixed inset-x-0 top-0 z-40 flex flex-col bg-surface md:top-14"
      style={{ bottom: "var(--nav-height-mobile)" }}
    >
      <div className="flex items-center px-3 pt-3">
        <button type="button" onClick={close} aria-label="Torna alla mappa" className="flex min-h-11 items-center gap-1.5 rounded-pill bg-white pl-3 pr-4 text-sm font-display font-semibold text-brand shadow-card active:scale-95">
          <ArrowLeft size={18} aria-hidden /> Mappa
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-28">
        <div className="mx-auto max-w-xl">
          <p className="ml-auto mt-3 w-fit max-w-[85%] rounded-card bg-brand/5 px-4 py-2 text-sm font-sans text-text first-letter:uppercase">{title}</p>
          <p data-testid="articolo-intro" className="mt-4 text-[15px] font-sans leading-relaxed text-text">{intro}</p>
          <hr className="my-5 border-border" />
          <h2 className="font-title text-3xl in-data-[titoli=serif]:text-4xl font-semibold leading-tight text-brand first-letter:uppercase">{title}</h2>
          {loadingVerdicts && (
            <p className="mt-2 flex items-center gap-2 text-xs font-sans text-text-muted">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-border border-t-accent" />
              Sto scrivendo perché li ho scelti…
            </p>
          )}

          <ol className="mt-6 space-y-9">
            {places.map((place, i) => {
              const d = details?.[place.id];
              const saved = isSaved?.(place.id) ?? false;
              const photo = i < PHOTO_CARDS ? d?.photoRef : null;
              return (
                <li key={place.id} data-testid="articolo-locale">
                  <button type="button" onClick={() => onSelect(place)} className="flex w-full items-center gap-2 text-left">
                    <span className="text-xl leading-none" aria-hidden>{getCategoryEmoji(place.category, place.name)}</span>
                    <span className="font-title text-lg in-data-[titoli=serif]:text-xl font-semibold leading-snug text-brand">{place.name}</span>
                  </button>
                  {d?.verdict || d?.matchReason ? (
                    <p className="mt-1.5 text-[15px] font-sans leading-relaxed text-text">
                      {d?.verdict}
                      {d?.verdict && d?.matchReason ? " " : ""}
                      {d?.matchReason && <span className="text-text-muted">{d.matchReason}</span>}
                    </p>
                  ) : loadingVerdicts ? (
                    <span aria-label="Sto preparando il verdetto" className="mt-2 block space-y-1.5">
                      <span className="block h-3 w-11/12 animate-pulse rounded-pill bg-border" />
                      <span className="block h-3 w-3/5 animate-pulse rounded-pill bg-border" />
                    </span>
                  ) : googleLine(d) ? (
                    <p data-testid="riga-google" className="mt-1.5 line-clamp-3 text-[15px] font-sans leading-relaxed text-text-muted">{googleLine(d)}</p>
                  ) : null}

                  <div className="relative mt-3 overflow-hidden rounded-card bg-brand shadow-card">
                    <button type="button" onClick={() => onSelect(place)} aria-label={`Apri ${place.name}`} className="block w-full text-left">
                      {photo ? (
                        <PlacePhoto
                          photoRef={photo}
                          alt={place.name}
                          width={800}
                          className="h-52 w-full object-cover"
                          fallback={<span className="flex h-28 items-center justify-center text-4xl">{getCategoryEmoji(place.category, place.name)}</span>}
                        />
                      ) : (
                        <span className="flex h-20 items-center px-4 text-3xl" aria-hidden>{getCategoryEmoji(place.category, place.name)}</span>
                      )}
                      <span className="block bg-white px-4 py-3">
                        <span className="block truncate font-mono text-[11px] uppercase tracking-wider text-text-muted">{metaLine(place, d, origin)}</span>
                        {(d?.openNow === true || (d?.goFor ?? []).length > 0) && (
                          <span className="mt-2 flex flex-wrap gap-1.5">
                            {d?.openNow === true && (
                              <span className="rounded-pill bg-success/10 px-2 py-0.5 text-[11px] font-display font-medium text-success">Aperto ora</span>
                            )}
                            {(d?.goFor ?? []).slice(0, 2).map((c) => (
                              <span key={c} className="rounded-pill bg-accent-light px-2 py-0.5 text-[11px] font-display font-medium text-accent">{c}</span>
                            ))}
                          </span>
                        )}
                      </span>
                    </button>
                    {onSave && (
                      <button
                        type="button"
                        onClick={() => onSave(place)}
                        aria-pressed={saved}
                        aria-label={saved ? `${place.name} è tra i salvati` : `Salva ${place.name}`}
                        className="absolute right-3 top-3 flex min-h-9 items-center gap-1.5 rounded-pill bg-white px-3 text-xs font-display font-semibold text-brand shadow-card active:scale-95"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} aria-hidden>
                          <path strokeLinejoin="round" d="M6 3.75h12a.75.75 0 0 1 .75.75v16.19l-6.75-4.5-6.75 4.5V4.5A.75.75 0 0 1 6 3.75Z" />
                        </svg>
                        {saved ? "Salvato" : "Salva"}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          {n === 0 && <p className="mt-6 text-sm text-text-muted">Nessun locale con questi filtri: togline qualcuno dalla mappa.</p>}
        </div>
      </div>

      {onAsk && (
        <form
          className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-surface via-surface to-transparent px-4 pb-3 pt-6"
          onSubmit={(e) => {
            e.preventDefault();
            const q = followUp.trim();
            if (q.length < 3) return;
            if (window.history.state?.articolo) window.history.back();
            onAsk(q);
          }}
        >
          <div className="mx-auto flex max-w-xl items-center gap-2 rounded-pill border border-border bg-white pl-4 pr-1 shadow-float">
            <input
              type="search"
              enterKeyHint="search"
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              placeholder="Fai un'altra domanda"
              aria-label="Fai un'altra domanda"
              className="min-h-12 min-w-0 flex-1 bg-transparent text-base font-sans text-text placeholder:text-text-muted focus:outline-none"
            />
            <button type="submit" disabled={followUp.trim().length < 3} aria-label="Cerca" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white active:scale-95 disabled:opacity-40">
              <ArrowUp size={18} />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
