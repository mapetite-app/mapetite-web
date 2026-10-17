"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUp, BookmarkCheck, CalendarCheck, Map as MapIcon, RotateCcw, Sparkles, X } from "lucide-react";
import VenueSheet from "@/components/venue-sheet";
import CommunityLocale from "@/components/community-locale";
import AssistantPlaceCard, { type Card, type SaveState } from "./assistente-card";
import SerataView, { chosenOf, type Serata, type SerataTappa } from "./serata-view";
import BookingSheet from "@/components/booking-sheet";
import UtileFeedback from "@/components/utile-feedback";
import VoiceButton from "@/components/voice-button";
import { followUpQuery } from "@/lib/follow-up";
import { applyLocalRefine, localRefineOf } from "@/lib/assistant";
import { intentOfTappa, orderCandidates, serataOf, type SerataPlan, type TappaPlan } from "@/lib/serata";
import { dateKey, dayLabel, missingDetails, parseBooking, type BookingDetails } from "@/lib/booking";
import { track, trackFeature } from "@/lib/track";
import { prefetchIntent, intentFor } from "@/lib/intent-prefetch";
import { quickSavePlace, savedGoogleIds } from "@/lib/quick-save";
import { loginToSaveUrl, rememberPendingSave } from "@/lib/pending-save";
import { rememberFirme } from "@/lib/catalog-firme";
import { aggiungiGusti, fraseConZona, gustiDichiarati, gustiPerRicerca, gustoDa, inFondoPerGusti, metri, type Zona } from "@/lib/gusti";
import { caricaGusti, caricaZonaAbituale, gustiRicordati, ricordaGusti } from "@/lib/gusti-store";
import { readLastView } from "@/lib/last-view";
import { cityNear } from "@/lib/named-city";

// ── Conversazione (solo nel telefono: sessionStorage) ──
type Ask = { label: string; send: string };
type UserMsg = { id: string; role: "user"; text: string };
type BotMsg = {
  id: string;
  role: "assistant";
  text: string;
  understood?: string | null;  // "Ho capito: ristorante · terrazza · Roma"
  note?: string | null;        // riga piccola sotto (onestà, zona usata, posti messi da parte)
  places?: Card[];
  query?: string | null;       // la ricerca da cui vengono le card
  status?: "loading" | "verdicts" | "done" | "error";
  asks?: Ask[];
  serata?: Serata;             // serata completa a tappe (piano 1.2)
  gusti?: { id: string; label: string }[];      // gusti ricordati usati in questa ricerca (piano 1.4)
  memo?: { ids: string[]; state: "ask" | "si" | "no" }; // "Me lo ricordo?" (mai senza un Sì)
  zona?: { nome: string; send: string };        // "Di solito vai a Monti: cerco lì?"
};
type Msg = UserMsg | BotMsg;
type Conv = {
  msgs: Msg[];
  booking: BookingDetails;
  bookingMode: boolean;
  lastQuery: string | null;
  pos: { lat: number; lng: number } | null;
  skipGusti?: string[];        // gusti tolti con un tocco: valgono fino a "Nuova"
};

const KEY = "mapetite.assistente";
const EMPTY_BOOKING: BookingDetails = { date: null, time: null, people: null, special: null };
const EMPTY: Conv = { msgs: [], booking: EMPTY_BOOKING, bookingMode: false, lastQuery: null, pos: null };
// Senza posizione e senza città scritta si cerca dove era la mappa l'ultima volta, altrimenti a Roma.
const DEFAULT_CENTER = { lat: 41.9028, lng: 12.4964 };
const fallbackCenter = (): { lat: number; lng: number } => readLastView() ?? DEFAULT_CENTER;
// Zona dove la persona salva più spesso (letta all'apertura, nessuna chiamata Google).
let zonaAbitualeCache: Zona | null = null;

// Serata rimasta a metà (pagina chiusa): le tappe in attesa diventano "interrotte", il resto resta.
function reviveSerata(m: BotMsg): BotMsg {
  const tappe = (m.serata?.tappe ?? []).map((t): SerataTappa => (t.status === "loading" ? { ...t, status: "error", error: "Ricerca interrotta: riprova." } : t.status === "verdicts" ? { ...t, status: "done" } : t));
  return { ...m, status: "done", serata: m.serata ? { ...m.serata, tappe } : undefined };
}

