"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, Clock } from "lucide-react";
import { isOpenAt } from "@/lib/filter-options";
import { oreStasera, type OraStasera } from "@/lib/ore-stasera";
import type { OpeningPeriods } from "@/lib/google-places";
import { createClient } from "@/lib/supabase/client";
import { getCategoryEmoji } from "@/lib/emoji";
import { categoryLabel } from "@/lib/category-label";
import { cityFromAddress } from "@/lib/city";
import { distanceLabel } from "@/lib/distance";
import { track } from "@/lib/track";
import { isStateTag, tagDisplay } from "@/lib/tags";
import { postoStasera } from "@/lib/serate";
import {
  STATE_DONE,
  STATE_WANT,
  citiesOf,
  collectionsOf,
  directionsUrl,
  matches,
  pickThree,
  inProgramma,
  oggiRoma,
  type Choices,
  type SavedSpot,
} from "@/lib/stasera";

// Proposta 84: letture degli orari Google al massimo per un tocco di "Proponimi" o "Altri 3".
const LETTURE_PER_TOCCO = 10;

type Geo = "idle" | "cerco" | "ok" | "negata" | "assente";
// Miniature sotto "Proponimi": una fila sola, al massimo tre più "+N" (revisore 2/11, sesto giro: due file
// finivano sotto la barra in basso).
const ANTEPRIMA_MAX = 3;
type Pos = { lat: number; lng: number };

// Lettura dei salvati come in /mappa (saved_places → places), più il verdetto già in cache
// (place_synthesis, per Google Place ID). Nessuna chiamata a Google o all'AI.
async function loadSaved(userId: string): Promise<{ spots: SavedSpot[]; verdicts: Record<string, string> }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("saved_places")
    .select("tags, note, piano_al, places(id, name, category, address, lat, lng, google_place_id)")
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
      pianoAl: typeof row.piano_al === "string" ? row.piano_al : null,
    });
  }
  // Proposta 69: quali salvati hanno detto "stasera c'è posto" (solo locali verificati, parola del titolare).
  // Un di più: se la lettura fallisce (o mancano le colonne) nessuna pillola, il resto non cambia.
  // Letta in parallelo con i verdetti (minore del revisore, 19/11): una sola attesa invece di due.
  const leggiPosto = async () => {
    const ids = spots.map((s) => s.id);
    for (let i = 0; i < ids.length; i += 150) {
      const { data: ver, error: verErr } = await supabase
        .from("places")
        .select("id, verified_at, giorni_tranquilli, giorni_tranquilli_at")
        .in("id", ids.slice(i, i + 150))
        .not("verified_at", "is", null);
      if (verErr) { if (verErr.code !== "42703") console.error("[stasera] lettura locali verificati fallita:", verErr); return; }
      const conPosto = new Set((ver ?? []).filter((r) => postoStasera({ verificato: true, giorni: r.giorni_tranquilli, at: (r.giorni_tranquilli_at as string | null) ?? null })).map((r) => r.id as string));
      for (const s of spots) if (conPosto.has(s.id)) s.postoStasera = true;
    }
  };
  const verdicts: Record<string, string> = {};
  const leggiVerdetti = async () => {
    const googleIds = spots.map((s) => s.googlePlaceId).filter((g): g is string => !!g);
    if (googleIds.length === 0) return;
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
  };
  await Promise.all([leggiPosto().catch((e) => console.error("[stasera] posto:", e)), leggiVerdetti().catch((e) => console.error("[stasera] verdetti:", e))]);
  return { spots, verdicts };
}

function Pill({ active, onClick, children, testId }: { active: boolean; onClick: () => void; children: React.ReactNode; testId?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      data-testid={testId}
      className={`min-h-12 rounded-pill px-5 text-[15px] font-medium transition-[transform,background-color] duration-150 active:scale-[0.97] ${
        active ? "bg-brand text-white" : "border border-[#e1e5e5] bg-white text-[#33373d]"
      }`}
    >
      {children}
    </button>
  );
}

// Proposta 84: con un'ora scelta, la card dice se a quell'ora è aperto (orari Google) o se non si sa.
type Orario = { ora: OraStasera; aperto: boolean | null } | null;

