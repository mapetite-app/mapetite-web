"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getCategoryEmoji } from "@/lib/emoji";
import { categoryLabel } from "@/lib/category-label";
import { cityFromAddress } from "@/lib/city";
import { distanceLabel } from "@/lib/distance";
import { track } from "@/lib/track";
import { isStateTag } from "@/lib/tags";
import {
  STATE_DONE,
  STATE_WANT,
  citiesOf,
  collectionsOf,
  directionsUrl,
  matches,
  pickThree,
  type Choices,
  type SavedSpot,
} from "@/lib/stasera";

type Geo = "idle" | "cerco" | "ok" | "negata" | "assente";
type Pos = { lat: number; lng: number };

// Lettura dei salvati come in /mappa (saved_places → places), più il verdetto già in cache
// (place_synthesis, per Google Place ID). Nessuna chiamata a Google o all'AI.
async function loadSaved(userId: string): Promise<{ spots: SavedSpot[]; verdicts: Record<string, string> }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("saved_places")
    .select("tags, note, places(id, name, category, address, lat, lng, google_place_id)")
    .eq("user_id", userId);
  if (error) throw error;
  const spots: SavedSpot[] = [];
  for (const row of data ?? []) {
    const p = row.places as unknown as {
      id: string; name: string; category: string | null; address: string | null;
      lat: number | null; lng: number | null; google_place_id: string | null;
    } | null;
    if (!p?.id || !p.name) continue;
    spots.push({
      id: p.id,
      name: p.name,
      category: p.category ?? null,
      address: p.address ?? null,
      lat: p.lat ?? null,
      lng: p.lng ?? null,
      googlePlaceId: p.google_place_id ?? null,
      tags: ((row.tags as string[] | null) ?? []).filter((t) => typeof t === "string"),
      note: (row.note as string | null)?.trim() || null,
    });
  }
  const verdicts: Record<string, string> = {};
  const googleIds = spots.map((s) => s.googlePlaceId).filter((g): g is string => !!g);
  if (googleIds.length > 0) {
    // Il verdetto è un di più: se la lettura fallisce, le proposte restano senza.
    const { data: rows, error: synthError } = await supabase
      .from("place_synthesis")
      .select("place_id, verdict")
      .in("place_id", googleIds);
    if (synthError) console.error("[stasera] lettura place_synthesis fallita:", synthError);
    for (const r of rows ?? []) {
      const v = (r.verdict as string | null)?.trim();
      if (v) verdicts[r.place_id as string] = v;
    }
  }
  return { spots, verdicts };
}

function Pill({ active, onClick, children, testId }: { active: boolean; onClick: () => void; children: React.ReactNode; testId?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      data-testid={testId}
      className={`min-h-12 rounded-pill px-5 font-display text-[15px] font-semibold transition-[transform,background-color] duration-150 active:scale-[0.97] ${
        active ? "bg-accent text-white shadow-float" : "border border-white/25 bg-white/10 text-white"
      }`}
    >
      {children}
    </button>
  );
}