let conv: Conv | null = null;
const listeners = new Set<() => void>();
function getConv(): Conv {
  if (conv) return conv;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Conv) : null;
    // Una ricerca rimasta "in corso" (pagina chiusa a metà) non deve bloccare la conversazione.
    conv = parsed && Array.isArray(parsed.msgs)
      ? { ...EMPTY, ...parsed, msgs: parsed.msgs.map((m) => (m.role === "assistant" && m.serata ? reviveSerata(m) : m.role === "assistant" && (m.status === "loading" || m.status === "verdicts") ? { ...m, status: m.status === "loading" ? "error" : "done", text: m.status === "loading" ? "Ricerca interrotta: riprova." : m.text } : m)) }
      : EMPTY;
  } catch {
    conv = EMPTY;
  }
  return conv;
}
function setConv(f: (c: Conv) => Conv) {
  conv = f(getConv());
  try { window.sessionStorage.setItem(KEY, JSON.stringify(conv)); } catch { /* storage pieno o non disponibile */ }
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const patchMsg = (id: string, patch: Partial<BotMsg> | ((m: BotMsg) => Partial<BotMsg>)) =>
  setConv((c) => ({ ...c, msgs: c.msgs.map((m) => (m.id === id && m.role === "assistant" ? { ...m, ...(typeof patch === "function" ? patch(m) : patch) } : m)) }));

// ── Testi ──
const EXAMPLES = [
  { emoji: "🗓️", short: "Prenota domani", text: "Prenotami domani alle 21 per 2 con terrazza a Roma" },
  { emoji: "🍝", short: "Trattoria vera", text: "Trattoria non turistica a Testaccio" },
  { emoji: "🍸", short: "Aperitivo con vista", text: "Aperitivo con vista a Milano" },
  { emoji: "🥞", short: "Brunch domenica", text: "Brunch domenica per 4 a Roma" },
  { emoji: "🌙", short: "Serata a tappe", text: "Organizzami sabato sera: aperitivo, cena, dopocena a Trastevere" },
];
const REFINES: Ask[] = [
  { label: "Più economici", send: "più economici" },
  { label: "Aperti ora", send: "aperti ora" },
  { label: "Più vicini", send: "più vicini" },
  { label: "💎 Meno conosciuti", send: "meno conosciuti" },
];
const SMALL_TALK = /^(ciao|salve|buongiorno|buonasera|grazie|ok|okay|va bene|perfetto|grazie mille)[!. ]*$/i;

function bookingSummary(b: BookingDetails): string {
  return [
    b.people ? `${b.people} ${b.people === 1 ? "persona" : "persone"}` : null,
    b.date ? dayLabel(b.date) : null,
    b.time ? `alle ${b.time}` : null,
    b.special ?? null,
  ].filter(Boolean).join(", ");
}

// Una domanda alla volta, solo per ciò che serve a prenotare.
function askFor(b: BookingDetails): { question: string; asks: Ask[] } | null {
  const missing = missingDetails(b);
  if (missing.includes("persone")) return { question: "Per quante persone?", asks: ["2", "3", "4", "6"].map((n) => ({ label: `${n} persone`, send: `per ${n}` })) };
  if (missing.includes("giorno")) return { question: "Per quando?", asks: [{ label: "Stasera", send: "stasera" }, { label: "Domani", send: "domani" }, { label: "Sabato", send: "sabato" }, { label: "Domenica", send: "domenica" }] };
  if (missing.includes("ora")) return { question: "A che ora?", asks: ["13:00", "20:00", "20:30", "21:00", "21:30"].map((t) => ({ label: t, send: `alle ${t}` })) };
  return null;
}

type RawPlace = {
  id: string; name: string; category: string | null; lat: number | null; lng: number | null;
  rating: number | null; priceLevel: number | null; address: string | null;
  userRatingCount: number | null; openNow: boolean | null; websiteUri: string | null; phone: string | null;
  selectedReviews: { text: string }[] | null; synthesis: string | null; tags: string[] | null; verdict: string | null;
  goFor: string[] | null; dontExpect: string[] | null; matchReason: string | null; photoRef?: string | null; photoAuthor?: string | null; editorialSummary?: string | null;
};
type Pending = { places: unknown[]; token: string; gruppi?: { places: unknown[]; token: string }[] } | null;
type VerdictReply = { dettagli?: Record<string, Partial<Card>>; esclusi?: string[]; livelli?: Record<string, string> };

function toCard(p: RawPlace): Card {
  return {
    id: p.id, name: p.name, address: p.address ?? null, category: p.category, rating: p.rating ?? null,
    userRatingCount: p.userRatingCount ?? null, priceLevel: p.priceLevel ?? null, openNow: p.openNow ?? null,
    websiteUri: p.websiteUri ?? null, phone: p.phone ?? null, lat: p.lat as number, lng: p.lng as number,
    selectedReviews: p.selectedReviews ?? null, synthesis: p.synthesis ?? null, tags: p.tags ?? null,
    verdict: p.verdict ?? null, goFor: p.goFor ?? null, dontExpect: p.dontExpect ?? null, matchReason: p.matchReason ?? null,
    personalTags: null, personalNote: null, photoRef: p.photoRef ?? null, photoAuthor: p.photoAuthor ?? null,
    editorialSummary: p.editorialSummary ?? null,
  };
}

function askPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  });
}

// Secondo tempo: i verdetti (come la mappa), a gruppi in parallelo. onPart riceve ogni gruppo
// appena arriva; alla fine esclusi e livelli di tutti i gruppi.
async function fetchVerdicts(query: string, pending: NonNullable<Pending>, onPart: (part: VerdictReply) => void) {
  const groups = pending.gruppi?.length ? pending.gruppi : [{ places: pending.places, token: pending.token }];
  const replies = await Promise.all(groups.map(async (g): Promise<VerdictReply | null> => {
    try {
      const res = await fetch("/api/search/synthesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, places: g.places, token: g.token }),
      });
      if (!res.ok) return null;
      const part: VerdictReply = await res.json();
      onPart(part);
      return part;
    } catch {
      return null; // un gruppo perso non ferma gli altri: quelle card restano con i dati Google
    }
  }));
  return {
    esclusi: new Set(replies.flatMap((r) => r?.esclusi ?? [])),
    livelli: Object.assign({}, ...replies.map((r) => r?.livelli ?? {})) as Record<string, string>,
  };
}

async function loadVerdicts(msgId: string, query: string, pending: Pending) {
  if (!pending) { patchMsg(msgId, { status: "done" }); return; }
  const { esclusi, livelli } = await fetchVerdicts(query, pending, (part) =>
    patchMsg(msgId, (m) => ({ places: (m.places ?? []).map((p) => (part.dettagli?.[p.id] ? { ...p, ...part.dettagli[p.id] } : p)) })));
  patchMsg(msgId, (m) => {
    let places = (m.places ?? []).filter((p) => !esclusi.has(p.id));
    if (places.length === 0) places = m.places ?? []; // nel dubbio il locale resta
    const rank = (p: Card) => (livelli[p.id] === "alto" ? 0 : livelli[p.id] === "basso" ? 2 : 1);
    places = places.map((p, i) => ({ p, i })).sort((a, b) => rank(a.p) - rank(b.p) || a.i - b.i).map((x) => x.p);
    const excluded = (m.places ?? []).length - places.length;
    return {
      places,
      status: "done",
      note: [m.note, excluded > 0 ? `Ho tolto ${excluded === 1 ? "un posto che non rispettava" : `${excluded} posti che non rispettavano`} la richiesta.` : null].filter(Boolean).join(" ") || null,
    };
  });
}

// ── Serata completa a tappe (piano 1.2) ──
// Ogni tappa è UNA ricerca Google (massimo 3 tappe → 3 ricerche). L'intento della tappa si
// costruisce senza AI (src/lib/serata.ts): nessuna chiamata Haiku per capire la frase.
const patchTappa = (msgId: string, i: number, patch: Partial<SerataTappa> | ((t: SerataTappa) => Partial<SerataTappa>)) =>
  patchMsg(msgId, (m) => (m.serata
    ? { serata: { ...m.serata, tappe: m.serata.tappe.map((t, j) => (j === i ? { ...t, ...(typeof patch === "function" ? patch(t) : patch) } : t)) } }
    : {}));

const POOL_MAX = 6;

