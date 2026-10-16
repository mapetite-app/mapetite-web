"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUp, Bookmark, BookmarkCheck, CalendarCheck, Map as MapIcon, RotateCcw, Sparkles } from "lucide-react";
import VenueSheet, { type Venue } from "@/components/venue-sheet";
import BookingSheet from "@/components/booking-sheet";
import VoiceButton from "@/components/voice-button";
import PlacePhoto from "@/components/place-photo";
import { getCategoryEmoji } from "@/lib/emoji";
import { categoryLabel } from "@/lib/category-label";
import { followUpQuery } from "@/lib/follow-up";
import { applyLocalRefine, localRefineOf } from "@/lib/assistant";
import { dateKey, dayLabel, missingDetails, parseBooking, type BookingDetails } from "@/lib/booking";
import { track, trackFeature } from "@/lib/track";
import { prefetchIntent, intentFor } from "@/lib/intent-prefetch";
import { quickSavePlace, savedGoogleIds } from "@/lib/quick-save";
import { loginToSaveUrl, rememberPendingSave } from "@/lib/pending-save";

// ── Conversazione (solo nel telefono: sessionStorage) ──
type Card = Venue & { editorialSummary?: string | null };
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
};
type Msg = UserMsg | BotMsg;
type Conv = {
  msgs: Msg[];
  booking: BookingDetails;
  bookingMode: boolean;
  lastQuery: string | null;
  pos: { lat: number; lng: number } | null;
};

const KEY = "mapetite.assistente";
const EMPTY_BOOKING: BookingDetails = { date: null, time: null, people: null, special: null };
const EMPTY: Conv = { msgs: [], booking: EMPTY_BOOKING, bookingMode: false, lastQuery: null, pos: null };
// Senza posizione e senza città scritta si cerca intorno a Roma, come la mappa all'apertura.
const DEFAULT_CENTER = { lat: 41.9028, lng: 12.4964 };

let conv: Conv | null = null;
const listeners = new Set<() => void>();
function getConv(): Conv {
  if (conv) return conv;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Conv) : null;
    // Una ricerca rimasta "in corso" (pagina chiusa a metà) non deve bloccare la conversazione.
    conv = parsed && Array.isArray(parsed.msgs)
      ? { ...EMPTY, ...parsed, msgs: parsed.msgs.map((m) => (m.role === "assistant" && (m.status === "loading" || m.status === "verdicts") ? { ...m, status: m.status === "loading" ? "error" : "done", text: m.status === "loading" ? "Ricerca interrotta: riprova." : m.text } : m)) }
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
  { emoji: "🗓️", text: "Prenotami domani alle 21 per 2 con terrazza a Roma" },
  { emoji: "🍝", text: "Trattoria non turistica a Testaccio" },
  { emoji: "🍸", text: "Aperitivo con vista a Milano" },
  { emoji: "🥞", text: "Brunch domenica per 4 a Roma" },
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

// Secondo tempo: i verdetti (come la mappa), a gruppi in parallelo; esclusi e ordine alla fine.
async function loadVerdicts(msgId: string, query: string, pending: Pending) {
  if (!pending) { patchMsg(msgId, { status: "done" }); return; }
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
      patchMsg(msgId, (m) => ({ places: (m.places ?? []).map((p) => (part.dettagli?.[p.id] ? { ...p, ...part.dettagli[p.id] } : p)) }));
      return part;
    } catch {
      return null; // un gruppo perso non ferma gli altri: quelle card restano con i dati Google
    }
  }));
  const esclusi = new Set(replies.flatMap((r) => r?.esclusi ?? []));
  const livelli: Record<string, string> = Object.assign({}, ...replies.map((r) => r?.livelli ?? {}));
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