function SpotCard({ spot, verdict, pos }: { spot: SavedSpot; verdict: string | null; pos: Pos | null }) {
  const emoji = getCategoryEmoji(spot.category, spot.name);
  const city = cityFromAddress(spot.address);
  const dist = pos && spot.lat != null && spot.lng != null ? distanceLabel(pos, { lat: spot.lat, lng: spot.lng }) : null;
  const where = [categoryLabel(spot.category), city, dist ? `a ${dist}` : null].filter(Boolean).join(" · ");
  const want = spot.tags.includes(STATE_WANT);
  const done = spot.tags.includes(STATE_DONE);
  // Raccolte = tag scritti dall'utente: niente stati né "Com'era?" (👍/👎 non sono raccolte).
  const raccolte = spot.tags.filter((t) => !isStateTag(t) && t.trim());
  const mapHref = spot.lat != null && spot.lng != null ? `/mappa?salvato=${spot.id}` : "/mappa?vista=salvati";

  return (
    <li data-testid="stasera-proposta" data-id={spot.id} className="rounded-card bg-white p-4 text-text shadow-float">
      {/* Semplificare (18/10): nome e foto aprono il posto sulla mappa; sotto resta un solo pulsante, Percorso. */}
      <Link href={mapHref} data-testid="stasera-mappa" aria-label={`Apri ${spot.name} nella mappa`} className="flex items-start gap-3 active:opacity-80">
        <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-btn bg-accent-light text-3xl leading-none">
          {emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-title text-lg font-semibold leading-snug text-brand">{spot.name}</h2>
          {where && <p className="mt-0.5 text-sm text-text-muted">{where}</p>}
          {(want || done) && (
            <span
              data-testid="stasera-stato"
              className={`mt-1.5 inline-block rounded-pill px-2.5 py-0.5 font-display text-xs font-semibold ${want ? "bg-accent text-white" : "bg-surface text-text-muted"}`}
            >
              {want ? "📌 Voglio andarci" : "✓ Ci sono stato"}
            </span>
          )}
        </div>
        <ChevronRight aria-hidden size={20} className="mt-1 shrink-0 text-text-muted" />
      </Link>

      {spot.note && (
        <p data-testid="stasera-nota" className="mt-3 border-l-2 border-accent pl-3 text-[15px] italic text-text">
          “{spot.note}”
          <span className="mt-0.5 block text-xs not-italic text-text-muted">La tua nota</span>
        </p>
      )}

      {verdict && (
        <div data-testid="stasera-verdetto" className="mt-3 rounded-btn bg-surface px-3 py-2.5">
          <p className="font-display text-[11px] font-semibold uppercase tracking-wider text-brand">Il verdetto Mapetite</p>
          <p className="mt-0.5 text-sm text-text">{verdict}</p>
        </div>
      )}

      {raccolte.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {raccolte.map((t) => (
            <span key={t} className="rounded-pill bg-accent-light px-2.5 py-0.5 font-display text-xs font-medium text-accent">{t}</span>
          ))}
        </div>
      )}

      <a
        href={directionsUrl(spot)}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="stasera-percorso"
        onClick={() => track("percorso", { id: spot.id, lat: spot.lat ?? undefined, lng: spot.lng ?? undefined }, { fonte: "stasera" })}
        className="mt-4 flex min-h-11 items-center justify-center rounded-pill bg-brand font-display text-sm font-semibold text-white active:scale-[0.98]"
      >
        Percorso
      </a>
    </li>
  );
}

