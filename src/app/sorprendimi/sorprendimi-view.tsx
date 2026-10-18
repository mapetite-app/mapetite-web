"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import PlacePhoto from "@/components/place-photo";
import UtileFeedback from "@/components/utile-feedback";
import { browserClient } from "@/lib/supabase/client-lazy";
import { getCategoryEmoji } from "@/lib/emoji";
import { categoryLabel } from "@/lib/category-label";
import { cityFromAddress } from "@/lib/city";
import { distanceLabel } from "@/lib/distance";
import { cityNear, cityArea } from "@/lib/named-city";
import { quickSavePlace } from "@/lib/quick-save";
import { grantedPosition } from "@/lib/last-view";
import { track, trackFeature } from "@/lib/track";
import { rememberFirme } from "@/lib/catalog-firme";
import { withNext } from "@/lib/next-path";
import {
  loadMemory,
  memoryKey,
  pickCandidates,
  planSurprise,
  saveMemory,
  type Candidate,
  type Prefs,
  type SavedForTaste,
  type SurpriseMemory,
} from "@/lib/sorpresa";

const WANT_TAG = "Da provare";
const VERDICT_TRIES = 2;
const ROMA = cityArea("Roma")!;

type Center = { lat: number; lng: number; radius: number; label: string; precise: boolean };
type Phase = "carico" | "pronto" | "vuoto" | "errore";

// Gusti della persona: salvati (tipo e stato) e preferenze dell'onboarding. Solo letture Supabase.
async function loadTaste(userId: string): Promise<{ saved: (SavedForTaste & { lat: number | null; lng: number | null })[]; prefs: Prefs }> {
  const supabase = await browserClient();
  const [s, p] = await Promise.all([
    supabase.from("saved_places").select("tags, places(category, lat, lng, google_place_id)").eq("user_id", userId),
    supabase.from("profiles").select("cuisines, price_range").eq("id", userId).maybeSingle(),
  ]);
  const saved = (s.data ?? []).map((row) => {
    const pl = row.places as unknown as { category: string | null; lat: number | null; lng: number | null; google_place_id: string | null } | null;
    return {
      googlePlaceId: pl?.google_place_id ?? null,
      category: pl?.category ?? null,
      lat: pl?.lat ?? null,
      lng: pl?.lng ?? null,
      tags: ((row.tags as string[] | null) ?? []).filter((t) => typeof t === "string"),
    };
  });
  const prof = (Array.isArray(p.data) ? p.data[0] : p.data) as { cuisines?: string[] | null; price_range?: string | null } | null;
  const prefs: Prefs = prof ? { cuisines: prof.cuisines ?? [], priceRange: prof.price_range ?? null } : null;
  return { saved, prefs };
}