async function fetchTappa(t: TappaPlan, zona: string | null, at: { lat: number; lng: number }): Promise<{ cards: Card[]; pending: Pending } | { error: string }> {
  try {
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: t.query, source: "world", searchIntent: "natural", phase: "fast",
        intent: intentOfTappa(t, zona), intentQuery: t.query,
        lat: at.lat, lng: at.lng,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data?.error ?? "Qualcosa è andato storto. Riprova." };
    rememberFirme(data.risultati);
    const cards = ((data.risultati ?? []) as RawPlace[]).filter((p) => p.lat != null && p.lng != null).map(toCard);
    return { cards, pending: (data.sintesi_pendente ?? null) as Pending };
  } catch {
    return { error: "Errore di rete. Controlla la connessione e riprova." };
  }
}

async function loadTappaVerdicts(msgId: string, i: number, query: string, pending: Pending) {
  if (!pending) { patchTappa(msgId, i, { status: "done" }); return; }
  const { esclusi } = await fetchVerdicts(query, pending, (part) =>
    patchTappa(msgId, i, (t) => ({ pool: t.pool.map((p) => (part.dettagli?.[p.id] ? { ...p, ...part.dettagli[p.id] } : p)) })));
  // I locali che chiaramente non rispettano la richiesta escono (nel dubbio restano).
  patchTappa(msgId, i, (t) => {
    const pool = t.pool.filter((p) => !esclusi.has(p.id));
    if (pool.length === 0) return { status: "done" };
    return { pool, chosenId: pool.some((p) => p.id === t.chosenId) ? t.chosenId : pool[0].id, status: "done" };
  });
}

async function runSerata(plan: SerataPlan, q: string, pos: { lat: number; lng: number } | null): Promise<string> {
  const msgId = newId();
  const n = plan.tappe.length;
  const tappe: SerataTappa[] = plan.tappe.map((t) => ({ kind: t.kind, label: t.label, emoji: t.emoji, query: t.query, status: "loading", pool: [], chosenId: null }));
  setConv((c) => ({
    ...c,
    lastQuery: q,
    msgs: [...c.msgs, {
      id: msgId, role: "assistant", status: "loading", query: q,
      text: `Ecco la tua serata${plan.zona ? ` a ${plan.zona}` : ""}: ${n} tappe in ordine, ognuna vicina alla precedente. Per ogni tappa ti propongo un posto e un paio di alternative.`,
      understood: plan.tappe.map((t) => t.label.toLowerCase()).join(" → ") + (plan.zona ? ` · ${plan.zona}` : ""),
      serata: { zona: plan.zona, tappe, tagliate: plan.tagliate },
    }],
  }));
  const start = pos ?? fallbackCenter();
  // Con la zona scritta le tappe partono insieme (il testo tiene Google nella zona) e la scelta
  // segue la tappa precedente qui sotto; senza zona una alla volta, con la posizione della
  // tappa precedente come preferenza per Google (il dopocena vicino alla cena).
  const together = plan.zona ? plan.tappe.map((t) => fetchTappa(t, plan.zona, start)) : null;
  let prev: Card | null = null;
  const used = new Set<string>();
  let found = 0;
  let firstError: string | null = null;
  for (let i = 0; i < n; i++) {
    const t = plan.tappe[i];
    const r: Awaited<ReturnType<typeof fetchTappa>> = together ? await together[i] : await fetchTappa(t, plan.zona, prev ?? start);
    if ("error" in r) {
      firstError = firstError ?? r.error;
      patchTappa(msgId, i, { status: "error", error: r.error });
      continue;
    }
    const pool: Card[] = orderCandidates(r.cards, prev, used).slice(0, POOL_MAX);
    const chosen: Card | null = pool[0] ?? null;
    if (chosen) { used.add(chosen.id); prev = chosen; found++; }
    patchTappa(msgId, i, { pool, chosenId: chosen?.id ?? null, status: r.pending && chosen ? "verdicts" : "done" });
    if (r.pending && chosen) void loadTappaVerdicts(msgId, i, t.query, r.pending);
  }
  patchMsg(msgId, (m) => ({
    status: found === 0 ? "error" : "done",
    text: found === 0 ? firstError ?? `Non ho trovato posti per “${q}”. Prova con un'altra zona.` : m.text,
    note: found > 0 && found < n ? "Per una tappa non ho trovato posti: prova a cambiare zona." : m.note ?? null,
  }));
  return msgId;
}