export default function StaseraView({ userId }: { userId: string }) {
  const [spots, setSpots] = useState<SavedSpot[] | null>(null);
  const [verdicts, setVerdicts] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState(false);
  const [occasion, setOccasion] = useState<string | null>(null);
  const [onlyNew, setOnlyNew] = useState(true);
  const [wantNear, setWantNear] = useState(false);
  const [city, setCity] = useState<string | null>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const [geo, setGeo] = useState<Geo>("idle");
  const [proposals, setProposals] = useState<SavedSpot[] | null>(null);
  const [shown, setShown] = useState<Set<string>>(new Set());
  const [restarted, setRestarted] = useState(false);

  const load = useCallback(() => {
    let alive = true;
    loadSaved(userId).then(
      (r) => { if (alive) { setSpots(r.spots); setVerdicts(r.verdicts); setLoadError(false); } },
      (e) => { console.error("[stasera] lettura salvati fallita:", e); if (alive) setLoadError(true); },
    );
    return () => { alive = false; };
  }, [userId]);
  useEffect(() => load(), [load]);

  const askPosition = useCallback(() => {
    if (!("geolocation" in navigator)) { setGeo("assente"); setWantNear(false); return; }
    setGeo("cerco");
    setWantNear(true);
    setCity(null);
    navigator.geolocation.getCurrentPosition(
      (p) => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude }); setGeo("ok"); },
      (err) => { setGeo(err.code === err.PERMISSION_DENIED ? "negata" : "assente"); setWantNear(false); },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
  }, []);

  // Se la posizione è già permessa, "Vicino a me" si accende da solo (nessuna richiesta a sorpresa).
  useEffect(() => {
    let alive = true;
    navigator.permissions?.query({ name: "geolocation" as PermissionName })
      .then((st) => { if (alive && st.state === "granted") askPosition(); })
      .catch(() => {});
    return () => { alive = false; };
  }, [askPosition]);

  const choices: Choices = useMemo(
    () => ({ occasion, onlyNew, near: wantNear && pos ? pos : null, city }),
    [occasion, onlyNew, wantNear, pos, city],
  );
  const collections = useMemo(() => collectionsOf(spots ?? []), [spots]);
  const cities = useMemo(() => citiesOf(spots ?? []), [spots]);
  const matchCount = useMemo(() => (spots ?? []).filter((s) => matches(s, choices)).length, [spots, choices]);

  const propose = () => {
    if (!spots) return;
    const picks = pickThree(spots, choices);
    setProposals(picks);
    setShown(new Set(picks.map((p) => p.id)));
    setRestarted(false);
    window.scrollTo({ top: 0 });
  };

  const more = () => {
    if (!spots || !proposals) return;
    let picks = pickThree(spots, choices, shown);
    let nextShown = new Set([...shown, ...picks.map((p) => p.id)]);
    let again = false;
    if (picks.length === 0) {
      // Visti tutti: si ricomincia il giro, evitando di riproporre subito gli stessi.
      picks = pickThree(spots, choices, new Set(proposals.map((p) => p.id)));
      if (picks.length === 0) picks = pickThree(spots, choices);
      nextShown = new Set(picks.map((p) => p.id));
      again = true;
    }
    setProposals(picks);
    setShown(nextShown);
    setRestarted(again);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const summary = [occasion ?? "Qualsiasi occasione", city ? `a ${city}` : choices.near ? "vicino a te" : "ovunque", onlyNew ? "mai provati" : "anche già visitati"].join(" · ");

  return (
    <main data-testid="stasera" className="-mb-[calc(var(--nav-height-mobile)+var(--nav-sporgenza))] min-h-dvh bg-brand pb-[var(--nav-height-mobile)] text-white md:mb-0 md:min-h-[calc(100dvh-3.5rem)] md:pb-0">
      <div className="mx-auto max-w-md px-4 pb-32 pt-6">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/profilo" aria-label="Torna al profilo" className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-2xl text-white/90 active:bg-white/10">
            ←
          </Link>
          <span className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Dai tuoi salvati</span>
          <span className="w-11" aria-hidden />
        </div>

        {loadError ? (
          <div className="mt-16 text-center">
            <p className="font-display text-lg font-semibold">Non riesco a leggere i tuoi salvati.</p>
            <p className="mt-1 text-sm text-white/75">Controlla la connessione e riprova.</p>
            <button type="button" onClick={() => { setLoadError(false); load(); }} className="mt-4 min-h-11 rounded-pill bg-accent px-6 font-display text-sm font-semibold text-white">
              Riprova
            </button>
          </div>
        ) : spots === null ? (
          <div aria-busy="true" aria-label="Carico i tuoi salvati" className="space-y-4">
            <div className="h-20 w-3/4 animate-pulse rounded-card bg-white/10" />
            <div className="h-12 w-full animate-pulse rounded-pill bg-white/10" />
            <div className="h-12 w-2/3 animate-pulse rounded-pill bg-white/10" />
          </div>
        ) : spots.length === 0 ? (
          <div data-testid="stasera-vuoto" className="mt-10 text-center">
            <span aria-hidden className="text-5xl">🍽️</span>
            <h1 className="mt-4 font-display text-[28px] font-bold leading-tight">Stasera dove andiamo?</h1>
            <p className="mx-auto mt-3 max-w-xs text-[15px] text-white/80">
              Qui scegli tra i posti che hai salvato. Non ne hai ancora nessuno: cercane uno o porta qui quelli che hai già su Google Maps e Instagram.
            </p>
            <div className="mt-6 flex flex-col items-center gap-2">
              <Link href="/mappa" className="flex min-h-12 w-full max-w-xs items-center justify-center rounded-pill bg-accent font-display font-semibold text-white">
                Cerca un locale
              </Link>
              <Link href="/importa" className="flex min-h-12 w-full max-w-xs items-center justify-center rounded-pill border border-white/30 font-display font-semibold text-white">
                Importa i tuoi posti
              </Link>
            </div>
          </div>
        ) : proposals ? (
          <section aria-label="Proposte per stasera">
            <h1 className="font-display text-[28px] font-bold leading-tight">
              {proposals.length === 1 ? "Ecco un'idea per stasera" : `Ecco ${proposals.length} idee per stasera`}
            </h1>
            <p data-testid="stasera-riepilogo" className="mt-1 text-sm text-white/75">{summary}</p>
            {restarted && <p data-testid="stasera-ricomincio" className="mt-2 text-sm text-white/90">Li hai visti tutti: ricomincio il giro.</p>}
            <ul className="mt-5 space-y-3">
              {proposals.map((s) => (
                <SpotCard key={s.id} spot={s} verdict={s.googlePlaceId ? verdicts[s.googlePlaceId] ?? null : null} pos={pos} />
              ))}
            </ul>
            <div className="sticky bottom-[var(--nav-height-mobile)] -mx-4 mt-5 flex gap-2 bg-gradient-to-t from-brand from-60% to-transparent px-4 pb-[calc(0.75rem+var(--nav-sporgenza))] pt-6">
              <button
                type="button"
                onClick={() => setProposals(null)}
                className="min-h-12 flex-1 rounded-pill border border-white/30 bg-brand font-display font-semibold text-white active:scale-[0.98]"
              >
                Cambia scelte
              </button>
              {matchCount > proposals.length && (
                <button
                  type="button"
                  onClick={more}
                  data-testid="stasera-altri"
                  className="min-h-12 flex-1 rounded-pill bg-accent font-display font-semibold text-white shadow-float active:scale-[0.98]"
                >
                  Altri 3
                </button>
              )}
            </div>
          </section>
        ) : (
          <section aria-label="Le tue scelte">
            <h1 className="font-display text-[32px] font-bold leading-[1.1]">Stasera dove andiamo?</h1>
            <p className="mt-2 text-[15px] text-white/75">{spots.length === 1 ? "Tre tocchi e scegli: per ora hai un solo salvato." : `Tre tocchi e scegli tra i tuoi ${spots.length} salvati.`}</p>

            <h2 className="mb-2.5 mt-7 font-display text-sm font-semibold text-white/70">Che occasione?</h2>
            <div data-testid="stasera-occasione" className="flex flex-wrap gap-2">
              <Pill active={occasion === null} onClick={() => setOccasion(null)}>Qualsiasi</Pill>
              {collections.slice(0, 7).map((t) => (
                <Pill key={t} active={occasion === t} onClick={() => setOccasion(occasion === t ? null : t)}>{t}</Pill>
              ))}
            </div>
            {collections.length === 0 && (
              <p className="mt-2 text-xs text-white/60">Aggiungi tag ai tuoi salvati (es. Romantico, Con amici) per scegliere anche l&apos;occasione.</p>
            )}

            <h2 className="mb-2.5 mt-6 font-display text-sm font-semibold text-white/70">Dove?</h2>
            <div data-testid="stasera-distanza" className="flex flex-wrap gap-2">
              <Pill active={wantNear} onClick={askPosition}>{geo === "cerco" ? "Cerco dove sei…" : "📍 Vicino a me"}</Pill>
              {cities.length > 1 && cities.slice(0, 3).map((c) => (
                <Pill key={c} active={!wantNear && city === c} onClick={() => { setWantNear(false); setCity(city === c ? null : c); }}>{c}</Pill>
              ))}
              <Pill active={!wantNear && !city} onClick={() => { setWantNear(false); setCity(null); }}>Ovunque</Pill>
            </div>
            {geo === "negata" && (
              <p data-testid="stasera-posizione-negata" role="status" className="mt-2 text-xs text-white/75">
                Non vedo dove sei: per «Vicino a me» consenti la posizione a Mapetite nelle impostazioni del browser. Intanto cerco ovunque.
              </p>
            )}
            {geo === "assente" && (
              <p role="status" className="mt-2 text-xs text-white/75">Posizione non disponibile adesso: intanto cerco ovunque.</p>
            )}

            <h2 className="mb-2.5 mt-6 font-display text-sm font-semibold text-white/70">Che voglia?</h2>
            <div data-testid="stasera-novita" className="flex flex-wrap gap-2">
              <Pill active={onlyNew} onClick={() => setOnlyNew(true)}>📌 Mai provati</Pill>
              <Pill active={!onlyNew} onClick={() => setOnlyNew(false)}>Anche già visitati</Pill>
            </div>

            {matchCount === 0 ? (
              <div data-testid="stasera-nessuno" className="mt-8 rounded-card bg-white/10 p-4">
                <p className="font-display font-semibold">Nessun salvato con queste scelte.</p>
                <p className="mt-0.5 text-sm text-white/75">Allarga con un tocco:</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {occasion && (
                    <button type="button" data-testid="stasera-allarga" onClick={() => setOccasion(null)} className="min-h-11 rounded-pill bg-white px-4 font-display text-sm font-semibold text-brand">
                      Qualsiasi occasione
                    </button>
                  )}
                  {(choices.near || city) && (
                    <button type="button" data-testid="stasera-allarga" onClick={() => { setWantNear(false); setCity(null); }} className="min-h-11 rounded-pill bg-white px-4 font-display text-sm font-semibold text-brand">
                      Cerca ovunque
                    </button>
                  )}
                  {onlyNew && (
                    <button type="button" data-testid="stasera-allarga" onClick={() => setOnlyNew(false)} className="min-h-11 rounded-pill bg-white px-4 font-display text-sm font-semibold text-brand">
                      Anche già visitati
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="sticky bottom-[var(--nav-height-mobile)] -mx-4 mt-4 bg-gradient-to-t from-brand from-70% to-transparent px-4 pb-[calc(0.75rem+var(--nav-sporgenza))] pt-4">
                <button
                  type="button"
                  onClick={propose}
                  data-testid="stasera-proponi"
                  className="min-h-14 w-full rounded-pill bg-accent font-display text-[17px] font-semibold text-white shadow-float active:scale-[0.98]"
                >
                  {matchCount >= 3 ? "Proponimi 3 posti" : matchCount === 1 ? "Proponimi l'unico posto" : `Proponimi i ${matchCount} posti`}
                </button>
                <p data-testid="stasera-conteggio" className="mt-2 text-center text-xs text-white/60">
                  {matchCount === 1 ? "1 salvato" : `${matchCount} salvati`} con queste scelte
                </p>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