async function runSearch(q: string, booking: BookingDetails, bookingMode: boolean, pos: { lat: number; lng: number } | null) {
  const msgId = newId();
  setConv((c) => ({ ...c, lastQuery: q, msgs: [...c.msgs, { id: msgId, role: "assistant", text: "", status: "loading", query: q }] }));
  const at = pos ?? DEFAULT_CENTER;
  try {
    // Frase già capita mentre si scriveva (come la mappa): la ricerca non riaspetta l'AI.
    const intent = await intentFor(q);
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: q, source: "world", searchIntent: "natural", phase: "fast",
        ...(intent && { intent, intentQuery: q.trim() }),
        lat: at.lat, lng: at.lng,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      patchMsg(msgId, { status: "error", text: data?.error ?? "Qualcosa è andato storto. Riprova." });
      return;
    }
    const places = ((data.risultati ?? []) as RawPlace[]).filter((p) => p.lat != null && p.lng != null).map(toCard);
    const f = data.filtri_usati as { categoria?: string | null; parole_chiave?: string[]; zona?: string | null; vicino_a_me?: boolean } | undefined;
    const understood = [f?.categoria, ...(f?.parole_chiave ?? []).slice(0, 3), f?.zona].filter(Boolean).join(" · ");
    const notes: string[] = [];
    if ((data.da_parte?.turistici ?? []).length > 0) notes.push("Ho messo in fondo i posti più turistici.");
    if (!f?.zona && !pos && !f?.vicino_a_me) notes.push("Ho cercato intorno a Roma: scrivi la città se sei altrove.");
    let text: string;
    let asks: Ask[] | undefined;
    if (places.length === 0) {
      text = `Non ho trovato posti per “${q}”. Prova con meno requisiti o un'altra zona.`;
    } else if (bookingMode) {
      const summary = bookingSummary(booking);
      const ask = askFor(booking);
      text = `${summary ? `Per ${summary}: ` : ""}ecco ${places.length} ${places.length === 1 ? "posto adatto" : "posti adatti"}. Tocca “Prenota” sul tuo preferito: il messaggio per il locale lo preparo io.${ask ? ` ${ask.question}` : ""}`;
      asks = ask?.asks;
      notes.push("I tavoli liberi non li vedo: la conferma arriva sempre dal locale.");
    } else {
      text = `Ecco ${places.length} ${places.length === 1 ? "posto" : "posti"} per “${q}”.`;
    }
    patchMsg(msgId, { places, text, understood: understood || null, note: notes.join(" ") || null, asks, status: data.sintesi_pendente ? "verdicts" : "done" });
    if (data.sintesi_pendente) void loadVerdicts(msgId, q, data.sintesi_pendente as Pending);
  } catch {
    patchMsg(msgId, { status: "error", text: "Errore di rete. Controlla la connessione e riprova." });
  }
}

function lastResults(c: Conv): BotMsg | null {
  for (let i = c.msgs.length - 1; i >= 0; i--) {
    const m = c.msgs[i];
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
  return searchQueryOf(text, parseBooking(text), c.lastQuery);
}

// Segnale "funzione" dell'assistente: mai il testo scritto, solo che tipo di messaggio era.
const trackMsg = (contesto: "saluto" | "seguito" | "ricerca" | "prenotazione" | "dettagli") =>
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
  if (q) {
    trackMsg(parsed.isBooking ? "prenotazione" : "ricerca");
    // "solo con terrazza" dopo una ricerca: seguito che riformula la richiesta di prima.
    if (before.lastQuery && q !== searchQueryOf(text, parsed, null)) trackFeature("assistente_seguito", { contesto: "ricerca" });
    await runSearch(q, booking, bookingMode, getConv().pos);
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
    text: `Perfetto: ${summary}.${ask ? ` ${ask.question}` : " Tocca “Prenota” sul posto che preferisci: il messaggio è già pronto."}`,
    asks: ask?.asks,
  });
}

// ── Interfaccia ──
const priceOf = (n: number | null) => (n != null && n > 0 ? "€".repeat(n) : null);
const ratingOf = (r: number | null) => (r != null ? `★ ${r.toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}` : null);