function SpotCard({ spot, verdict, pos, orario }: { spot: SavedSpot; verdict: string | null; pos: Pos | null; orario: Orario }) {
  const emoji = getCategoryEmoji(spot.category, spot.name);
  const city = cityFromAddress(spot.address);
  const dist = pos && spot.lat != null && spot.lng != null ? distanceLabel(pos, { lat: spot.lat, lng: spot.lng }) : null;
  const where = [categoryLabel(spot.category), city, dist ? `a ${dist}` : null].filter(Boolean).join(" · ");
  const want = spot.tags.includes(STATE_WANT);
  const done = spot.tags.includes(STATE_DONE);
  const planned = !done && inProgramma(spot, oggiRoma());
  // Raccolte = tag scritti dall'utente: niente stati né "Com'era?" (👍/👎 non sono raccolte).
  const raccolte = spot.tags.filter((t) => !isStateTag(t) && t.trim());
  const mapHref = spot.lat != null && spot.lng != null ? `/mappa?salvato=${spot.id}` : "/mappa?vista=salvati";

  return (
    <li data-testid="stasera-proposta" data-id={spot.id} className="rounded-card border border-[#e3e7e7] bg-white p-4 text-text shadow-card">
      {/* Semplificare (18/10): nome e foto aprono il posto sulla mappa; sotto resta un solo pulsante, Percorso. */}
      <Link href={mapHref} data-testid="stasera-mappa" aria-label={`Apri ${spot.name} nella mappa`} className="flex items-start gap-3 active:opacity-80">
        <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-btn bg-accent-light text-3xl leading-none">
          {emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-title text-lg font-semibold leading-snug text-brand">{spot.name}</h2>
          {where && <p className="mt-0.5 text-sm text-text-muted">{where}</p>}
          {orario?.aperto && (
            <p data-testid="stasera-orario" className="mt-1 flex items-center gap-1 text-[13px] font-semibold text-brand">
              <Clock aria-hidden size={14} className="shrink-0" />
              {orario.ora.id === "adesso" ? "Aperto adesso" : `Aperto ${orario.ora.label.toLowerCase()}`}
            </p>
          )}
          {(planned || want || done) && (
            <span
              data-testid="stasera-stato"
              className={`mt-1.5 inline-block rounded-pill px-2.5 py-0.5 font-display text-xs font-semibold ${(planned || want) && !spot.postoStasera ? "bg-accent text-white" : "bg-surface text-text-muted"}`}
            >
              {/* Una sola pillola corallo per card (minore del revisore, 19/11): con "c'è posto" lo stato diventa tenue. */}
              {planned ? "📅 Avevi detto: ci vado" : want ? "📌 Da provare" : "✓ Ci sono stato"}
            </span>
          )}
          {spot.postoStasera && (
            <span data-testid="stasera-posto" className="mt-1.5 flex w-fit items-center gap-1 rounded-pill bg-accent-light px-2.5 py-0.5 font-display text-xs font-semibold text-accent">
              🌙 Stasera c&apos;è posto
              <span className="font-sans font-normal text-text-muted">· dice il locale</span>
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
            <span key={t} className="rounded-pill bg-[#eef1f1] px-2.5 py-0.5 font-display text-xs font-medium text-[#33373d]">{tagDisplay(t)}</span>
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
  // Proposta 69: "🌙 Dove c'è posto" (solo se almeno un salvato lo ha detto oggi).
  const [soloPosto, setSoloPosto] = useState(false);
  // Proposta 84 "Fra 2 ore": ora scelta (null = qualsiasi). Gli orari Google si chiedono solo qui, al tocco
  // di "Proponimi"/"Altri 3", per al massimo 5 salvati, e restano in memoria finché la pagina è aperta.
  const [oraId, setOraId] = useState<string | null>(null);
  const [controllo, setControllo] = useState(false);
  const [orariKo, setOrariKo] = useState(false);
  // true = zero proposte perché le letture del tocco sono finite, non perché sono tutti chiusi.
  const [controllati, setControllati] = useState(false);
  const [orari, setOrari] = useState<Record<string, OpeningPeriods | null>>({});

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
    () => ({ occasion, onlyNew, near: wantNear && pos ? pos : null, city, soloPosto }),
    [occasion, onlyNew, wantNear, pos, city, soloPosto],
  );
  // Quanti salvati con posto stasera rispettano le altre scelte (la pillola c'è solo se almeno uno, o se è accesa).
  const nPosto = useMemo(() => (spots ?? []).filter((s) => s.postoStasera && matches(s, { ...choices, soloPosto: false })).length, [spots, choices]);
  const collections = useMemo(() => collectionsOf(spots ?? []), [spots]);
  const cities = useMemo(() => citiesOf(spots ?? []), [spots]);
  const matching = useMemo(() => (spots ?? []).filter((s) => matches(s, choices)), [spots, choices]);
  // Le ore si ricalcolano quando arrivano i salvati e a ogni ritorno alle scelte ("Cambia scelte"); quella
  // usata per le proposte si fissa al tocco (revisore 24/11: con la pagina aperta per ore "Adesso" restava vecchio).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ore = useMemo(() => (spots ? oreStasera() : []), [spots, proposals]);
  // Un'ora scelta che nel frattempo è passata (es. "Alle 13" alle 12:35) non vale più: niente ora nascosta.
  const oraValida = ore.some((o) => o.id === oraId) ? oraId : null;
  const [oraUsata, setOraUsata] = useState<OraStasera | null>(null);
  const ora = proposals ? oraUsata : null;
  // undefined = non ancora chiesto; null = orari non noti; true/false da Google.
  const apertoAlle = (s: SavedSpot, o: OraStasera, cache = orari): boolean | null | undefined => {
    if (!s.googlePlaceId || !(s.googlePlaceId in cache)) return undefined;
    return isOpenAt(cache[s.googlePlaceId], o.t);
  };
  const chiuso = (s: SavedSpot) => !!ora && apertoAlle(s, ora) === false;
  const matchCount = matching.length;
  const apribili = ora ? matching.filter((s) => !chiuso(s)).length : matchCount;
  // Un tocco alla volta anche con due tocchi rapidissimi (lo stato "controllo" arriva solo al rendering dopo).
  const occupato = useRef(false);

  // Sceglie fino a 3 posti; con un'ora chiede a Google gli orari dei 5 candidati migliori non ancora noti e
  // tiene i primi 3 non chiusi (orari non noti = il posto resta). `budget` vale per tutto il tocco: al massimo
  // LETTURE_PER_TOCCO letture, anche quando "Altri 3" ricomincia il giro (revisore 24/11: si arrivava a 30).
  // Se gli orari non arrivano, si propone come prima. `cache` è una copia degli orari già noti.
  const scegli = async (skip: Set<string>, cache: Record<string, OpeningPeriods | null>, o: OraStasera | null, budget: { n: number }): Promise<{ picks: SavedSpot[]; ko: boolean; esaurito: boolean }> => {
    if (!spots) return { picks: [], ko: false, esaurito: false };
    if (!o) return { picks: pickThree(spots, choices, skip), ko: false, esaurito: false };
    let ko = false;
    for (let giro = 0; giro < 2; giro++) {
      const salta = new Set([...skip, ...spots.filter((s) => apertoAlle(s, o, cache) === false).map((s) => s.id)]);
      const cand = pickThree(spots, choices, salta, 5);
      const daChiedere = cand.map((s) => s.googlePlaceId).filter((g): g is string => !!g && !(g in cache)).slice(0, Math.max(0, budget.n));
      if (daChiedere.length > 0) {
        budget.n -= daChiedere.length;
        try {
          const r = await fetch("/api/stasera/orari", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: daChiedere }) });
          if (!r.ok) throw new Error(`orari ${r.status}`);
          const j = (await r.json()) as { orari?: Record<string, OpeningPeriods | null> };
          for (const g of daChiedere) {
            if (j.orari && g in j.orari) cache[g] = j.orari[g];
            else ko = true; // oltre il tetto del giorno: orari non noti, il posto resta
          }
        } catch (e) {
          console.error("[stasera] orari non disponibili:", e);
          ko = true;
        }
      }
      // Un posto mai controllato (letture del tocco finite) non si propone come se fosse aperto (revisore 24/11):
      // resta solo se gli orari non sono arrivati per un errore (ko) o se non ha un Place ID.
      const visto = (s: SavedSpot) => apertoAlle(s, o, cache) !== undefined || !s.googlePlaceId || ko;
      const picks = cand.filter((s) => visto(s) && apertoAlle(s, o, cache) !== false).slice(0, 3);
      const esaurito = picks.length === 0 && cand.some((s) => !visto(s));
      if (picks.length > 0 || cand.length === 0 || ko || budget.n <= 0) return { picks, ko, esaurito };
    }
    return { picks: [], ko, esaurito: false };
  };

  // L'ora scelta, ricalcolata adesso; se nel frattempo è passata (es. "Alle 20" alle 20:10) vale "Adesso".
  const oraDelTocco = (id: string | null): OraStasera | null => {
    if (!id) return null;
    const fresche = oreStasera();
    return fresche.find((o) => o.id === id) ?? fresche[0];
  };

  const propose = async (id: string | null = oraValida) => {
    if (!spots || occupato.current) return;
    occupato.current = true;
    setControllo(true);
    const o = oraDelTocco(id);
    const cache = { ...orari };
    const { picks, ko, esaurito } = await scegli(new Set(), cache, o, { n: LETTURE_PER_TOCCO });
    setOrari(cache);
    setControllati(esaurito);
    setOraUsata(o);
    setControllo(false);
    occupato.current = false;
    setProposals(picks);
    setShown(new Set(picks.map((p) => p.id)));
    setRestarted(false);
    setOrariKo(ko);
    window.scrollTo({ top: 0 });
  };

  const more = async () => {
    if (!spots || !proposals || occupato.current) return;
    occupato.current = true;
    setControllo(true);
    const o = oraUsata;
    const cache = { ...orari };
    const budget = { n: LETTURE_PER_TOCCO };
    const primo = await scegli(shown, cache, o, budget);
    let { picks, ko } = primo;
    let nextShown = new Set([...shown, ...picks.map((p) => p.id)]);
    let again = false;
    // Letture finite con salvati ancora da controllare: non si ricomincia il giro ("Altri 3" continua).
    if (picks.length === 0 && !primo.esaurito) {
      // Visti tutti: si ricomincia il giro, evitando di riproporre subito gli stessi.
      ({ picks, ko } = await scegli(new Set(proposals.map((p) => p.id)), cache, o, budget));
      if (picks.length === 0) ({ picks, ko } = await scegli(new Set(), cache, o, budget));
      nextShown = new Set(picks.map((p) => p.id));
      again = true;
    }
    setOrari(cache);
    setControllati(primo.esaurito);
    setControllo(false);
    occupato.current = false;
    setProposals(picks);
    setShown(nextShown);
    setRestarted(again);
    setOrariKo(ko);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // "Alle 13" è il pranzo: il titolo non dice "per stasera".
  // "Adesso" di giorno: "per adesso" (revisore 24/11).
  const quando = ora?.id === "13" ? "per pranzo" : ora?.id === "adesso" && ora.t.hour < 17 ? "per adesso" : "per stasera";
  const summary = [occasion ? tagDisplay(occasion) : "Qualsiasi occasione", city ? `a ${city}` : choices.near ? "vicino a te" : "ovunque", onlyNew ? "da provare" : "anche dove sono stato", soloPosto ? "dove c'è posto" : null, ora?.riepilogo ?? null].filter(Boolean).join(" · ");

  return (
    <main data-testid="stasera" className="-mb-[calc(var(--nav-height-mobile)+var(--nav-sporgenza))] min-h-dvh bg-[#f6f7f7] pb-[var(--nav-height-mobile)] text-text md:mb-0 md:min-h-[calc(100dvh-3.5rem)] md:pb-0">
      <div className="mx-auto max-w-md px-4 pb-32 pt-6">
        {/* Testata come Salvati (revisore 1/11, terzo giro): freccia, poi sopra-titolo e titolo allineati a sinistra. */}
        <Link href="/profilo" aria-label="Torna al profilo" className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-text active:bg-black/5">
          <ArrowLeft size={22} aria-hidden />
        </Link>
        <p data-testid="stasera-sopra" className="mb-1.5 mt-1 font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">Dai tuoi salvati</p>

        {loadError ? (
          <div className="mt-16 text-center">
            <p className="font-display text-lg font-semibold">Non riesco a leggere i tuoi salvati.</p>
            <p className="mt-1 text-sm text-text-muted">Controlla la connessione e riprova.</p>
            <button type="button" onClick={() => { setLoadError(false); load(); }} className="mt-4 min-h-11 rounded-pill bg-accent px-6 font-display text-sm font-semibold text-white">
              Riprova
            </button>
          </div>
        ) : spots === null ? (
          <div aria-busy="true" aria-label="Carico i tuoi salvati" className="space-y-4">
            <div className="h-20 w-3/4 animate-pulse rounded-card bg-black/[0.06]" />
            <div className="h-12 w-full animate-pulse rounded-pill bg-black/[0.06]" />
            <div className="h-12 w-2/3 animate-pulse rounded-pill bg-black/[0.06]" />
          </div>
        ) : spots.length === 0 ? (
          <div data-testid="stasera-vuoto">
            <h1 className="font-title text-[36px] font-medium leading-[1.05] tracking-tight">Stasera dove andiamo?</h1>
            <p className="mt-3 max-w-xs text-[15px] text-text-muted">
              Qui scegli tra i posti che hai salvato. Non ne hai ancora nessuno: cercane uno o porta qui quelli che hai già su Google Maps e Instagram.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Link href="/mappa" className="flex min-h-12 w-full max-w-xs items-center justify-center rounded-pill bg-accent font-display font-semibold text-white">
                Cerca un locale
              </Link>
              <Link href="/importa" className="flex min-h-12 w-full max-w-xs items-center justify-center rounded-pill border border-[#d6dcdc] bg-white font-display font-semibold text-brand">
                Importa i tuoi posti
              </Link>
            </div>
          </div>
        ) : proposals ? (
          <section aria-label="Proposte per stasera">
            <h1 className="font-title text-[32px] font-medium leading-tight tracking-tight">
              {proposals.length === 0 && controllati ? "Chiusi quelli che ho controllato" : proposals.length === 0 ? `Tutti chiusi ${ora?.id === "adesso" ? "adesso" : ora?.label.toLowerCase() ?? ""}` : proposals.length === 1 ? `Ecco un'idea ${quando}` : `Ecco ${proposals.length} idee ${quando}`}
            </h1>
            {proposals.length > 0 && <p data-testid="stasera-riepilogo" className="mt-1 text-sm text-text-muted">{summary}</p>}
            {restarted && <p data-testid="stasera-ricomincio" className="mt-2 text-sm text-text-muted">Li hai visti tutti: ricomincio il giro.</p>}
            {proposals.length === 0 && (
              <div data-testid="stasera-tutti-chiusi" className="mt-3">
                <p className="text-[15px] text-text-muted">{controllati ? "Ne ho controllati 10, chiusi a quell'ora: tocca «Altri 3» per i prossimi, o prova un'altra ora:" : "I salvati che ho controllato sono chiusi a quell'ora. Prova un'altra ora:"}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {ore.filter((o) => o.id !== ora?.id).map((o) => (
                    <Pill key={o.id} testId="stasera-altra-ora" active={false} onClick={() => { setOraId(o.id); void propose(o.id); }}>{o.label}</Pill>
                  ))}
                  <Pill testId="stasera-altra-ora" active={false} onClick={() => { setOraId(null); void propose(null); }}>Qualsiasi ora</Pill>
                </div>
              </div>
            )}
            {orariKo && proposals.length > 0 && (
              <p data-testid="stasera-orari-ko" role="status" className="mt-2 text-sm text-text-muted">Non riesco a leggere tutti gli orari adesso: controlla prima di andare.</p>
            )}
            <ul className="mt-5 space-y-3">
              {proposals.map((s) => (
                <SpotCard key={s.id} spot={s} verdict={s.googlePlaceId ? verdicts[s.googlePlaceId] ?? null : null} pos={pos} orario={ora ? { ora, aperto: apertoAlle(s, ora) ?? null } : null} />
              ))}
            </ul>
            <div className="sticky bottom-[var(--nav-height-mobile)] -mx-4 mt-5 flex gap-2 bg-gradient-to-t from-[#f6f7f7] from-60% to-transparent px-4 pb-[calc(0.75rem+var(--nav-sporgenza))] pt-6">
              <button
                type="button"
                onClick={() => setProposals(null)}
                className="min-h-12 flex-1 rounded-pill border border-[#d6dcdc] bg-white font-display font-semibold text-brand active:scale-[0.98]"
              >
                Cambia scelte
              </button>
              {apribili > proposals.length && (
                <button
                  type="button"
                  onClick={more}
                  disabled={controllo}
                  aria-busy={controllo}
                  data-testid="stasera-altri"
                  className="min-h-12 flex-1 rounded-pill bg-accent font-display font-semibold text-white shadow-float active:scale-[0.98] disabled:opacity-80"
                >
                  {controllo ? "Controllo…" : "Altri 3"}
                </button>
              )}
            </div>
          </section>
        ) : (
          <section aria-label="Le tue scelte">
            <h1 className="font-title text-[36px] font-medium leading-[1.05] tracking-tight">Stasera dove andiamo?</h1>
            <p className="mt-2 text-[15px] text-text-muted">{spots.length === 1 ? "Tre tocchi e scegli: per ora hai un solo salvato." : `Tre tocchi e scegli tra i tuoi ${spots.length} salvati.`}</p>

            <h2 className="mb-2.5 mt-7 font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">Che occasione?</h2>
            <div data-testid="stasera-occasione" className="flex flex-wrap gap-2">
              <Pill active={occasion === null} onClick={() => setOccasion(null)}>Qualsiasi</Pill>
              {collections.slice(0, 7).map((t) => (
                <Pill key={t} active={occasion === t} onClick={() => setOccasion(occasion === t ? null : t)}>{tagDisplay(t)}</Pill>
              ))}
            </div>
            {collections.length === 0 && (
              <p className="mt-2 text-xs text-text-muted">Aggiungi tag ai tuoi salvati (es. Romantico, Con amici) per scegliere anche l&apos;occasione.</p>
            )}

            <h2 className="mb-2.5 mt-6 font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">Dove?</h2>
            <div data-testid="stasera-distanza" className="flex flex-wrap gap-2">
              <Pill active={wantNear} onClick={askPosition}>{geo === "cerco" ? "Cerco dove sei…" : "📍 Vicino a me"}</Pill>
              {cities.length > 1 && cities.slice(0, 3).map((c) => (
                <Pill key={c} active={!wantNear && city === c} onClick={() => { setWantNear(false); setCity(city === c ? null : c); }}>{c}</Pill>
              ))}
              <Pill active={!wantNear && !city} onClick={() => { setWantNear(false); setCity(null); }}>Ovunque</Pill>
            </div>
            {geo === "negata" && (
              <p data-testid="stasera-posizione-negata" role="status" className="mt-2 text-xs text-text-muted">
                Non vedo dove sei: per «Vicino a me» consenti la posizione a Mapetite nelle impostazioni del browser. Intanto cerco ovunque.
              </p>
            )}
            {geo === "assente" && (
              <p role="status" className="mt-2 text-xs text-text-muted">Posizione non disponibile adesso: intanto cerco ovunque.</p>
            )}

            <h2 className="mb-2.5 mt-6 font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">A che ora?</h2>
            <div data-testid="stasera-ora" className="flex flex-wrap gap-2">
              {ore.map((o) => (
                <Pill key={o.id} active={oraValida === o.id} onClick={() => { const nuova = oraValida === o.id ? null : o.id; setOraId(nuova); if (nuova) track("funzione", null, { nome: "stasera_ora", ora: nuova }); }}>
                  {o.label}
                </Pill>
              ))}
            </div>

            <h2 className="mb-2.5 mt-6 font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">Che voglia?</h2>
            <div data-testid="stasera-novita" className="flex flex-wrap gap-2">
              <Pill active={onlyNew} onClick={() => setOnlyNew(true)}>📌 Da provare</Pill>
              <Pill active={!onlyNew} onClick={() => setOnlyNew(false)}>Anche dove sono stato</Pill>
            </div>
            {(nPosto > 0 || soloPosto) && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Pill testId="stasera-solo-posto" active={soloPosto} onClick={() => { setSoloPosto(!soloPosto); if (!soloPosto) track("funzione", null, { nome: "stasera_posto", risultati: nPosto }); }}>
                  🌙 Dove c&apos;è posto · {nPosto}
                </Pill>
              </div>
            )}

            {matchCount === 0 ? (
              <div data-testid="stasera-nessuno" className="mt-8 rounded-card border border-[#e3e7e7] bg-white p-4">
                <p className="font-display font-semibold">Nessun salvato con queste scelte.</p>
                <p className="mt-0.5 text-sm text-text-muted">Allarga con un tocco:</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {occasion && (
                    <button type="button" data-testid="stasera-allarga" onClick={() => setOccasion(null)} className="min-h-11 rounded-pill border border-brand/30 bg-white px-4 font-display text-sm font-semibold text-brand">
                      Qualsiasi occasione
                    </button>
                  )}
                  {(choices.near || city) && (
                    <button type="button" data-testid="stasera-allarga" onClick={() => { setWantNear(false); setCity(null); }} className="min-h-11 rounded-pill border border-brand/30 bg-white px-4 font-display text-sm font-semibold text-brand">
                      Cerca ovunque
                    </button>
                  )}
                  {soloPosto && (
                    <button type="button" data-testid="stasera-allarga" onClick={() => setSoloPosto(false)} className="min-h-11 rounded-pill border border-brand/30 bg-white px-4 font-display text-sm font-semibold text-brand">
                      Anche gli altri posti
                    </button>
                  )}
                  {onlyNew && (
                    <button type="button" data-testid="stasera-allarga" onClick={() => setOnlyNew(false)} className="min-h-11 rounded-pill border border-brand/30 bg-white px-4 font-display text-sm font-semibold text-brand">
                      Anche dove sono stato
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="sticky bottom-[var(--nav-height-mobile)] -mx-4 mt-4 bg-gradient-to-t from-[#f6f7f7] from-70% to-transparent px-4 pb-[calc(0.75rem+var(--nav-sporgenza))] pt-4">
                <button
                  type="button"
                  onClick={() => void propose()}
                  disabled={controllo}
                  aria-busy={controllo}
                  data-testid="stasera-proponi"
                  className="min-h-14 w-full rounded-pill bg-accent font-display text-[17px] font-semibold text-white shadow-float active:scale-[0.98] disabled:opacity-80"
                >
                  {controllo ? "Controllo gli orari…" : matchCount >= 3 ? "Proponimi 3 posti" : matchCount === 1 ? "Proponimi l'unico posto" : `Proponimi i ${matchCount} posti`}
                </button>
                <p data-testid="stasera-conteggio" className="mt-2 text-center text-xs text-text-muted">
                  {matchCount === 1 ? "1 salvato" : `${matchCount} salvati`} con queste scelte
                </p>
              </div>
            )}
            {/* Revisore 2/11, terzo giro: sotto il pulsante il 40% dello schermo era vuoto. Ora i salvati veri che
                rispettano le scelte (emoji e nome), aggiornati a ogni tocco; un tocco apre il posto sulla mappa. */}
            {matchCount > 0 && (
              <section data-testid="stasera-anteprima" aria-label="I salvati con queste scelte" className="mt-3 pb-[calc(var(--nav-height-mobile)+var(--nav-sporgenza))] md:pb-0">
                <ul className="grid grid-cols-4 gap-2">
                  {matching.slice(0, ANTEPRIMA_MAX).map((s) => (
                    <li key={s.id}>
                      <Link
                        href={s.lat != null && s.lng != null ? `/mappa?salvato=${s.id}` : "/mappa?vista=salvati"}
                        data-testid="stasera-anteprima-posto"
                        className="flex h-full flex-col items-center gap-1.5 rounded-card border border-[#e3e7e7] bg-white px-2 pb-2.5 pt-3 text-center active:scale-[0.97]"
                      >
                        <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f0f2f2] text-[22px] leading-none">{getCategoryEmoji(s.category, s.name)}</span>
                        <span className="line-clamp-2 text-[12.5px] font-medium leading-tight text-text">{s.name}</span>
                      </Link>
                    </li>
                  ))}
                  {matchCount > ANTEPRIMA_MAX && (
                    <li>
                      <Link
                        href="/mappa?vista=salvati"
                        data-testid="stasera-anteprima-altri"
                        aria-label={`Altri ${matchCount - ANTEPRIMA_MAX} salvati`}
                        className="flex h-full min-h-[92px] flex-col items-center justify-center gap-0.5 rounded-card border border-[#e3e7e7] bg-[#f0f2f2] px-2 text-center active:scale-[0.97]"
                      >
                        <span className="font-title text-[22px] font-semibold leading-none text-brand">+{matchCount - ANTEPRIMA_MAX}</span>
                        <span className="text-[12px] text-text-muted">altri</span>
                      </Link>
                    </li>
                  )}
                </ul>
              </section>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