async function runSearch(q: string, booking: BookingDetails, bookingMode: boolean, pos: { lat: number; lng: number } | null, extraNote?: string): Promise<string> {
  const msgId = newId();
  // Gusti ricordati (piano 1.4): entrano nella richiesta come parole, così Google e i verdetti ne
  // tengono conto senza chiamate in più. La richiesta scritta vince ("ristorante di pesce").
  const { query: full, usati } = gustiPerRicerca(q, gustiRicordati(), getConv().skipGusti ?? []);
  const gusti = usati.length > 0 ? usati.map((g) => ({ id: g.id, label: g.label })) : undefined;
  setConv((c) => ({ ...c, lastQuery: q, msgs: [...c.msgs, { id: msgId, role: "assistant", text: "", status: "loading", query: q, gusti }] }));
  const at = pos ?? fallbackCenter();
  try {
    // Frase già capita mentre si scriveva (come la mappa): la ricerca non riaspetta l'AI.
    const intent = await intentFor(full);
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: full, source: "world", searchIntent: "natural", phase: "fast",
        ...(intent && { intent, intentQuery: full.trim() }),
        lat: at.lat, lng: at.lng,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      patchMsg(msgId, { status: "error", text: data?.error ?? "Qualcosa è andato storto. Riprova." });
      return msgId;
    }
    rememberFirme(data.risultati);
    // Contro un gusto dichiarato (categoria o nome chiari, es. "seafood_restaurant"): in fondo, mai esclusi.
    const ordered = inFondoPerGusti(((data.risultati ?? []) as RawPlace[]).filter((p) => p.lat != null && p.lng != null).map(toCard), usati);
    const places = ordered.places;
    const f = data.filtri_usati as { categoria?: string | null; parole_chiave?: string[]; zona?: string | null; vicino_a_me?: boolean } | undefined;
    const understood = [f?.categoria, ...(f?.parole_chiave ?? []).slice(0, 3), f?.zona].filter(Boolean).join(" · ");
    const notes: string[] = [];
    if ((data.da_parte?.turistici ?? []).length > 0) notes.push("Ho messo in fondo i posti più turistici.");
    if (ordered.spostati > 0) notes.push(`Ho messo in fondo ${ordered.spostati === 1 ? "un posto" : `${ordered.spostati} posti`} ${ordered.motivo}: mi hai detto che non fa per te.`);
    if (extraNote) notes.push(extraNote);
    // Comportamento: la zona dove salvi più spesso, proposta solo se la frase non dice già dove.
    const z = zonaAbitualeCache;
    const zona = z && !f?.zona && !f?.vicino_a_me && !fraseConZona(q) && (!pos || metri(pos, z) < 20_000)
      ? { nome: z.nome, send: z.citta === "Roma" ? `a ${z.nome}` : `a ${z.nome}, ${z.citta}` }
      : undefined;
    if (!f?.zona && !pos && !f?.vicino_a_me && !zona) {
      const citta = cityNear(at.lat, at.lng);
      const last = readLastView();
      notes.push(last
        ? `Ho cercato ${citta ? `intorno a ${citta}, ` : ""}dove avevi lasciato la mappa: scrivi la città se sei altrove.`
        : "Ho cercato intorno a Roma: scrivi la città se sei altrove.");
    }
    let text: string;
    let asks: Ask[] | undefined;
    if (places.length === 0) {
      text = `Non ho trovato posti per “${q}”. Prova con meno requisiti o un'altra zona.`;
    } else if (bookingMode) {
      const summary = bookingSummary(booking);
      const ask = askFor(booking);
      text = `${summary ? `Per ${summary}: ` : ""}${places.length} ${places.length === 1 ? "posto adatto" : "posti adatti"}, il messaggio per il locale lo preparo io.${ask ? ` ${ask.question}` : ""}`;
      asks = ask?.asks;
      notes.push("I tavoli liberi non li vedo: la conferma arriva sempre dal locale.");
    } else {
      text = `Ecco ${places.length} ${places.length === 1 ? "posto" : "posti"} per “${q}”.`;
    }
    patchMsg(msgId, { places, text, understood: understood || null, note: notes.join(" ") || null, asks, zona, status: data.sintesi_pendente ? "verdicts" : "done" });
    // I verdetti con la stessa richiesta della ricerca (firmata dal server): gusti compresi.
    if (data.sintesi_pendente) void loadVerdicts(msgId, full, data.sintesi_pendente as Pending);
  } catch {
    patchMsg(msgId, { status: "error", text: "Errore di rete. Controlla la connessione e riprova." });
  }
  return msgId;
}

// Gusti nuovi in questo messaggio: quelli che cambierebbero ciò che è già ricordato.
function gustiNuovi(text: string): { ids: string[]; dichiarati: string[]; soloPreferenza: boolean } {
  const d = gustiDichiarati(text);
  const cur = gustiRicordati();
  const ids = d.ids.filter((id) => aggiungiGusti(cur, [id]).join() !== cur.join());
  return { ids, dichiarati: d.ids, soloPreferenza: d.soloPreferenza };
}
const labelsOf = (ids: string[]) => ids.map((id) => gustoDa(id)?.label).filter(Boolean).join(" · ");

function lastResults(c: Conv): BotMsg | null {
  for (let i = c.msgs.length - 1; i >= 0; i--) {
    const m = c.msgs[i];
    if (m.role === "assistant" && m.serata) return null; // dopo una serata i seguiti rifanno la serata
    if (m.role === "assistant" && m.places && m.places.length > 0) return m;
  }
  return null;
}

// La ricerca Google che partirebbe per questo messaggio; null = nessuna (saluti, seguiti sui
// posti di prima, solo dettagli della prenotazione). La stessa regola vale mentre si scrive.
function searchQueryOf(text: string, parsed: ReturnType<typeof parseBooking>, lastQuery: string | null): string | null {
  const searchText = parsed.isBooking ? parsed.search : (parsed.search ? text : null);
  if (!searchText) return null;
  return lastQuery ? followUpQuery(lastQuery, searchText) : searchText;
}

// Mentre si scrive: la richiesta che partirà all'Invio, per farla capire in anticipo all'AI.
function plannedQuery(raw: string, c: Conv): string | null {
  const text = raw.trim().slice(0, 300);
  if (!text || SMALL_TALK.test(text)) return null;
  if (localRefineOf(text) && lastResults(c)) return null;
  if (gustiDichiarati(text).soloPreferenza) return null; // "sono vegetariano": nessuna ricerca
  const q = searchQueryOf(text, parseBooking(text), c.lastQuery);
  // Serata a tappe: si capisce senza AI, nessuna richiesta in anticipo. Per le altre la stessa
  // richiesta che partirà all'Invio, gusti ricordati compresi.
  return q && serataOf(q) ? null : q ? gustiPerRicerca(q, gustiRicordati(), c.skipGusti ?? []).query : null;
}

// Segnale "funzione" dell'assistente: mai il testo scritto, solo che tipo di messaggio era.
const trackMsg = (contesto: "saluto" | "seguito" | "ricerca" | "prenotazione" | "dettagli" | "serata" | "gusti") =>
  trackFeature("assistente_messaggio", { contesto });

