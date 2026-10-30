"use client";

import { useEffect, useState } from "react";
import { giornoLeggibile, pulisciOmaggio, type Omaggio } from "@/lib/omaggio";
import { seiAlLocale } from "@/lib/visita-vista";
import { trackFeature } from "@/lib/track";

// "Grazie di essere tornato" (PROPOSTE.md 12) nella scheda di un locale segnato "Ci sono stato".
// Il titolare verificato offre un piccolo omaggio (un caffè, il dolce) dalla 2ª o 3ª visita.
// Prima della soglia: una riga che invoglia a tornare. Dalla soglia: "Mostralo al tavolo", che
// apre la schermata da mostrare al personale solo se il telefono è al locale, con il codice del giorno.
// Un omaggio ogni 30 giorni per locale (controllo sul server, /api/omaggio).

type Schermata = { testo: string; giorno: string; codice: string; volta: number };

export default function OmaggioScheda({ place, visite, coords }: { place: { id: string; name: string }; visite: number | null; coords: { lat: number; lng: number } | null }) {
  const [info, setInfo] = useState<{ id: string; omaggio: Omaggio | null } | null>(null);
  const [stato, setStato] = useState<"fermo" | "cerco" | "lontano" | "senza" | "errore">("fermo");
  const [avviso, setAvviso] = useState<string | null>(null);
  const [schermata, setSchermata] = useState<Schermata | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/ristoratore/serate?id=${encodeURIComponent(place.id)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setInfo({ id: place.id, omaggio: j?.verificato ? pulisciOmaggio(j.omaggio?.testo, j.omaggio?.soglia) : null }))
      .catch(() => { /* senza rete: niente riga */ });
    return () => ctrl.abort();
  }, [place.id]);

  useEffect(() => {
    if (!schermata) return;
    // In cattura e fermato qui: Esc chiude solo la schermata, non anche la scheda del locale sotto.
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setSchermata(null); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [schermata]);

  const omaggio = info?.id === place.id ? info.omaggio : null;
  if (!omaggio || visite == null) return null;

  if (visite < omaggio.soglia) {
    return (
      <p data-testid="omaggio-scheda" className="mt-2 font-sans text-xs text-text-muted">
        <span aria-hidden>🎁 </span>Alla {omaggio.soglia}ª visita il locale ti offre <strong className="font-semibold text-text">{omaggio.testo}</strong>
      </p>
    );
  }

  const mostra = async () => {
    setStato("cerco");
    setAvviso(null);
    const qui = await seiAlLocale(coords);
    if (qui !== "si") { setStato(qui); return; }
    try {
      const r = await fetch("/api/omaggio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: place.id, visite }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && typeof j.codice === "string") {
        setSchermata({ testo: j.testo, giorno: j.giorno, codice: j.codice, volta: j.volta });
        setStato("fermo");
        if (j.nuovo) trackFeature("omaggio", { stato: "mostrato" });
        return;
      }
      setAvviso(r.status === 409 && j.usatoIl ? `Già usato il ${giornoLeggibile(j.usatoIl)}: torna disponibile dal ${giornoLeggibile(j.prossimo)}.` : r.status === 403 ? `Si apre alla ${omaggio.soglia}ª visita segnata.` : (j.error ?? "Non riesco ad aprirlo. Riprova tra poco."));
      setStato("errore");
    } catch {
      setAvviso("Senza rete non riesco ad aprirlo. Riprova tra poco.");
      setStato("errore");
    }
  };

  return (
    <>
      <div data-testid="omaggio-scheda" className="mt-2 rounded-card bg-accent-light px-3 py-2">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 font-sans text-sm text-text">
            <span aria-hidden>🎁 </span>Il locale ti offre <strong className="font-semibold">{omaggio.testo}</strong>
          </p>
          <button type="button" data-testid="omaggio-mostra" onClick={mostra} disabled={stato === "cerco"} className="min-h-10 shrink-0 rounded-pill bg-accent px-3 text-sm font-display font-semibold text-white active:scale-95 disabled:opacity-60">
            {stato === "cerco" ? "Controllo…" : "Mostralo al tavolo"}
          </button>
        </div>
        {(stato === "lontano" || stato === "senza" || avviso) && (
          <p role="status" data-testid="omaggio-avviso" className="mt-1 font-sans text-xs text-text-muted">
            {stato === "lontano" ? "Si apre quando sei al locale: il telefono non ti vede lì." : stato === "senza" ? "Si apre al locale: serve la posizione, solo per questo controllo (non la salviamo)." : avviso}
          </p>
        )}
      </div>
      {schermata && (
        <div role="dialog" aria-modal="true" aria-label="Omaggio da mostrare al tavolo" data-testid="omaggio-schermata" className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-brand px-6 text-center text-white">
          <p className="text-6xl" aria-hidden>🎁</p>
          <p className="mt-4 font-display text-sm font-semibold uppercase tracking-wider text-white/70">Grazie di essere tornato</p>
          <h2 className="mt-2 font-title text-3xl font-semibold leading-tight">{schermata.testo.charAt(0).toUpperCase() + schermata.testo.slice(1)}</h2>
          <p className="mt-1 font-sans text-base text-white/90">offerto da {place.name} · {schermata.volta}ª visita</p>
          <p data-testid="omaggio-codice" aria-label={`Codice di oggi: ${schermata.codice.split("").join(" ")}`} className="mt-8 rounded-card bg-white px-6 py-3 font-mono text-4xl font-bold tracking-[0.3em] text-brand">{schermata.codice}</p>
          <p className="mt-3 font-sans text-sm text-white/80">Oggi, {giornoLeggibile(schermata.giorno)} · il personale ha lo stesso codice</p>
          <button type="button" data-testid="omaggio-chiudi" onClick={() => setSchermata(null)} className="mt-10 min-h-11 rounded-pill border border-white/60 px-6 font-display font-semibold text-white active:scale-95">
            Chiudi
          </button>
        </div>
      )}
    </>
  );
}