// Dove cercare: il centro della mappa da cui si arriva; dalla home la città dove sei (se il permesso
// della posizione è già dato: mai chiesto qui), poi la città dove hai più salvati; se no Roma.
async function startCenter(saved: { lat: number | null; lng: number | null }[]): Promise<Center> {
  const params = new URLSearchParams(window.location.search);
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  if (params.get("lat") && params.get("lng") && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    const city = cityNear(lat, lng);
    return { lat, lng, radius: 3000, label: city ? `Zona della mappa · ${city}` : "Zona della mappa", precise: true };
  }
  const here = await grantedPosition();
  if (here) {
    // Una città nota: tutta la città, come dai salvati (stessa memoria della sorpresa, niente chiamate
    // in più a ogni passo). Altrove i 3 km intorno a te.
    const city = cityNear(here.lat, here.lng);
    const area = city ? cityArea(city) : null;
    return city && area ? { ...area, label: city, precise: false } : { ...here, radius: 3000, label: "Vicino a te", precise: true };
  }
  const counts = new Map<string, number>();
  for (const s of saved) {
    if (s.lat == null || s.lng == null) continue;
    const c = cityNear(s.lat, s.lng);
    if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const area = top ? cityArea(top) : null;
  if (top && area) return { ...area, label: top, precise: false };
  return { ...ROMA, label: "Roma", precise: false };
}

export default function SorprendimiView({ userId }: { userId: string | null }) {
  const [phase, setPhase] = useState<Phase>("carico");
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [idx, setIdx] = useState(0);
  const [center, setCenter] = useState<Center | null>(null);
  const [verdicts, setVerdicts] = useState<Record<string, string>>({});
  // Locali per cui il verdetto non è arrivato dopo VERDICT_TRIES richieste: si mostrano i dati Google.
  const [gaveUp, setGaveUp] = useState<Set<string>>(new Set());
  const [round, setRound] = useState(0);
  const attempts = useRef<Map<string, number>>(new Map());
  const inflight = useRef<Set<string>>(new Set());
  // Cache dei verdetti letta: solo dopo si chiedono quelli mancanti (prima si chiedeva anche quello già scritto).
  const [cacheRead, setCacheRead] = useState(false);
  const [saveState, setSaveState] = useState<Record<string, "saving" | "saved" | "error">>({});
  const [geo, setGeo] = useState<"idle" | "cerco" | "negata">("idle");
  const [from, setFrom] = useState<"home" | "mappa">("home");
  const mem = useRef<SurpriseMemory | null>(null);
  const taste = useRef<Awaited<ReturnType<typeof loadTaste>> | null>(null);

  const run = useCallback(async (where?: Center) => {
    setPhase("carico");
    setError(null);
    setCacheRead(false);
    try {
      if (!taste.current) {
        taste.current = userId ? await loadTaste(userId).catch(() => ({ saved: [], prefs: null })) : { saved: [], prefs: null };
      }
      const { saved, prefs } = taste.current;
      const c = where ?? await startCenter(saved);
      setCenter(c);
      const now = new Date();
      const plan = planSurprise(saved, prefs, now);
      const key = memoryKey(c.lat, c.lng, now, userId);
      const origin = new URLSearchParams(window.location.search).get("da") === "mappa" ? "mappa" : "home";
      setFrom(origin);
      let m = loadMemory(key);
      if (m && m.plan.query !== plan.query) m = null;
      if (m) {
        trackFeature("sorpresa", { fonte: origin, contesto: "memoria", risultati: m.results.length });
      } else {
        // UNA ricerca Google, la stessa della ricerca con i filtri (primo tempo: niente AI).
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: plan.query,
            source: "world",
            searchIntent: "structured",
            phase: "fast",
            lat: c.lat,
            lng: c.lng,
            radius: c.radius,
            ...(plan.maxPriceLevel != null && { maxPriceLevel: plan.maxPriceLevel }),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(typeof data.error === "string" ? data.error : "La ricerca non è disponibile in questo momento: riprova tra poco.");
          setPhase("errore");
          return;
        }
        m = {
          key, at: Date.now(), plan,
          results: Array.isArray(data.risultati) ? data.risultati : [],
          gruppi: Array.isArray(data.sintesi_pendente?.gruppi) ? data.sintesi_pendente.gruppi : [],
          verdicts: {},
          currentId: null,
        };
        trackFeature("sorpresa", { fonte: origin, contesto: "google", risultati: m.results.length });
      }
      const savedIds = new Set(saved.map((s) => s.googlePlaceId).filter((g): g is string => !!g));
      rememberFirme(m.results);
      const list = pickCandidates(m.results, savedIds, plan.reason);
      const start = Math.max(0, list.findIndex((x) => x.place.id === m!.currentId));
      m.currentId = list[start]?.place.id ?? null;
      mem.current = m;
      saveMemory(m);
      attempts.current = new Map();
      inflight.current = new Set();
      setGaveUp(new Set());
      setCandidates(list);
      setIdx(start);
      setVerdicts(m.verdicts);
      setPhase(list.length > 0 ? "pronto" : "vuoto");
      // Verdetti già scritti (cache place_synthesis, lettura pubblica): nessun costo.
      if (list.length > 0) {
        const supabase = await browserClient().catch(() => null);
        const { data: rows } = supabase
          ? await supabase.from("place_synthesis").select("place_id, verdict").in("place_id", list.map((x) => x.place.id))
          : { data: null };
        const found: Record<string, string> = {};
        for (const r of (rows ?? []) as { place_id: string; verdict: string | null }[]) {
          const v = r.verdict?.trim();
          if (v) found[r.place_id] = v;
        }
        if (Object.keys(found).length > 0 && mem.current === m) {
          m.verdicts = { ...m.verdicts, ...found };
          saveMemory(m);
          setVerdicts(m.verdicts);
        }
      }
      setCacheRead(true);
    } catch {
      setError("Errore di rete. Controlla la connessione e riprova.");
      setPhase("errore");
    }
  }, [userId]);

  useEffect(() => {
    // Fuori dal ciclo dell'effetto: gli aggiornamenti di stato partono dopo il primo disegno.
    const t = setTimeout(() => { void run(); }, 0);
    return () => clearTimeout(t);
  }, [run]);

  const current = phase === "pronto" ? candidates[idx] ?? null : null;

  // Verdetto mancante: lo chiede per il gruppo di risultati che contiene il locale MOSTRATO, come fa la
  // ricerca (stessi limiti AI e stessa cache: un verdetto già scritto non si riscrive, si generano solo i
  // mancanti). Se l'AI salta proprio questo locale (succede: "MISSING" nei log), si richiede una seconda
  // volta lo stesso gruppo: costa solo il locale mancante. Poi si smette e restano i dati Google.
  useEffect(() => {
    const m = mem.current;
    if (!current || !m || !cacheRead || verdicts[current.place.id]) return;
    const id = current.place.id;
    const group = m.gruppi.find((g) => g.places.some((p) => (p as { id?: string }).id === id));
    const tries = attempts.current.get(group?.token ?? "") ?? 0;
    if (!group || tries >= VERDICT_TRIES) {
      if (!gaveUp.has(id)) setTimeout(() => setGaveUp((s) => new Set(s).add(id)), 0);
      return;
    }
    if (inflight.current.has(group.token)) return;
    inflight.current.add(group.token);
    attempts.current.set(group.token, tries + 1);
    fetch("/api/search/synthesis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: m.plan.query, places: group.places, token: group.token }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { dettagli?: Record<string, { verdict?: string | null }> } | null) => {
        const found: Record<string, string> = {};
        for (const [pid, det] of Object.entries(d?.dettagli ?? {})) {
          const v = det?.verdict?.trim();
          if (v) found[pid] = v;
        }
        if (Object.keys(found).length > 0 && mem.current === m) {
          m.verdicts = { ...m.verdicts, ...found };
          saveMemory(m);
          setVerdicts(m.verdicts);
        }
      })
      .catch(() => { /* rete: si riprova al giro successivo, poi restano i dati Google */ })
      .finally(() => {
        inflight.current.delete(group.token);
        // Ridà il via all'effetto: se il verdetto del locale mostrato manca ancora, secondo tentativo.
        setRound((n) => n + 1);
      });
  }, [current, verdicts, cacheRead, round, gaveUp]);

  const another = () => {
    if (candidates.length === 0) return;
    const next = idx + 1;
    trackFeature("sorpresa_altro", { fonte: from });
    setIdx(next);
    const m = mem.current;
    if (m) { m.currentId = candidates[next]?.place.id ?? null; saveMemory(m); }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const restart = () => {
    setIdx(0);
    const m = mem.current;
    if (m) { m.currentId = candidates[0]?.place.id ?? null; saveMemory(m); }
  };

  const nearMe = () => {
    if (!("geolocation" in navigator)) { setGeo("negata"); return; }
    setGeo("cerco");
    navigator.geolocation.getCurrentPosition(
      (p) => { setGeo("idle"); void run({ lat: p.coords.latitude, lng: p.coords.longitude, radius: 3000, label: "Vicino a te", precise: true }); },
      () => setGeo("negata"),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
  };

  const save = async (c: Candidate) => {
    const p = c.place;
    if (!userId || p.lat == null || p.lng == null || saveState[p.id] === "saving") return;
    setSaveState((s) => ({ ...s, [p.id]: "saving" }));
    try {
      const { uuid } = await quickSavePlace(userId, {
        id: p.id, name: p.name, address: p.address, lat: p.lat, lng: p.lng,
        category: p.category, rating: p.rating, priceLevel: p.priceLevel, userRatingCount: p.userRatingCount,
        firma: p.firma,
      }, [WANT_TAG]);
      setSaveState((s) => ({ ...s, [p.id]: "saved" }));
      trackFeature("sorpresa_salva", { fonte: from });
      track("salva", { id: uuid, lat: p.lat, lng: p.lng }, { fonte: "sorprendimi", stato: "voglio" });
    } catch {
      setSaveState((s) => ({ ...s, [p.id]: "error" }));
    }
  };

  const back = from === "mappa" ? "/mappa" : "/";
  const exhausted = phase === "pronto" && idx >= candidates.length;

  return (
    <main data-testid="sorprendimi" className="-mb-[calc(var(--nav-height-mobile)+var(--nav-sporgenza))] min-h-dvh bg-brand pb-[var(--nav-height-mobile)] text-white md:mb-0 md:min-h-[calc(100dvh-3.5rem)] md:pb-0">
      <div className="mx-auto max-w-md px-4 pb-32 pt-6">
        <div className="mb-4 flex items-center justify-between">
          <Link href={back} aria-label="Indietro" className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-2xl text-white/90 active:bg-white/10">
            ←
          </Link>
          <span className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Fuori dai tuoi salvati</span>
          <span className="w-11" aria-hidden />
        </div>
        <h1 className="font-title text-3xl font-semibold leading-tight">🎲 Sorprendimi</h1>
        <p className="mt-1 text-sm text-white/75">Un posto nuovo che probabilmente ti piace, e perché.</p>
        {center && (
          <p data-testid="sorpresa-zona" className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-white/70">
            <span>📍 {center.label}</span>
            {center.label !== "Vicino a te" && (
              <button type="button" onClick={nearMe} disabled={geo === "cerco" || phase === "carico"} className="min-h-10 font-display font-semibold text-accent underline-offset-2 disabled:opacity-60">
                {geo === "cerco" ? "Cerco dove sei…" : "Vicino a me"}
              </button>
            )}
            {geo === "negata" && <span>Posizione non disponibile: cerco nella zona qui sopra.</span>}
          </p>
        )}

        {phase === "carico" && (
          <div aria-busy="true" aria-label="Cerco un posto per te" data-testid="sorpresa-carico" className="mt-5 overflow-hidden rounded-card bg-white/10">
            <div className="h-48 animate-pulse bg-white/10" />
            <div className="space-y-2 p-4">
              <div className="h-5 w-2/3 animate-pulse rounded bg-white/20" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-white/15" />
            </div>
          </div>
        )}

        {phase === "errore" && (
          <div data-testid="sorpresa-errore" className="mt-12 text-center">
            <p className="font-display text-lg font-semibold">{error}</p>
            {/* Quota Google finita: "Riprova" fallirebbe fino alle 9:00; "Stasera" sceglie tra i salvati, senza Google. */}
            {userId && /ripartono alle 9:00/.test(error ?? "") ? (
              <Link href="/stasera" data-testid="sorpresa-quota-stasera" className="mt-4 inline-flex min-h-11 items-center rounded-pill bg-accent px-6 font-display text-sm font-semibold text-white">
                🍽️ Scegli tra i tuoi salvati
              </Link>
            ) : (
              <button type="button" onClick={() => void run(center ?? undefined)} className="mt-4 min-h-11 rounded-pill bg-accent px-6 font-display text-sm font-semibold text-white">
                Riprova
              </button>
            )}
          </div>
        )}

        {phase === "vuoto" && (
          <div data-testid="sorpresa-vuoto" className="mt-10 rounded-card bg-white p-5 text-center text-text">
            <p className="font-display text-lg font-semibold text-brand">Qui intorno non trovo un posto nuovo che faccia per te.</p>
            <p className="mt-1 text-sm text-text-muted">Quelli che ho trovato li hai già salvati o sono troppo battuti. Prova in un&apos;altra zona.</p>
            <Link href="/mappa" className="mt-4 inline-flex min-h-11 items-center rounded-pill bg-brand px-5 font-display text-sm font-semibold text-white">Sposta la mappa</Link>
          </div>
        )}

        {current && (
          <SurpriseCard
            c={current}
            verdict={verdicts[current.place.id] ?? null}
            verdictLoading={!verdicts[current.place.id] && !gaveUp.has(current.place.id)}
            center={center?.precise ? center : null}
            pos={`${idx + 1} di ${candidates.length}`}
            saveState={saveState[current.place.id]}
            userId={userId}
            onSave={() => void save(current)}
            onAnother={another}
            onOpen={() => trackFeature("sorpresa_apri", { fonte: from })}
          />
        )}
        {/* "Ti è stato utile?" (piano 7.6): una volta per visita, sotto la carta (resta anche con "Un altro"). */}
        {(current || exhausted) && (
          <div className="mt-4 flex justify-center">
            <UtileFeedback contesto="sorpresa" risultati={candidates.length} tono="scuro" />
          </div>
        )}

        {exhausted && (
          <div data-testid="sorpresa-finiti" className="mt-6 rounded-card bg-white p-5 text-center text-text">
            <p className="font-display text-lg font-semibold text-brand">Per ora sono tutti qui.</p>
            <p className="mt-1 text-sm text-text-muted">Ti ho mostrato i {candidates.length} posti nuovi di questa zona adatti a te.</p>
            <div className="mt-4 flex justify-center gap-2">
              <button type="button" onClick={restart} className="min-h-11 rounded-pill bg-brand px-5 font-display text-sm font-semibold text-white">Ricomincia</button>
              <Link href="/mappa" className="inline-flex min-h-11 items-center rounded-pill border border-border px-5 font-display text-sm font-semibold text-brand">Apri la mappa</Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function SurpriseCard({
  c, verdict, verdictLoading, center, pos, saveState, userId, onSave, onAnother, onOpen,
}: {
  c: Candidate;
  verdict: string | null;
  verdictLoading: boolean;
  center: { lat: number; lng: number } | null;
  pos: string;
  saveState: "saving" | "saved" | "error" | undefined;
  userId: string | null;
  onSave: () => void;
  onAnother: () => void;
  onOpen: () => void;
}) {
  const p = c.place;
  const emoji = getCategoryEmoji(p.category, p.name);
  const dist = center && p.lat != null && p.lng != null ? distanceLabel(center, { lat: p.lat, lng: p.lng }) : null;
  const where = [categoryLabel(p.category), cityFromAddress(p.address), dist ? `a ${dist}` : null].filter(Boolean).join(" · ");
  const rating = p.rating != null ? `★ ${p.rating.toFixed(1).replace(".", ",")}${p.userRatingCount != null ? ` · ${p.userRatingCount.toLocaleString("it-IT")} recensioni` : ""}` : null;
  const price = p.priceLevel != null && p.priceLevel > 0 ? "€".repeat(p.priceLevel) : null;
  const summary = p.editorialSummary?.trim() || null;
  const review = p.selectedReviews?.find((r) => typeof r?.text === "string" && r.text.trim())?.text.trim() ?? null;
  const googleText = summary ?? review;
  const saved = saveState === "saved";

  return (
    <article data-testid="sorpresa-card" data-id={p.id} className="mt-5 overflow-hidden rounded-card bg-white text-text shadow-float">
      {/* Una sola foto alla volta: solo quella della proposta visibile (le altre non si scaricano),
          con la memoria foto del telefono di PlacePhoto; se manca o non arriva, l'emoji. */}
      <div data-testid="sorpresa-foto" className="relative h-44 bg-accent-light">
        <PlacePhoto
          key={p.id}
          photoRef={p.photoRef}
          alt={p.name}
          className="h-full w-full object-cover"
          credit={p.photoAuthor ?? null}
          fallback={<span aria-hidden className="flex h-full w-full items-center justify-center text-6xl">{emoji}</span>}
        />
        <span className="absolute left-3 top-3 rounded-pill bg-black/45 px-2.5 py-0.5 font-display text-xs font-semibold text-white">{pos}</span>
        {c.gem && <span data-testid="sorpresa-gemma" className="absolute right-3 top-3 rounded-pill bg-white px-2.5 py-0.5 font-display text-xs font-semibold text-brand shadow-card">💎 Poco conosciuto</span>}
      </div>
      <div className="p-4">
        <h2 className="font-title text-xl font-semibold leading-snug text-brand">{p.name}</h2>
        {where && <p className="mt-0.5 text-sm text-text-muted">{where}</p>}
        {(rating || price) && (
          <p className="mt-0.5 text-sm text-text-muted">
            {rating && <span className="text-text">{rating}</span>}{rating && price ? " · " : ""}{price}
          </p>
        )}

        <div data-testid="sorpresa-perche" className="mt-3 rounded-btn bg-accent-light px-3 py-2.5">
          <p className="font-display text-[11px] font-semibold uppercase tracking-wider text-accent">Perché te lo propongo</p>
          <p className="mt-0.5 text-sm font-medium text-text">
            {c.why.split(" · ").map((part, i) => (
              <span key={part}>{i > 0 && " · "}<span className="whitespace-nowrap">{part}</span></span>
            ))}
          </p>
        </div>

        {/* Verdetto: stessa altezza minima mentre arriva e quando c'è, così la card non salta. */}
        {verdict ? (
          <div data-testid="sorpresa-verdetto" className="mt-3 min-h-[5.75rem] rounded-btn bg-surface px-3 py-2.5">
            <p className="font-display text-[11px] font-semibold uppercase tracking-wider text-brand">Il verdetto Mapetite</p>
            <p className="mt-0.5 line-clamp-3 text-sm text-text">{verdict}</p>
          </div>
        ) : verdictLoading ? (
          <div data-testid="sorpresa-verdetto-attesa" aria-busy="true" aria-label="Arriva il verdetto Mapetite" className="mt-3 min-h-[5.75rem] rounded-btn bg-surface px-3 py-2.5">
            <p className="font-display text-[11px] font-semibold uppercase tracking-wider text-brand">Il verdetto Mapetite</p>
            <p className="mt-1.5 h-3.5 w-11/12 animate-pulse rounded bg-border" />
            <p className="mt-1.5 h-3.5 w-3/5 animate-pulse rounded bg-border" />
          </div>
        ) : googleText ? (
          // Il verdetto non è arrivato: al suo posto solo testo vero di Google, detto da dove viene.
          <div data-testid="sorpresa-google" className="mt-3 min-h-[5.75rem] rounded-btn bg-surface px-3 py-2.5">
            <p className="font-display text-[11px] font-semibold uppercase tracking-wider text-text-muted">{summary ? "Da Google" : "Dalle recensioni Google"}</p>
            <p className="mt-0.5 line-clamp-3 text-sm italic text-text">“{googleText}”</p>
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-2">
          {userId ? (
            <button
              type="button"
              data-testid="sorpresa-salva"
              onClick={onSave}
              disabled={saveState === "saving" || saved}
              className={`flex min-h-12 items-center justify-center rounded-pill font-display text-sm font-semibold active:scale-[0.98] disabled:opacity-90 ${saved ? "bg-success text-white" : "bg-accent text-white shadow-float"}`}
            >
              {saved ? "✓ Salvato" : saveState === "saving" ? "Salvo…" : saveState === "error" ? "Riprova a salvare" : "📌 Salva"}
            </button>
          ) : (
            <Link
              href={withNext("/login", "/sorprendimi")}
              data-testid="sorpresa-accedi"
              className="flex min-h-12 items-center justify-center rounded-pill bg-accent font-display text-sm font-semibold text-white shadow-float active:scale-[0.98]"
            >
              Accedi per salvarlo
            </Link>
          )}
          <Link
            href={`/mappa?sorpresa=${encodeURIComponent(p.id)}`}
            data-testid="sorpresa-apri"
            onClick={onOpen}
            className="flex min-h-12 items-center justify-center rounded-pill bg-brand font-display text-sm font-semibold text-white active:scale-[0.98]"
          >
            Apri scheda
          </Link>
        </div>
        <button
          type="button"
          data-testid="sorpresa-altro"
          onClick={onAnother}
          className="mt-2 flex min-h-12 w-full items-center justify-center rounded-pill border border-border font-display text-sm font-semibold text-brand active:scale-[0.98]"
        >
          🎲 Un altro
        </button>
        {!userId && (
          <p className="mt-3 text-center text-xs text-text-muted">Con l&apos;accesso la sorpresa parte dai posti che salvi e da quelli che ti sono piaciuti.</p>
        )}
      </div>
    </article>
  );
}