async function send(raw: string) {
  const text = raw.trim().slice(0, 300);
  if (!text) return;
  const before = getConv();
  const parsed = parseBooking(text);
  const booking: BookingDetails = {
    date: parsed.date ?? before.booking.date,
    time: parsed.time ?? before.booking.time,
    people: parsed.people ?? before.booking.people,
    // "…con terrazza" e poi "solo con vista": le richieste si sommano, non si sostituiscono.
    special: parsed.special && before.booking.special && !before.booking.special.includes(parsed.special)
      ? `${before.booking.special}, ${parsed.special}`
      : parsed.special ?? before.booking.special,
  };
  const bookingMode = before.bookingMode || parsed.isBooking;
  setConv((c) => ({ ...c, booking, bookingMode, msgs: [...c.msgs, { id: newId(), role: "user", text }] }));
  const reply = (m: Omit<BotMsg, "id" | "role">) => setConv((c) => ({ ...c, msgs: [...c.msgs, { id: newId(), role: "assistant", status: "done", ...m }] }));

  if (SMALL_TALK.test(text)) {
    trackMsg("saluto");
    reply({ text: "Dimmi cosa cerchi, come lo diresti a un amico: tipo di posto, zona, occasione. Se vuoi prenotare, aggiungi giorno, ora e persone." });
    return;
  }

  // Preferenze dichiarate ("sono vegetariano", "evito i posti rumorosi"): si chiede se ricordarle,
  // mai salvate senza un "Sì". Se il messaggio è SOLO la preferenza non parte nessuna ricerca.
  const nuovi = gustiNuovi(text);
  if (nuovi.ids.length > 0) trackFeature("assistente_memoria", { contesto: "proposta", risultati: nuovi.ids.length });
  if (nuovi.soloPreferenza) {
    trackMsg("gusti");
    if (nuovi.ids.length === 0) {
      reply({ text: `Lo so già: ne tengo conto in ogni ricerca (${labelsOf(nuovi.dichiarati)}).` });
      return;
    }
    reply({ text: "Capito. Così non devi ripeterlo a ogni ricerca:", memo: { ids: nuovi.ids, state: "ask" } });
    return;
  }
  const memo = nuovi.ids.length > 0 ? { memo: { ids: nuovi.ids, state: "ask" as const } } : null;

  // Seguiti che si fanno sui risultati già avuti: nessuna ricerca Google.
  const prev = lastResults(before);
  const refine = localRefineOf(text);
  if (refine && prev?.places) {
    let pos = before.pos;
    if (refine === "vicini" && !pos) {
      pos = await askPosition();
      if (pos) setConv((c) => ({ ...c, pos }));
      else {
        reply({ text: "Non riesco a vedere dove sei: attiva la posizione nelle impostazioni del browser, oppure scrivimi la zona (es. “a Monti”)." });
        return;
      }
    }
    const done = applyLocalRefine(refine, prev.places, pos);
    if (done) {
      trackMsg("seguito");
      trackFeature("assistente_seguito", { contesto: refine });
      reply({
        text: done.places.length > 0 ? done.note : `${done.note} Vuoi che cerchi altri posti?`,
        places: done.places,
        query: prev.query ?? null,
        note: "Senza una nuova ricerca: ho usato i posti di prima.",
        asks: done.places.length === 0 ? [{ label: "Sì, cerca aperti ora", send: `${prev.query ?? ""} aperto ora`.trim() }] : undefined,
      });
      return;
    }
  }

  const q = searchQueryOf(text, parsed, before.lastQuery);
  const plan = q ? serataOf(q) : null;
  if (q && plan) {
    trackMsg("serata");
    trackFeature("assistente_serata", { contesto: "percorso", risultati: plan.tappe.length });
    const id = await runSerata(plan, q, getConv().pos);
    if (memo) patchMsg(id, memo);
    return;
  }
  if (q) {
    trackMsg(parsed.isBooking ? "prenotazione" : "ricerca");
    // "solo con terrazza" dopo una ricerca: seguito che riformula la richiesta di prima.
    if (before.lastQuery && q !== searchQueryOf(text, parsed, null)) trackFeature("assistente_seguito", { contesto: "ricerca" });
    const id = await runSearch(q, booking, bookingMode, getConv().pos);
    if (memo) patchMsg(id, memo);
    return;
  }

  // Solo dettagli della prenotazione ("per 4", "domani", "alle 21"): nessuna ricerca.
  trackMsg("dettagli");
  const summary = bookingSummary(booking);
  const ask = askFor(booking);
  if (!prev) {
    reply({
      text: `${summary ? `Segnato: ${summary}. ` : ""}Che posto cerchi e in che zona? (es. “trattoria a Monti”, “sushi a Milano”)`,
    });
    return;
  }
  reply({
    text: `Perfetto: ${summary}.${ask ? ` ${ask.question}` : " Il messaggio è pronto: tocca “Prenota”."}`,
    asks: ask?.asks,
  });
}

// ── Interfaccia ──

function PlaceCards({ msg, booking, bookingMode, savedIds, saving, onOpen, onBook, onSave }: {
  msg: BotMsg; booking: BookingDetails; bookingMode: boolean;
  savedIds: Set<string>; saving: Record<string, SaveState>;
  onOpen: (c: Card) => void; onBook: (c: Card) => void; onSave: (c: Card) => void;
}) {
  const places = msg.places ?? [];
  // "Aperto ora" vale per adesso: se si prenota per un altro giorno non dice niente e si nasconde.
  const showOpen = !bookingMode || !booking.date || booking.date === dateKey(new Date());
  return (
    // key con l'ordine: quando i verdetti riordinano le card il carosello riparte dalla prima
    // (altrimenti il browser restava sulla card di prima, a metà).
    <ul key={places.map((p) => p.id).join()} data-testid="assistente-card" className="-mx-4 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
      {places.map((p, i) => (
        <li key={p.id} className="relative w-[72%] max-w-[270px] shrink-0 snap-start">
          <AssistantPlaceCard
            p={p}
            photo={i < 6}
            showOpen={showOpen}
            waitingVerdict={msg.status === "verdicts"}
            bookingMode={bookingMode}
            saved={savedIds.has(p.id)}
            saving={saving[p.id]}
            onOpen={() => onOpen(p)}
            onSave={() => onSave(p)}
            onBook={() => onBook(p)}
          />
        </li>
      ))}
    </ul>
  );
}

const WANT = "Da provare";