type SaveState = "saving" | "error";

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
        <li key={p.id} className="relative w-[78%] max-w-[300px] shrink-0 snap-start">
          <button
            type="button"
            onClick={() => onOpen(p)}
            aria-label={`Apri ${p.name}`}
            className="relative flex h-full min-h-[220px] w-full flex-col overflow-hidden rounded-card bg-brand p-4 pb-16 text-left text-white shadow-float active:scale-[0.99]"
          >
            {i < 6 && p.photoRef && (
              <>
                <PlacePhoto photoRef={p.photoRef} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-brand via-brand/75 to-brand/20" />
              </>
            )}
            <span className="relative flex flex-1 flex-col">
              <span className="flex items-start justify-between gap-2">
                <span className="text-2xl leading-none" aria-hidden>{getCategoryEmoji(p.category, p.name)}</span>
                {showOpen && p.openNow != null && (
                  <span className={`rounded-pill px-2 py-0.5 text-[10px] font-display font-medium ${p.openNow ? "bg-white/15" : "bg-black/30 text-white/80"}`}>
                    {p.openNow ? "Aperto ora" : "Chiuso ora"}
                  </span>
                )}
              </span>
              <span className="mt-auto pt-6 line-clamp-2 font-title text-lg font-semibold leading-snug">{p.name}</span>
              <span className="mt-0.5 truncate text-[13px] font-sans font-medium text-white/85">
                {[categoryLabel(p.category), priceOf(p.priceLevel), ratingOf(p.rating)].filter(Boolean).join(" · ")}
              </span>
              {p.verdict ? (
                <span className="mt-2 block">
                  <span data-testid="assistente-verdetto" className="block text-[10px] font-display font-semibold uppercase tracking-wide text-accent">Il verdetto Mapetite</span>
                  <span className="mt-0.5 line-clamp-2 text-sm font-sans font-medium leading-snug text-white">{p.verdict}</span>
                </span>
              ) : msg.status === "verdicts" ? (
                <span data-testid="assistente-verdetto-attesa" className="mt-2 block space-y-1.5" aria-label="Preparo il verdetto">
                  <span className="block h-2.5 w-24 animate-pulse rounded bg-white/25" />
                  <span className="block h-3 w-full animate-pulse rounded bg-white/20" />
                </span>
              ) : p.editorialSummary ? (
                <span className="mt-2 line-clamp-2 text-sm font-sans leading-snug text-white/80">{p.editorialSummary}</span>
              ) : null}
            </span>
          </button>
          {/* Salva in un tocco ("📌 Voglio andarci", come il segnalibro della mappa) e Prenota. */}
          <div className="absolute bottom-3 left-3 right-3 flex gap-2">
            {savedIds.has(p.id) ? (
              <span
                role="status"
                data-testid="assistente-salvato"
                aria-label={`${p.name} è nei tuoi salvati`}
                className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-pill bg-white text-sm font-display font-semibold text-brand"
              >
                <BookmarkCheck size={16} aria-hidden /> Salvato
              </span>
            ) : (
              <button
                type="button"
                data-testid="assistente-salva"
                onClick={() => onSave(p)}
                disabled={saving[p.id] === "saving"}
                aria-label={`Salva ${p.name} tra i Voglio andarci`}
                className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-pill bg-white/15 text-sm font-display font-semibold text-white backdrop-blur active:scale-[0.98] disabled:opacity-80"
              >
                <Bookmark size={16} aria-hidden />
                {saving[p.id] === "saving" ? "Salvo…" : saving[p.id] === "error" ? "Riprova" : "Salva"}
              </button>
            )}
            {(p.phone || p.websiteUri) && (
              <button
                type="button"
                data-testid="assistente-prenota"
                onClick={() => onBook(p)}
                aria-label={`Prenota da ${p.name}`}
                className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-pill text-sm font-display font-semibold active:scale-[0.98] ${bookingMode ? "bg-accent text-white" : "bg-white/15 text-white backdrop-blur"}`}
              >
                <CalendarCheck size={16} aria-hidden /> Prenota
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

const WANT = "Da provare";

export default function AssistenteView({ userId }: { userId: string | null }) {
  const c = useSyncExternalStore(subscribe, getConv, () => EMPTY);
  const [input, setInput] = useState("");
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
  const openCard = openMsg?.role === "assistant" ? openMsg.places?.find((p) => p.id === openRef?.placeId) ?? null : null;
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

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-var(--nav-height-mobile))] max-w-lg flex-col bg-bg md:min-h-[calc(100dvh-3.5rem)]">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-border bg-bg/95 px-4 py-2.5 backdrop-blur md:top-14">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-white"><Sparkles size={18} aria-hidden /></span>
          <div className="min-w-0">
            <h1 className="font-display text-base font-semibold leading-tight text-brand">Assistente Mapetite</h1>
            <p className="truncate text-xs font-sans text-text-muted">Trova, filtra, prenota</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Link href="/mappa" aria-label="Apri la mappa" className="flex h-10 w-10 items-center justify-center rounded-full text-brand"><MapIcon size={18} /></Link>
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

      <div className="flex-1 px-4 pb-28 pt-4" data-testid="assistente-conversazione">
        {c.msgs.length === 0 && (
          <div data-testid="assistente-benvenuto" className="pt-6">
            <p className="font-title text-3xl font-semibold leading-tight text-text">Ciao! Dimmi cosa cerchi.</p>
            <p className="mt-2 text-[15px] font-sans leading-relaxed text-text-muted">
              Scrivi o detta come lo diresti a un amico. Trovo i posti giusti per te, non i più famosi, e se vuoi ti preparo la prenotazione.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              {EXAMPLES.map((e) => (
                <button
                  key={e.text}
                  type="button"
                  onClick={() => submit(e.text)}
                  className="flex min-h-12 items-center gap-3 rounded-card border border-border bg-surface px-4 py-3 text-left text-[15px] font-sans text-text active:scale-[0.99]"
                >
                  <span aria-hidden className="text-xl">{e.emoji}</span> “{e.text}”
                </button>
              ))}
            </div>
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
                {m.status === "loading" ? (
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
                    <p className={`text-[15px] font-sans leading-relaxed ${m.status === "error" ? "text-error" : "text-text"}`}>{m.text}</p>
                    {m.understood && <p className="mt-1 text-xs font-sans text-text-muted">Ho capito: {m.understood}</p>}
                  </>
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
                {m.status === "verdicts" && <p className="mt-1 text-xs font-sans text-text-muted">Sto scrivendo i verdetti…</p>}
                {m.note && <p data-testid="assistente-nota" className="mt-1 text-xs font-sans leading-relaxed text-text-muted">{m.note}</p>}
                {m.asks && m.asks.length > 0 && m.id === last?.id && (
                  <div data-testid="assistente-domanda" className="mt-3 flex flex-wrap gap-2">
                    {m.asks.map((a) => (
                      <button key={a.label} type="button" onClick={() => submit(a.send)} className="min-h-10 rounded-pill border border-brand/40 bg-white px-3.5 text-sm font-display font-semibold text-brand active:scale-95">
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
                {m.id === lastResultsId && m.id === last?.id && m.status === "done" && !(m.asks && m.asks.length > 0) && (
                  <div data-testid="assistente-seguiti" className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
                    {REFINES.map((a) => (
                      <button key={a.label} type="button" onClick={() => submit(a.send)} className="min-h-10 shrink-0 rounded-pill bg-surface px-3.5 text-sm font-sans font-semibold text-brand active:scale-95">
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
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
          className="fixed inset-x-3 bottom-[calc(var(--nav-height-mobile)+4.25rem)] z-40 mx-auto flex max-w-lg items-center gap-3 rounded-card bg-brand px-4 py-3 text-white shadow-float"
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
        className="fixed inset-x-0 bottom-[var(--nav-height-mobile)] z-30 border-t border-border bg-bg/95 px-3 py-2 backdrop-blur"
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
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white disabled:bg-border disabled:text-text-muted active:scale-95"
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
              communitySlot={null}
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