export default function AssistenteView({ userId }: { userId: string | null }) {
  const c = useSyncExternalStore(subscribe, getConv, () => EMPTY);
  const [input, setInput] = useState("");
  const [moreIdeas, setMoreIdeas] = useState(false);
  // Salvati (Place ID Google): "Salvato" sulle card dei locali già nella mappa della persona.
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState<Record<string, SaveState>>({});
  const [savedToast, setSavedToast] = useState<{ name: string; uuid: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    savedGoogleIds(userId)
      .then((ids) => { if (alive && ids.size > 0) setSavedIds((prev) => new Set([...prev, ...ids])); })
      .catch(() => { /* senza rete: nessun "Salvato", il tocco lo dirà comunque */ });
    return () => { alive = false; };
  }, [userId]);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  // Memoria dei gusti (piano 1.4): gusti ricordati e zona abituale, letti una volta all'apertura.
  useEffect(() => {
    let alive = true;
    void caricaGusti(userId);
    caricaZonaAbituale(userId).then((z) => { if (alive) zonaAbitualeCache = z; }, () => {});
    return () => { alive = false; };
  }, [userId]);

  // Stesso salvataggio della mappa: senza accesso il locale si ricorda e si salva dopo il login
  // (src/lib/pending-save.ts, completato da /mappa, dove si arriva dopo l'accesso).
  const save = async (p: Card, tag: "Da provare" | "Già visitato" = WANT) => {
    if (!userId) {
      rememberPendingSave({ id: p.id, name: p.name, category: p.category, address: p.address, lat: p.lat, lng: p.lng, tags: null, note: null, rating: p.rating, priceLevel: p.priceLevel }, [tag]);
      window.location.href = loginToSaveUrl(p.name);
      return;
    }
    if (savedIds.has(p.id) || saving[p.id] === "saving") return;
    setSaving((s) => ({ ...s, [p.id]: "saving" }));
    try {
      const { uuid, already } = await quickSavePlace(userId, p, [tag]);
      setSavedIds((prev) => new Set(prev).add(p.id));
      setSaving((s) => { const next = { ...s }; delete next[p.id]; return next; });
      if (!already) track("salva", { id: uuid, lat: p.lat, lng: p.lng }, { fonte: "assistente", stato: tag });
      setSavedToast({ name: p.name, uuid });
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setSavedToast(null), 5000);
    } catch {
      setSaving((s) => ({ ...s, [p.id]: "error" }));
    }
  };

  // Mentre si scrive: dopo 700 ms di pausa l'AI capisce già la richiesta (come la mappa e la home:
  // stessa memoria, una frase già capita non si richiede). Nessuna chiamata Google.
  useEffect(() => {
    const q = plannedQuery(input, getConv());
    if (!q || q.length < 8) return;
    const t = setTimeout(() => prefetchIntent(q), 700);
    return () => clearTimeout(t);
  }, [input]);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  // Scheda aperta: si legge dalla conversazione, così il verdetto arrivato dopo compare anche lì.
  const [openRef, setOpenRef] = useState<{ msgId: string; placeId: string } | null>(null);
  const openMsg = openRef ? c.msgs.find((m) => m.id === openRef.msgId) : null;
  const openCard = openMsg?.role === "assistant"
    ? openMsg.places?.find((p) => p.id === openRef?.placeId) ?? openMsg.serata?.tappe.flatMap((t) => t.pool).find((p) => p.id === openRef?.placeId) ?? null
    : null;
  const setOpenCard = (v: null) => setOpenRef(v);
  const [bookCard, setBookCard] = useState<Card | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const busy = c.msgs.some((m) => m.role === "assistant" && m.status === "loading");
  const last = c.msgs[c.msgs.length - 1];
  const lastStatus = last?.role === "assistant" ? last.status : null;
  const count = c.msgs.length;

  // Nuovo messaggio: si scorre in fondo (come in un'app di messaggistica).
  useEffect(() => {
    if (count > 0) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [count, lastStatus]);

  // Arrivo con una richiesta (/assistente?q=…, dalla mappa o dalla home): parte una volta sola.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const q = new URLSearchParams(window.location.search).get("q");
    if (q && q.trim().length >= 3) {
      window.history.replaceState(window.history.state, "", "/assistente");
      void send(q);
    }
  }, []);

  const submit = (text: string) => {
    if (busy || !text.trim()) return;
    setInput("");
    setVoiceError(null);
    void send(text);
  };
  const lastResultsId = lastResults(c)?.id ?? null;

  // "Me lo ricordo?": solo con un Sì esplicito il gusto si salva (profilo o telefono).
  const answerMemo = (m: BotMsg, yes: boolean) => {
    if (!m.memo || m.memo.state !== "ask") return;
    patchMsg(m.id, { memo: { ...m.memo, state: yes ? "si" : "no" } });
    trackFeature("assistente_memoria", { contesto: yes ? "si" : "no", risultati: m.memo.ids.length });
    if (yes) void ricordaGusti(userId, m.memo.ids);
  };
  // Un tocco su "vegetariano ✕": la stessa ricerca senza quel gusto, fino a "Nuova".
  const dropGusto = (m: BotMsg, id: string) => {
    if (busy || !m.query) return;
    const label = m.gusti?.find((g) => g.id === id)?.label ?? "";
    setConv((x) => ({ ...x, skipGusti: [...new Set([...(x.skipGusti ?? []), id])] }));
    trackFeature("assistente_memoria", { contesto: "tolto" });
    void runSearch(m.query, c.booking, c.bookingMode, c.pos, `Senza “${label}”, solo in questa conversazione.`);
  };

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-var(--nav-height-mobile)-var(--nav-sporgenza))] max-w-lg flex-col bg-bg md:min-h-[calc(100dvh-3.5rem)]">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-border bg-bg/95 px-4 py-2.5 backdrop-blur md:top-14">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-white"><Sparkles size={18} aria-hidden /></span>
          <div className="min-w-0">
            <h1 className="font-display text-base font-semibold leading-tight text-brand">Assistente Mapetite</h1>
            <p className="truncate text-xs font-sans text-text-muted">Trova, filtra, prenota</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Link href="/mappa" aria-label="Apri la mappa" className="flex h-11 w-11 items-center justify-center rounded-full text-brand"><MapIcon size={18} /></Link>
          {c.msgs.length > 0 && (
            <button
              type="button"
              data-testid="assistente-nuova"
              onClick={() => setConv((x) => ({ ...EMPTY, pos: x.pos }))}
              className="flex min-h-10 items-center gap-1 rounded-pill border border-border px-3 text-sm font-display font-semibold text-brand"
            >
              <RotateCcw size={14} /> Nuova
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 px-4 pb-36 pt-4" data-testid="assistente-conversazione">
        {c.msgs.length === 0 && (
          <div data-testid="assistente-benvenuto" className="pt-6">
            <p className="font-title text-3xl font-semibold leading-tight text-text">Ciao! Dimmi cosa cerchi.</p>
            <p className="mt-2 text-[15px] font-sans leading-relaxed text-text-muted">
              Scrivi o detta come lo diresti a un amico. Trovo i posti giusti per te, non i più famosi, e se vuoi ti preparo la prenotazione.
            </p>
            {/* Lorenzo 16/10: poche chip brevi; la lista completa dietro "Altre idee". */}
            <p className="mt-6 text-xs font-display font-semibold uppercase tracking-wide text-text-muted">Ti suggeriamo</p>
            <div data-testid="assistente-esempi" className="mt-2 flex flex-wrap gap-2">
              {EXAMPLES.slice(0, 3).map((e) => (
                <button
                  key={e.text}
                  type="button"
                  aria-label={e.text}
                  onClick={() => submit(e.text)}
                  className="flex min-h-10 items-center gap-1.5 rounded-pill border border-border bg-surface px-3.5 text-sm font-sans text-text active:scale-[0.98]"
                >
                  <span aria-hidden>{e.emoji}</span> {e.short}
                </button>
              ))}
              <button
                type="button"
                data-testid="assistente-altre-idee"
                aria-expanded={moreIdeas}
                onClick={() => setMoreIdeas((v) => !v)}
                className="flex min-h-10 items-center gap-1 rounded-pill border border-brand/30 bg-surface px-3.5 text-sm font-display font-semibold text-brand active:scale-[0.98]"
              >
                {moreIdeas ? "Meno idee" : "✨ Altre idee"}
              </button>
            </div>
            {moreIdeas && (
              <ul data-testid="assistente-idee" className="mt-3 flex flex-col divide-y divide-border rounded-card border border-border bg-surface">
                {EXAMPLES.map((e) => (
                  <li key={e.text}>
                    <button
                      type="button"
                      onClick={() => submit(e.text)}
                      className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left text-[15px] font-sans text-text active:bg-brand-light"
                    >
                      <span aria-hidden className="text-lg">{e.emoji}</span>
                      <span className="min-w-0 flex-1">“{e.text}”</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex flex-col gap-4">
          {c.msgs.map((m) =>
            m.role === "user" ? (
              <p key={m.id} data-testid="assistente-utente" className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-[15px] font-sans leading-snug text-white">
                {m.text}
              </p>
            ) : (
              <div key={m.id} data-testid="assistente-risposta" className="max-w-full">
                {m.status === "loading" && !m.serata ? (
                  <p data-testid="assistente-attesa" className="flex items-center gap-2 text-[15px] font-sans text-text-muted">
                    <span className="flex gap-1" aria-hidden>
                      <span className="h-2 w-2 animate-bounce rounded-full bg-accent" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:120ms]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:240ms]" />
                    </span>
                    Cerco i posti giusti…
                  </p>
                ) : (
                  <>
                    {/* Risposta in una bolla breve, come in un'app di messaggistica. */}
                    <p className={`w-fit max-w-[92%] rounded-2xl rounded-bl-md bg-surface px-4 py-2.5 text-[15px] font-sans leading-snug ${m.status === "error" ? "text-error" : "text-text"}`}>{m.text}</p>
                  </>
                )}
                {m.gusti && m.gusti.length > 0 && (
                  <div data-testid="assistente-gusti" className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs font-sans text-text-muted">
                    <span>Tengo conto di:</span>
                    {m.gusti.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => dropGusto(m, g.id)}
                        disabled={busy}
                        aria-label={`Togli “${g.label}” da questa conversazione`}
                        className="inline-flex min-h-8 items-center gap-1 rounded-pill bg-surface px-2.5 font-semibold text-brand disabled:opacity-60 active:scale-95"
                      >
                        {g.label} <X size={12} aria-hidden />
                      </button>
                    ))}
                  </div>
                )}
                {m.serata && (
                  <SerataView
                    serata={m.serata}
                    savedIds={savedIds}
                    saving={saving}
                    bookingMode={c.bookingMode}
                    onOpen={(p) => { setOpenRef({ msgId: m.id, placeId: p.id }); track("apri_scheda", { id: p.id, lat: p.lat, lng: p.lng }, { fonte: "assistente" }); }}
                    onBook={(p) => { setBookCard(p); trackFeature("assistente_prenota"); }}
                    onSave={(p) => void save(p)}
                    onChoose={(i, id) => { patchTappa(m.id, i, { chosenId: id }); trackFeature("assistente_serata", { contesto: "alternativa" }); }}
                    onRoute={() => trackFeature("assistente_serata", { contesto: "google_maps", risultati: m.serata?.tappe.filter((t) => chosenOf(t)).length ?? 0 })}
                  />
                )}
                {m.places && m.places.length > 0 && (
                  <PlaceCards
                    msg={m}
                    booking={c.booking}
                    bookingMode={c.bookingMode}
                    savedIds={savedIds}
                    saving={saving}
                    onOpen={(p) => { setOpenRef({ msgId: m.id, placeId: p.id }); track("apri_scheda", { id: p.id, lat: p.lat, lng: p.lng }, { fonte: "assistente" }); }}
                    onBook={(p) => { setBookCard(p); trackFeature("assistente_prenota"); }}
                    onSave={(p) => void save(p)}
                  />
                )}
                {m.memo && (
                  <div data-testid="assistente-ricorda" className="mt-3 rounded-card border border-border bg-surface px-4 py-3">
                    {m.memo.state === "ask" ? (
                      <>
                        <p className="text-[15px] font-sans leading-snug text-text">
                          <span className="font-display font-semibold">Me lo ricordo?</span> {labelsOf(m.memo.ids)}
                        </p>
                        <p className="mt-0.5 text-xs font-sans text-text-muted">Ne terrò conto nelle prossime ricerche. Lo cancelli quando vuoi dal profilo.</p>
                        <div className="mt-2.5 flex gap-2">
                          <button type="button" data-testid="assistente-ricorda-si" onClick={() => answerMemo(m, true)} className="min-h-10 rounded-pill bg-brand px-4 text-sm font-display font-semibold text-white active:scale-95">
                            ✓ Sì, ricordalo
                          </button>
                          <button type="button" data-testid="assistente-ricorda-no" onClick={() => answerMemo(m, false)} className="min-h-10 rounded-pill border border-border bg-white px-4 text-sm font-display font-semibold text-brand active:scale-95">
                            No
                          </button>
                        </div>
                      </>
                    ) : m.memo.state === "si" ? (
                      <p className="text-sm font-sans leading-snug text-text">
                        Fatto, me lo ricordo: {labelsOf(m.memo.ids)}. Lo trovi nel profilo, in{" "}
                        <Link href="/profilo#cosa-so-di-te" className="font-semibold text-accent">Cosa so di te</Link>.
                      </p>
                    ) : (
                      <p className="text-sm font-sans text-text-muted">Va bene, non lo ricordo.</p>
                    )}
                  </div>
                )}
                {m.zona && m.id === last?.id && m.status !== "loading" && (
                  <div data-testid="assistente-zona" className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    <p className="text-sm font-sans text-text">📍 Di solito vai a {m.zona.nome}: cerco lì?</p>
                    <button
                      type="button"
                      onClick={() => { trackFeature("assistente_memoria", { contesto: "zona" }); submit(m.zona!.send); }}
                      className="min-h-10 rounded-pill border border-brand/40 bg-white px-3.5 text-sm font-display font-semibold text-brand active:scale-95"
                    >
                      Cerca a {m.zona.nome}
                    </button>
                  </div>
                )}
                {m.asks && m.asks.length > 0 && m.id === last?.id && (
                  <div data-testid="assistente-domanda" className="mt-3 flex flex-wrap gap-2">
                    {m.asks.map((a) => (
                      <button key={a.label} type="button" onClick={() => submit(a.send)} className="min-h-10 rounded-pill border border-brand/40 bg-white px-3.5 text-sm font-display font-semibold text-brand active:scale-95">
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
                {/* Azioni principali come chip sotto la risposta (scorrono in orizzontale). */}
                {m.id === lastResultsId && m.id === last?.id && m.status === "done" && !(m.asks && m.asks.length > 0) && (
                  <div data-testid="assistente-seguiti" className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
                    {c.bookingMode && m.places?.[0] && (m.places[0].phone || m.places[0].websiteUri) && (
                      <button
                        type="button"
                        data-testid="assistente-prenota-primo"
                        onClick={() => { const f = m.places![0]; setBookCard(f); trackFeature("assistente_prenota"); }}
                        className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-pill bg-accent px-3.5 text-sm font-display font-semibold text-white active:scale-95"
                      >
                        <CalendarCheck size={15} aria-hidden /> Prenota il primo
                      </button>
                    )}
                    {REFINES.map((a) => (
                      <button key={a.label} type="button" onClick={() => submit(a.send)} className="min-h-10 shrink-0 rounded-pill border border-border bg-white px-3.5 text-sm font-sans font-semibold text-brand active:scale-95">
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
                {/* Semplificare (Lorenzo 17/10): cosa ho capito e "Utile?" in una riga sola, non due blocchi. */}
                {(() => {
                  const nota = m.status !== "loading" && (m.understood || m.note);
                  const utile = m.id === last?.id && m.status === "done" && ((m.places?.length ?? 0) > 0 || !!m.serata);
                  if (!nota && !utile) return null;
                  return (
                    <div className="mt-2 flex flex-wrap items-start gap-x-3 gap-y-2">
                      {nota ? (
                        <p data-testid="assistente-nota" className="min-w-[55%] flex-1 pt-1 text-xs font-sans leading-relaxed text-text-muted">
                          {m.understood && <span data-testid="assistente-capito">Ho capito: {m.understood}. </span>}
                          {m.note}
                        </p>
                      ) : <span className="flex-1" />}
                      {/* "Ti è stato utile?" (piano 7.6): una volta per risposta, solo sull'ultima con posti. */}
                      {utile && (
                        <UtileFeedback
                          contesto={m.serata ? "serata" : "assistente"}
                          risultati={m.serata ? m.serata.tappe.filter((t) => chosenOf(t)).length : m.places?.length ?? 0}
                          chiave={`assistente:${m.id}`}
                          compatto
                          className="max-w-full shrink-0"
                        />
                      )}
                    </div>
                  );
                })()}
              </div>
            ),
          )}
        </div>
        <div ref={endRef} />
      </div>

      {savedToast && (
        <div
          role="status"
          data-testid="assistente-salvato-avviso"
          className="fixed inset-x-3 bottom-[calc(var(--nav-height-mobile)+var(--nav-sporgenza)+4.25rem)] z-40 mx-auto flex max-w-lg items-center gap-3 rounded-card bg-brand px-4 py-3 text-white shadow-float"
        >
          <BookmarkCheck size={18} aria-hidden className="shrink-0 text-accent" />
          <p className="min-w-0 flex-1 text-sm font-sans leading-snug">
            <span className="font-display font-semibold">Salvato</span> tra i tuoi “Voglio andarci”
          </p>
          <Link href={`/mappa?salvato=${savedToast.uuid}`} className="shrink-0 text-sm font-display font-semibold text-accent">
            Sulla mappa
          </Link>
        </div>
      )}

      {/* Campo in basso, sopra la barra di navigazione: scrivi o detta. */}
      <form
        onSubmit={(e) => { e.preventDefault(); submit(input); }}
        className="fixed inset-x-0 bottom-[var(--nav-height-mobile)] z-30 border-t border-border bg-bg/95 px-3 pt-2 pb-[calc(0.5rem+var(--nav-sporgenza))] backdrop-blur"
      >
        {voiceError && <p role="status" className="mx-auto mb-1 max-w-lg px-1 text-xs font-sans text-error">{voiceError}</p>}
        <div className="mx-auto flex max-w-lg items-center gap-1.5 rounded-pill border border-border bg-surface py-1 pl-4 pr-1 shadow-card">
          <input
            data-testid="assistente-campo"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            enterKeyHint="send"
            maxLength={300}
            placeholder={c.msgs.length === 0 ? "Scrivi o detta cosa cerchi…" : "Chiedi altro, es. “più economici”"}
            aria-label="Scrivi all'assistente"
            className="min-h-11 min-w-0 flex-1 bg-transparent text-base font-sans text-text placeholder:text-text-muted focus:outline-none"
          />
          <VoiceButton onText={(t) => submit(t)} onError={setVoiceError} />
          <button
            type="submit"
            aria-label="Invia"
            disabled={busy || input.trim() === ""}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-white disabled:bg-border disabled:text-text-muted active:scale-95"
          >
            <ArrowUp size={18} />
          </button>
        </div>
      </form>

      {openCard && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/40" onClick={() => setOpenCard(null)} data-testid="assistente-scheda">
          <div className="mx-auto mt-14 max-w-lg" onClick={(e) => e.stopPropagation()}>
            <VenueSheet
              venue={openCard}
              isSaved={savedIds.has(openCard.id)}
              onQuickSave={(tag) => void save(openCard, tag)}
              canEdit={false}
              onEdit={() => {}}
              onClose={() => setOpenCard(null)}
              saveSlot={null}
              communitySlot={<CommunityLocale id={openCard.id} userId={userId} contesto="assistente" />}
              origin={c.pos}
              userPos={c.pos}
              googlePlaceId={openCard.id}
              booking={c.bookingMode ? c.booking : null}
            />
          </div>
        </div>
      )}
      {bookCard && (
        <BookingSheet
          place={{ id: bookCard.id, name: bookCard.name, phone: bookCard.phone, websiteUri: bookCard.websiteUri, openNow: bookCard.openNow, lat: bookCard.lat, lng: bookCard.lng }}
          initial={c.booking}
          onClose={() => setBookCard(null)}
        />
      )}
    </main>
  );
}
