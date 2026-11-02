"use client";

import { tagLabel, isStateTag } from "@/lib/tags";
import { X, Quote, Navigation, Globe, Phone, Check, Share, Share2, Footprints, CalendarCheck, Ellipsis, UsersRound, Store, ExternalLink, MapPin, Clock, Pencil, BadgeCheck, ChevronRight, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useBeta, useOptIn, useVariant } from "@/lib/beta";
import Link from "next/link";
import { track, trackFeature } from "@/lib/track";
import { isUuid } from "@/lib/gruppi";
import { bookingMakesSense } from "@/lib/bookable";
import SchedaCarosello from "@/components/scheda-carosello";
import AmiciQuiBox, { type FriendPerson } from "@/components/amici-qui-box";
import { mapetiteShareUrl } from "@/lib/share-place";
import { isGem } from "@/lib/gem";
import PlacePhoto from "@/components/place-photo";
import { getCategoryEmoji } from "@/lib/emoji";
import { nomeLeggibile } from "@/lib/nome-leggibile";
import { categoryLabel } from "@/lib/category-label";
import { cityFromAddress, displayAddress } from "@/lib/city";
import { distanceLabel, walkMinutes } from "@/lib/distance";
import BookingSheet, { type BookingAlternative } from "@/components/booking-sheet";
import type { BookingDetails } from "@/lib/booking";
import { VisitaContext } from "@/lib/visita-context";
import { votoOf, votoTag } from "@/lib/diario";
import ConfrontoFonti from "@/components/confronto-fonti";
import { AperturaPillola, PostoPillola, useInfoLocale } from "@/components/posto-locale";
import { apertoIl, orariDelGiorno, prossimaApertura, prossimaChiusura, type Orari } from "@/lib/orari";
import BuoniPastoRiga from "@/components/buoni-pasto-riga";
import VisiteMapetite from "@/components/visite-mapetite";

// Riquadri della barra azioni teal (mockup A "Editoriale", 21/10): icona e parola su una riga, 50px.
// La stessa classe la usa il pulsante Salva della mappa (SaveButton in map-view, prop `tile`).
export const ACTION_TILE =
  "flex h-[50px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[15px] px-2 text-[14.5px] font-display font-semibold text-white transition-transform active:scale-95";
// Mockup A: nome e verdetto in serif editoriale (Newsreader, già caricato in layout.tsx, come la home),
// fondo carta caldo come la home nuova.
const SERIF = "font-[family-name:var(--font-newsreader)]";
const PAPER = "bg-[#f8f6f2]";
const TILE = `${ACTION_TILE} bg-white/10`;

type SchedaTab = "panoramica" | "recensioni" | "info";

type Friends = { visitati: FriendPerson[]; daProvare: FriendPerson[] };

export type Venue = {
  id: string;
  name: string;
  address: string | null;
  category: string | null;
  // Tutti i tipi Google (solo dai risultati di ricerca): stessa emoji della card e del segnalino.
  types?: string[] | null;
  rating: number | null;
  userRatingCount: number | null;
  priceLevel: number | null;
  openNow: boolean | null;
  websiteUri: string | null;
  phone: string | null;
  lat: number;
  lng: number;
  selectedReviews: { text: string }[] | null;
  synthesis: string | null;
  tags: string[] | null;
  verdict: string | null;
  goFor: string[] | null;
  dontExpect: string[] | null;
  matchReason: string | null;
  personalTags: string[] | null;
  personalNote: string | null;
  photoRef?: string | null;
  orari?: Orari | null;
  photoAuthor?: string | null;
  // "Per te" dai gusti (mappa del gusto): scritto dall'AI solo con i gusti veri (vedi haiku-synthesis).
  perTe?: string | null;
  // Requisiti della ricerca confermati, con la frase della recensione che li prova (proposta 18).
  requisiti?: { r: string; prova: string }[] | null;
  // Frase di Google sul locale: si mostra, dichiarata, solo se il verdetto manca.
  editorialSummary?: string | null;
};

type VenueSheetProps = {
  venue: Venue;
  isSaved: boolean;
  canEdit: boolean; // true solo in vista "saved"
  onEdit: () => void;
  onClose: () => void;
  saveSlot: React.ReactNode; // <SaveButton .../> renderizzato da map-view
  communitySlot: React.ReactNode; // "Dalla community Mapetite" (CommunityLocale), da map-view
  origin?: { lat: number; lng: number } | null; // per "Roma · 600 m"
  userPos?: { lat: number; lng: number } | null; // posizione reale dell'utente, per i minuti a piedi
  onVisitStatus?: (status: "Da provare" | "Già visitato") => void; // solo per i locali salvati
  onOpinion?: (opinion: "Mi è piaciuto" | "Non fa per me") => void; // "Com'era?" dopo "Ci sono stato"
  googlePlaceId?: string | null; // Place ID Google (i salvati hanno l'UUID come id)
  // Locale non ancora salvato: "📌 Da provare / ✓ Ci sono stato" aprono Salva con lo stato già scelto.
  onQuickSave?: (status: "Da provare" | "Già visitato") => void;
  // Prenotazione assistita: giorno, ora e persone già capiti (dall'assistente), da confermare.
  booking?: Partial<BookingDetails> | null;
  // Salvato senza verdetto: il server lo sta scrivendo (/api/places/verdetto).
  verdettoInArrivo?: boolean;
  // Classifica personale (piano 4.3) sotto "Com'era?": la passa map-view solo per i salvati visitati.
  rankSlot?: React.ReactNode;
  // Prenota: locali della stessa ricerca da proporre se a quell'ora questo è chiuso; aprendo uno di
  // loro il foglio Prenota si apre già (autoBook) con gli stessi dati.
  bookingAlternatives?: BookingAlternative[];
  onBookAlternative?: (id: string, details: BookingDetails) => void;
  autoBook?: boolean;
  onBookingClosed?: () => void;
  // "Altri come questo" (proposta 27): solo per i salvati con 👍 o "Ci sono stato" (e non 👎).
  onAltriCome?: () => void;
  // "‹ 2 di 8 ›" tra i risultati (revisore del 2/11, D28: la pillola galleggiava sopra la scheda): sta dentro
  // la barra azioni in basso, la scheda prende tutto lo spazio.
  nav?: { pos: number; total: number } | null;
  onNavPrev?: () => void;
  onNavNext?: () => void;
};

// "In breve" senza etichette quasi uguali ("intimo" e "esperienza intima", collaudo 23/10): un'etichetta
// le cui parole (tolta la desinenza) stanno già tutte in una precedente, o viceversa, è un doppione.
const PAROLE_VUOTE = new Set(["esperienza", "atmosfera", "ambiente", "locale", "posto", "molto", "davvero", "della", "dello", "delle", "degli"]);
function radici(t: string): Set<string> {
  return new Set(t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z]+/)
    .filter((w) => w.length >= 4 && !PAROLE_VUOTE.has(w)).map((w) => w.replace(/[aeio]$/, "")));
}
function senzaDoppioni(etichette: string[]): string[] {
  const viste: Set<string>[] = [];
  const out: string[] = [];
  const dentro = (a: Set<string>, b: Set<string>) => a.size > 0 && [...a].every((x) => b.has(x));
  for (const e of etichette) {
    const r = radici(e);
    if (r.size > 0 && viste.some((v) => dentro(r, v) || dentro(v, r))) continue;
    if (out.some((o) => o.toLowerCase() === e.trim().toLowerCase())) continue;
    viste.push(r);
    out.push(e.trim());
  }
  return out;
}

export default function VenueSheet({
  venue,
  isSaved,
  canEdit,
  onEdit,
  onClose,
  saveSlot,
  communitySlot,
  origin = null,
  userPos = null,
  onVisitStatus,
  onOpinion,
  googlePlaceId = null,
  onQuickSave,
  booking = null,
  rankSlot,
  verdettoInArrivo = false,
  bookingAlternatives,
  onBookAlternative,
  autoBook = false,
  onBookingClosed,
  onAltriCome,
  nav = null,
  onNavPrev,
  onNavNext,
}: VenueSheetProps) {
  const {
    name,
    address,
    category,
    rating,
    userRatingCount,
    priceLevel,
    openNow,
    websiteUri,
    phone,
    lat,
    lng,
    selectedReviews,
    synthesis,
    tags,
    verdict,
    goFor,
    dontExpect,
    matchReason,
    personalTags,
    personalNote,
  } = venue;
  // Segnali di comportamento (percorso, chiama, sito, condividi): vedi src/lib/track.ts.
  // `da` distingue i tocchi della barra azioni in basso da quelli nel resto della scheda.
  const signal = (type: "percorso" | "chiama" | "sito" | "condividi", da?: string) =>
    track(type, { id: venue.id, lat, lng }, da ? { fonte: da } : undefined);

  // "Chi dei tuoi amici c'è stato" (piano 6.2): stessa lettura della pagina pubblica del locale.
  // Per chi non ha l'accesso o non segue nessuno la risposta è vuota e non si mostra nulla.
  // venue.id: UUID per i salvati, Place ID Google per i risultati (il server trova la riga).
  const friendsKey = venue.id;
  // Tocco su "✓ Ci sono stato" in questa scheda (per il foglio del diario): legato al locale, così
  // passando a un altro con "‹ ›" non si apre lì.
  // "Come lo sai?" (proposta 18): quale ✓ mostra la sua frase di recensione.
  const [provaAperta, setProvaAperta] = useState<string | null>(null);
  // La frase si porta in vista SOLO quando si tocca un ✓ (prima ripartiva a ogni aggiornamento della scheda).
  useEffect(() => {
    if (!provaAperta) return;
    document.querySelector("[data-testid=prova-recensione]")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [provaAperta]);
  const [visitAsked, setVisitAsked] = useState<{ id: string; at: number } | null>(null);
  const visitAskedAt = visitAsked?.id === venue.id ? visitAsked.at : null;
  const setVisitAskedAt = (at: number | null) => setVisitAsked(at == null ? null : { id: venue.id, at });
  const [friends, setFriends] = useState<{ key: string; data: Friends | null } | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/places/amici?id=${encodeURIComponent(friendsKey)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { amici?: Friends | null } | null) => setFriends({ key: friendsKey, data: j?.amici ?? null }))
      .catch(() => { /* rete assente o scheda chiusa: niente riga amici */ });
    return () => ctrl.abort();
  }, [friendsKey]);
  const friendsData = friends?.key === friendsKey ? friends.data : null;

  // Scheda completa su Google Maps (orari, foto, tutte le recensioni): con il Place ID se c'è.
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}${googlePlaceId ? `&query_place_id=${encodeURIComponent(googlePlaceId)}` : ""}`;
  const shareOn = useBeta("condividi");
  const gem = useOptIn("gemme") && isGem(rating, userRatingCount, name);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [addressCopied, setAddressCopied] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(autoBook);
  // Scheda B: sezione aperta e menu "Altro".
  const [tab, setTab] = useState<SchedaTab>("info");
  const [menuOpen, setMenuOpen] = useState(false);
  const [settimanaOpen, setSettimanaOpen] = useState(false);
  // Mockup A: "Orari, contatti, recensioni ›" apre il resto della scheda.
  const [detailsOpen, setDetailsOpen] = useState(false);
  // Foto che si abbassa finché "Orari, contatti, recensioni" non sta sopra la barra Prenota/Percorso/Salva:
  // con verdetto lungo, "Per te" e ✓ le altezze fisse per schermo non bastavano (iPhone SE, collaudo 24/10).
  // Si misura dopo ogni render (il verdetto arriva dopo), solo a scheda ferma in cima; si riparte a ogni locale.
  const [fotoBassa, setFotoBassa] = useState<{ id: string; livello: number }>({ id: venue.id, livello: 0 });
  const livelloFoto = fotoBassa.id === venue.id ? fotoBassa.livello : 0;
  useEffect(() => {
    if (livelloFoto >= 2 || detailsOpen) return;
    const raf = requestAnimationFrame(() => {
      const riga = document.querySelector("[data-testid=scheda-altro-info]")?.getBoundingClientRect();
      const barra = document.querySelector("[data-testid=barra-azioni]")?.getBoundingClientRect();
      if (riga && barra && riga.height > 0 && riga.bottom > barra.top) setFotoBassa({ id: venue.id, livello: livelloFoto + 1 });
    });
    return () => cancelAnimationFrame(raf);
  });
  const share = async () => {
    signal("condividi");
    // Link Mapetite (pagina pubblica con il verdetto); se non si può creare, Google Maps.
    const mapetiteUrl = await mapetiteShareUrl({ ...venue, lat, lng });
    const url = mapetiteUrl ?? mapsUrl;
    const base = verdict?.trim() ? `${name} — ${verdict.trim()}` : name;
    const text = mapetiteUrl ? `${base} · su Mapetite` : base;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: name, text, url });
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setShareNote("Link copiato");
        setTimeout(() => setShareNote(null), 2500);
      }
    } catch (err) {
      // Chiuso il foglio di condivisione: nessun errore. Se invece il telefono non accetta più il
      // tocco (attesa per creare il link), il link ora è pronto: basta toccare di nuovo.
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setShareNote("Link pronto: tocca di nuovo Condividi");
        setTimeout(() => setShareNote(null), 4000);
      }
    }
  };

  const hasReviews = selectedReviews != null && selectedReviews.length > 0;
  // Verdetto bipolare come CHIP: filtra gli elementi non vuoti dell'array.
  // dont_expect è spesso [] per il vincolo feroce lato prompt → resta nascosto.
  const matchReasonText =
    matchReason != null && matchReason.trim() !== "" ? matchReason.trim() : null;
  const verdictText =
    verdict != null && verdict.trim() !== "" ? verdict.trim() : null;
  const goForChips = senzaDoppioni(Array.isArray(goFor)
    ? goFor.filter((c) => c != null && c.trim() !== "").map((c) => c.trim())
    : []);
  const dontExpectChips = Array.isArray(dontExpect)
    ? dontExpect.filter((c) => c != null && c.trim() !== "").map((c) => c.trim())
    : [];
  // La card appare se c'è ALMENO UNO tra verdict, synthesis, matchReason e i due
  // poli: tutto vive ora in un'unica card teal (matchReason incluso, niente più
  // banner esterno).
  const hasVerdictBlock =
    verdictText != null ||
    synthesis != null ||
    matchReasonText != null ||
    goForChips.length > 0 ||
    dontExpectChips.length > 0;
  const hasTags = tags != null && tags.length > 0;
  const hasPersonalTags = personalTags != null && personalTags.length > 0;
  const showPersonalBlock =
    isSaved && (hasPersonalTags || personalNote != null || canEdit || onVisitStatus != null);
  const priceLabel =
    priceLevel != null && priceLevel > 0 ? "€".repeat(priceLevel) : null;
  // Come Places: se il locale è raggiungibile a piedi, il pulsante percorso mostra i minuti.
  const walk = userPos ? walkMinutes(userPos, { lat, lng }) : null;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  const telHref = phone != null ? `tel:${phone.replace(/[^\d+]/g, "")}` : null;
  // Barra azioni della scheda B (piano 6.2, come Places): Prenota / Percorso / Salva dove si
  // prenota, altrimenti Chiama (o Sito) / Percorso / Salva. Dall'assistente (prenotazione già
  // avviata) Prenota c'è sempre se il locale ha un telefono o un sito.
  const canBook = booking != null ? phone != null || websiteUri != null : bookingMakesSense({ category, phone, websiteUri });
  const lead: "prenota" | "chiama" | "sito" | null = canBook ? "prenota" : telHref ? "chiama" : websiteUri ? "sito" : null;
  // Senza Salva (scheda aperta dall'assistente) il terzo posto va a Chiama o al sito.
  const extra: "chiama" | "sito" | null = saveSlot
    ? null
    : lead !== "chiama" && telHref ? "chiama" : lead !== "sito" && websiteUri ? "sito" : null;
  const inBar = (a: "chiama" | "sito") => lead === a || extra === a;
  const openBooking = (da: string) => {
    track("funzione", { id: venue.id, lat, lng }, { nome: "prenota", fonte: da });
    setBookingOpen(true);
  };
  // Variante della scheda da far scegliere (?scheda=b, stile Places); "a" = attuale.
  const variant = useVariant("scheda");
  // Locale verificato e "c'è posto" (parola del titolare): spunta accanto al nome e pillola sotto.
  const infoLocale = useInfoLocale(venue.id);
  const emoji = getCategoryEmoji(category, name, venue.types);
  // "A confronto" (Lorenzo 17/10): Mapetite, Google, Tripadvisor, Michelin, TheFork in poche righe.
  const confronto = (onMapetite?: () => void) => (
    <ConfrontoFonti
      venueId={venue.id}
      name={name}
      address={address}
      category={category}
      lat={lat}
      lng={lng}
      rating={rating}
      userRatingCount={userRatingCount}
      mapsUrl={mapsUrl}
      onMapetite={onMapetite}
    />
  );

  // Il riquadro scuro "Il verdetto Mapetite" (piace a Lorenzo, 12/10): uguale nelle due schede.
  const verdictCard = hasVerdictBlock ? (
      <div className="mx-5 mt-4 rounded-card bg-brand p-5 shadow-card">
        {(verdictText != null || synthesis != null) && (
          <>
            <p data-testid="verdetto-scheda" className="text-xs font-display font-semibold uppercase tracking-wide text-accent">
              Il verdetto Mapetite
            </p>
            {verdictText && (
              <p className="mt-2 font-display text-xl font-semibold leading-relaxed text-white">
                {verdictText}
              </p>
            )}
            {synthesis != null && (
              <p className="mt-2 font-sans text-sm leading-relaxed text-white/80">
                {synthesis}
              </p>
            )}
          </>
        )}

        {/* matchReason al centro: solo nei risultati (null nei salvati → niente
            riga né separatore orfano). Separatore solo se c'è contenuto sopra. */}
        {matchReasonText && (
          <div
            className={
              verdictText != null || synthesis != null
                ? "mt-4 border-t border-white/15 pt-3"
                : ""
            }
          >
            <p className="text-xs font-display font-semibold uppercase tracking-wide text-accent">
              ✦ Per la tua ricerca
            </p>
            <p className="mt-1 font-sans text-sm leading-relaxed text-white/90">
              {matchReasonText}
            </p>
          </div>
        )}

        {/* Chip bipolari in fondo, colori su-teal: orientamento, mai stroncatura. */}
        {goForChips.length > 0 && (
          <div
            className={
              verdictText != null || synthesis != null || matchReasonText != null
                ? "mt-4 border-t border-white/15 pt-3"
                : ""
            }
          >
            <p className="text-xs font-display font-semibold uppercase tracking-wide text-white/80">
              Ci dovresti andare se
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {goForChips.map((chip) => (
                <span
                  key={chip}
                  className="inline-flex items-center gap-1 rounded-pill bg-white/15 px-2.5 py-1 text-xs font-display font-medium text-white"
                >
                  <Check size={12} className="shrink-0" />
                  {chip}
                </span>
              ))}
            </div>
          </div>
        )}
        {dontExpectChips.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-display font-semibold uppercase tracking-wide text-white/60">
              Meno adatto se
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {dontExpectChips.map((chip) => (
                <span
                  key={chip}
                  className="inline-flex items-center gap-1 rounded-pill bg-white/10 px-2.5 py-1 text-xs font-display font-medium text-white/60"
                >
                  <X size={12} className="shrink-0" />
                  {chip}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
  ) : null;

  // "Le tue note": stato, Com'era, classifica, tag e nota del salvato. withStatus=false quando
  // "Da provare / Ci sono stato" stanno già nella riga delle azioni (scheda B).
  // senzaFiletto: subito sotto il verdetto, che ha già il suo filetto (collaudo 22/10: doppio filetto nei salvati).
  const personalBlock = (withStatus: boolean, editorial = false, senzaFiletto = false) => (
    <div data-testid="tue-note" className={editorial ? `mx-[22px] ${senzaFiletto ? "mt-3.5" : "mt-4 border-t border-[#e3ddd2] pt-3.5"}` : "mx-5 mt-4 rounded-card border-2 border-accent/30 bg-surface p-4"}>
        <p className={`font-display font-semibold uppercase text-accent ${editorial ? "text-[10.5px] tracking-[0.14em]" : "text-xs tracking-wide"}`}>
          Le tue note
        </p>
        {withStatus && onVisitStatus && (
          <div className="mt-2 flex gap-2" data-testid="stato-salvato">
            {([["Da provare", "📌 Da provare"], ["Già visitato", "✓ Ci sono stato"]] as const).map(([tag, label]) => {
              const on = personalTags?.includes(tag) ?? false;
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    // Diario (4.4): appena segnato "Ci sono stato", il foglio "Com'è andata?" (diario-scheda).
                    if (tag === "Già visitato" && !on) setVisitAskedAt(Date.now());
                    onVisitStatus(tag);
                  }}
                  className={`min-h-10 flex-1 rounded-pill border px-3 text-sm font-display font-semibold active:scale-95 ${on ? "border-brand bg-brand text-white" : "border-border bg-white text-brand"}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
        {/* "Com'era?" (segnale per i suggerimenti, VISIONE.md): solo dopo "Ci sono stato". */}
        {onOpinion && personalTags?.includes("Già visitato") && (
          <div className="mt-3" data-testid="com-era">
            <p className="text-sm font-display font-semibold text-text">Com&apos;era?</p>
            <div className="mt-1.5 flex gap-2">
              {([["Mi è piaciuto", "👍 Mi è piaciuto"], ["Non fa per me", "👎 Non fa per me"]] as const).map(([tag, label]) => {
                const on = personalTags?.includes(tag) ?? false;
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onOpinion(tag)}
                    className={`min-h-10 flex-1 rounded-pill border px-3 text-sm font-display font-semibold active:scale-95 ${on ? "border-accent bg-accent text-white" : "border-border bg-white text-brand"}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {/* Proposta 27: dal posto che ti è piaciuto, una ricerca con i suoi tratti (vedi altriCome in map-view). */}
            {onAltriCome && !personalTags?.includes("Non fa per me") && (
              <button
                type="button"
                data-testid="altri-come"
                onClick={onAltriCome}
                className="mt-2 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-pill border border-accent/40 bg-accent/5 px-4 text-sm font-display font-semibold text-accent active:scale-[0.98]"
              >
                ✨ Altri come questo
              </button>
            )}
            {/* Proposta CEO 20/10: ti è piaciuto un posto poco recensito? Un tocco per lasciare due righe su Google,
                dove servono al locale (link pubblico di Google, nessun dato passa da noi). Non sui locali con 300 recensioni o più (non ne hanno bisogno). */}
            {personalTags?.includes("Mi è piaciuto") && googlePlaceId && !/^[0-9a-f-]{36}$/i.test(googlePlaceId) && (userRatingCount == null || userRatingCount < 300) && (
              <a
                data-testid="recensione-google"
                href={`https://search.google.com/local/writereview?placeid=${encodeURIComponent(googlePlaceId)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackFeature("recensione_google", userRatingCount != null ? { risultati: userRatingCount } : undefined)}
                className="mt-2 flex min-h-11 items-center gap-1.5 text-xs font-sans text-text-muted underline-offset-2 hover:underline"
              >
                ✍️ Ti è piaciuto? Aiuta il locale: lascia due righe su Google
              </a>
            )}
            <VisitaContext.Provider value={{
              askedAt: visitAskedAt,
              consume: () => setVisitAskedAt(null),
              voto: votoOf(personalTags),
              // Passa da map-view (onOpinion), che tiene lo stato dei salvati: ritoccare lo stesso voto lo toglie.
              setVoto: (v) => {
                const cur = votoOf(personalTags);
                if (v === cur) return;
                onOpinion(v ? votoTag(v) : votoTag(cur!));
              },
              note: personalNote,
              onEditNote: onEdit,
            }}>
              {rankSlot}
            </VisitaContext.Provider>
          </div>
        )}
        {personalTags?.some((t) => !onVisitStatus || !isStateTag(t)) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {personalTags!.filter((t) => !onVisitStatus || !isStateTag(t)).map((tag) => (
              <span
                key={tag}
                className="rounded-pill border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-display font-medium text-accent"
              >
                {tagLabel(tag)}
              </span>
            ))}
          </div>
        )}
        {personalNote != null && (
          <p className="mt-2 font-sans italic text-text">{personalNote}</p>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="mt-3 min-h-10 rounded-btn border border-border px-4 py-1 text-sm font-display font-semibold text-text-muted hover:text-text"
          >
            Modifica
          </button>
        )}
      </div>
  );

  // ── Scheda B (predefinita): mockup A "Editoriale" scelto da Lorenzo (PR #87, 21/10).
  // Foto in alto, categoria in maiuscoletto, nome grande in serif, una riga "Aperto ora · 650 m ·
  // fino alle 01:00", poi IL VERDETTO MAPETITE in corsivo tra due filetti, come una citazione di
  // rivista (la cosa principale della pagina), "Per te" e "Orari, contatti, recensioni ›" che apre
  // tutto il resto (niente tolto: un tocco più in là). Azioni fisse in basso: Prenota · Percorso · Salva.
  if (variant === "b") {
    const copyAddress = async () => {
      if (!address) return;
      try { await navigator.clipboard.writeText(displayAddress(address)); setAddressCopied(true); setTimeout(() => setAddressCopied(false), 2000); } catch { /* appunti non disponibili */ }
    };
    // Il verdetto in vista: la frase editoriale; se manca, la sintesi (mai testo inventato).
    const headline = verdictText ?? (synthesis?.trim() || null);
    const showSynthesisBelow = verdictText != null && synthesis != null && synthesis.trim() !== "";
    // "Per te": prima il perché dai gusti (mappa del gusto, scritto dall'AI solo con i gusti veri),
    // altrimenti il perché per questa ricerca. Se ci sono tutti e due, il secondo va in "In breve".
    const perTeText = venue.perTe?.trim() || null;
    const perTeLine = perTeText ?? matchReasonText;
    const matchReasonBelow = perTeText != null && matchReasonText != null;
    // Senza verdetto (né in arrivo): la frase di Google o una recensione, dichiarate come tali.
    const firstReview = selectedReviews?.find((r) => r.text?.trim())?.text.trim() ?? null;
    // Recensione lunga: si taglia a fine frase (entro ~200 caratteri), così il "…" non finisce dopo un punto.
    const aFineFrase = (t: string) => {
      if (t.length <= 200) return t;
      const cut = t.slice(0, 200);
      const fine = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
      return fine > 60 ? cut.slice(0, fine + 1) : `${cut.replace(/\s\S*$/, "")}…`;
    };
    const googleLine = venue.editorialSummary?.trim() || (firstReview ? aFineFrase(firstReview) : null);
    // La frase è di Google o di una persona che ha scritto una recensione su Google: lo si dice (collaudo 23/10).
    const googleLabel = venue.editorialSummary?.trim() ? "Da Google" : "Da una recensione su Google";
    // Nulla tra il verdetto e "Orari, contatti, recensioni": basta il filetto sotto il verdetto.
    const subitoDopoVerdetto = (headline != null || verdettoInArrivo || googleLine != null)
      && (venue.requisiti?.length ?? 0) === 0 && !perTeLine && !friendsData && !showPersonalBlock && !(!isSaved && onQuickSave && !saveSlot);
    const hasOverview =
      showSynthesisBelow || matchReasonBelow || hasTags || goForChips.length > 0 || dontExpectChips.length > 0;
    const hasReviewsTab = hasReviews || communitySlot != null;
    // Orari Google della ricerca (i salvati non li hanno): oggi in Info, "apre alle 19:00" se chiuso.
    const adesso = new Date();
    const oggi = orariDelGiorno(venue.orari, adesso);
    // Dopo mezzanotte "oggi" sono gli orari di ieri sera ancora in corso: si chiamano "Stanotte", così non
    // contraddicono la riga di oggi in grassetto nella settimana (collaudo 24/10).
    const stanotte = oggi != null && oggi !== orariDelGiorno(venue.orari, new Date(adesso.getFullYear(), adesso.getMonth(), adesso.getDate(), 12));
    // Con gli orari, aperto/chiuso si calcola adesso (la scheda può restare aperta a lungo);
    // senza, vale quello che Google ha detto alla ricerca.
    const aperto = apertoIl(venue.orari, adesso) ?? openNow;
    const riapre = aperto === false ? prossimaApertura(venue.orari, adesso) : null;
    const chiude = aperto === true ? prossimaChiusura(venue.orari, adesso) : null;
    const tabs = [
      ["info", "Info"],
      ...(hasReviewsTab ? [["recensioni", "Recensioni"]] : []),
      // "In breve" solo se ha qualcosa da dire (collaudo 23/10: vuota per i locali senza verdetto).
      ...(hasOverview || !hasReviewsTab ? [["panoramica", "In breve"]] : []),
    ] as [SchedaTab, string][];
    const activeTab: SchedaTab = (tab === "recensioni" && !hasReviewsTab) || (tab === "panoramica" && !tabs.some(([t]) => t === "panoramica")) ? "info" : tab;
    const menuItem =
      "flex min-h-12 w-full items-center gap-3 px-4 text-left text-[15px] font-sans text-text active:bg-bg";
    // Tasti tondi sopra la foto (mockup A): bianchi, 44px per il dito.
    const ROUND = "flex h-11 w-11 items-center justify-center rounded-full shadow-card active:scale-95";
    const roundBtn = `${ROUND} bg-white/90 text-text backdrop-blur`;
    // "Ci sono stato" per un locale non ancora salvato: nel menu Altro (regola 17/10: niente doppioni
    // accanto a Salva nella barra). Apre Salva con lo stato già scelto.
    const quickVisit = !isSaved && onQuickSave ? onQuickSave : null;
    const altroMenu = (
      <>
                <button type="button" aria-label="Chiudi il menu" className="fixed inset-0 z-20 cursor-default" onClick={() => setMenuOpen(false)} />
                <div role="menu" data-testid="altro-menu" className="absolute right-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-card border border-border bg-surface py-1 shadow-float">
                  {quickVisit && saveSlot && (
                    <button role="menuitem" type="button" data-testid="altro-ci-sono-stato" onClick={() => { setMenuOpen(false); quickVisit("Già visitato"); }} className={menuItem}>
                      <Check size={18} className="shrink-0 text-brand" aria-hidden /> Ci sono stato
                    </button>
                  )}
                  {isSaved && isUuid(venue.id) && (
                    <Link
                      role="menuitem"
                      href={`/gruppi?proponi=${venue.id}`}
                      data-testid="proponi-gruppo"
                      onClick={() => trackFeature("gruppo_proponi_scheda")}
                      className={menuItem}
                    >
                      <UsersRound size={18} className="shrink-0 text-brand" aria-hidden /> Proponi in una lista di gruppo
                    </Link>
                  )}
                  {/* "Modifica tag e nota" qui solo se la scheda non mostra già "Modifica" sotto "Le tue note" (niente doppioni, collaudo del 22/10). */}
                  {canEdit && !showPersonalBlock && (
                    <button role="menuitem" type="button" onClick={() => { setMenuOpen(false); onEdit(); }} className={menuItem}>
                      <Pencil size={18} className="shrink-0 text-brand" aria-hidden /> Modifica tag e nota
                    </button>
                  )}
                  {/* Copia indirizzo e Google Maps stanno in Info: qui niente doppioni (collaudo 23/10). */}
                  <Link
                    role="menuitem"
                    href={isUuid(venue.id) ? `/per-i-ristoratori/rivendica?locale=${venue.id}` : "/per-i-ristoratori/rivendica"}
                    data-testid="altro-rivendica"
                    className={`${menuItem} border-t border-border text-text-muted`}
                  >
                    <Store size={18} className="shrink-0" aria-hidden /> È il tuo locale? Rivendicalo
                  </Link>
                </div>
              </>
    );
    // Riga di categoria in maiuscoletto: tipo · prezzo · città (solo dati veri).
    const kindLine = [categoryLabel(category, name), priceLabel, cityFromAddress(address)].filter(Boolean) as string[];
    // Distanza solo dalla posizione vera: dal centro della mappa "250 m" si leggeva come "da te" (collaudo 23/10).
    const distance = userPos ? distanceLabel(userPos, { lat, lng }) : null;
    // Nomi lunghi su due righe al massimo, senza spingere il verdetto sotto la barra.
    // I nomi Google con la pubblicità dentro ("Trattoria Dal Cordaro (Roma) - Vino e Cucina romana dal 1922"):
    // in vista solo la parte prima di " - ", " | " o "(" (il nome intero resta in Info e nel titolo).
    // A 360px un nome su 3 righe spingeva "Orari, contatti, recensioni" sotto la barra (collaudo 23/10).
    // Nomi tutti in maiuscolo ("CASA ENCANTO ROMA", giro del 1/11): in minuscolo con le iniziali.
    const nomeBreve = nomeLeggibile((() => {
      const m = name.split(/\s+[-–—|]\s+|\s*\(/)[0].trim();
      return m.length >= 3 && m.length < name.length ? m : name;
    })());
    const nameSize = nomeBreve.length > 30 ? "text-[24px]" : nomeBreve.length > 16 ? "text-[30px]" : "text-[40px]";
    const openDetails = () => {
      const next = !detailsOpen;
      setDetailsOpen(next);
      if (next) {
        trackFeature("scheda_dettagli");
        requestAnimationFrame(() => document.getElementById(`scheda-dettagli-${venue.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
      }
    };

    return (
      // min-h-full: a tutto schermo la barra azioni resta in fondo anche quando la scheda è corta.
      <div className={`relative flex min-h-full flex-col rounded-card ${PAPER} shadow-float`}>
        <SchedaCarosello
          photoRefs={venue.photoRef ? [venue.photoRef] : []}
          name={name}
          credit={venue.photoAuthor}
          lat={lat}
          lng={lng}
          directionsUrl={directionsUrl}
          onDirections={() => signal("percorso", "carosello")}
          // A 360px la foto più bassa: "Orari, contatti, recensioni" resta sopra la barra (collaudo 22/10);
          // a 375×667 (iPhone SE) ancora più bassa: con la pillola e un verdetto su 3 righe finiva sotto (collaudo 23/10).
          heightClass={livelloFoto === 2 ? "h-16" : livelloFoto === 1 ? "h-24" : "h-48 min-[380px]:h-56 [@media(min-height:701px)_and_(max-height:760px)]:h-40 [@media(max-height:700px)]:h-28"}
          // Senza foto niente riquadro grigio da 220px con l'emoji piccola (revisore del 2/11, r4): intestazione bassa
          // (120px più la zona sicura) con l'emoji su fondo del marchio, e il nome sale.
          heightSenzaFoto={livelloFoto === 2 ? "h-16" : livelloFoto === 1 ? "h-24" : "h-[calc(env(safe-area-inset-top,0px)+7.5rem)]"}
          fallback={
            <div data-testid="scheda-intestazione-emoji" className="flex h-full w-full items-center justify-center bg-brand pt-[env(safe-area-inset-top,0px)]">
              <span aria-hidden className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-[34px] leading-none">{emoji}</span>
            </div>
          }
          overlay={
            <>
              {/* Tasti sotto la zona sicura: la scheda è a tutto schermo. */}
              <button
                type="button"
                onClick={onClose}
                aria-label="Chiudi"
                className={`absolute left-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] ${roundBtn}`}
              >
                <X size={19} aria-hidden />
              </button>
              {/* Condividi e Altro: tondi sulla foto, a destra (mockup A). Una sola volta ciascuno. */}
              <div className="absolute right-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] flex gap-2" data-testid="azioni-scheda">
                {shareOn && (
                  <button type="button" onClick={share} aria-label={`Condividi ${name}`} className={roundBtn}>
                    <Share size={18} aria-hidden />
                  </button>
                )}
                <button
                  type="button"
                  data-testid="altro-apri"
                  aria-label="Altro"
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  onClick={() => setMenuOpen((o) => !o)}
                  className={menuOpen ? `${ROUND} bg-brand text-white` : roundBtn}
                >
                  <Ellipsis size={19} aria-hidden />
                </button>
                {menuOpen && altroMenu}
              </div>
            </>
          }
        />

        <div className="px-[22px] pt-[22px]">
          {kindLine.length > 0 && (
            <p data-testid="scheda-categoria" className="font-display text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              {kindLine.join(" · ")}
            </p>
          )}
          <h2 title={nomeBreve.length < name.length ? name : undefined} className={`${SERIF} mt-2 ${nameSize} font-medium leading-[1.02] tracking-[-0.02em] text-[#141414]`}>
            {nomeBreve}
            {infoLocale && (
              <BadgeCheck data-testid="verificato-scheda" role="img" aria-label="Verificato dal titolare" size={20} className="ml-1.5 inline-block -translate-y-1 align-middle text-brand">
                <title>Verificato dal titolare</title>
              </BadgeCheck>
            )}
          </h2>
          {shareNote && <p role="status" className="mt-1 text-xs font-sans text-text-muted">{shareNote}</p>}
          {/* UNA riga: "● Aperto ora · 650 m · fino alle 01:00" (orari Google se ci sono, mai inventati). */}
          {(aperto != null || distance || rating != null) && (
            <p data-testid="scheda-fatti" className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13.5px] font-sans text-[#4b5058]">
              {/* Il voto Google in vista, come in Places (collaudo 22/10); il numero di recensioni resta in Info. */}
              {rating != null && (
                <span data-testid="voto-scheda" className="whitespace-nowrap font-semibold text-[#141414]"><span aria-hidden className="text-accent">★</span> {rating.toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
              )}
              {/* Stato e orario in un blocco solo che non va a capo ("● Chiuso · apre domani alle 12:30"), con
                  il "·" davanti: a capo va il blocco intero, mai un puntino da solo (collaudi del 23/10). */}
              {aperto != null && (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  {rating != null && <span aria-hidden className="mr-1 font-normal text-[#4b5058]">·</span>}
                  <span data-testid="stato-apertura" className={`inline-flex items-center gap-1.5 font-semibold ${aperto ? "text-brand" : "text-error"}`}>
                    <span aria-hidden className={`h-[7px] w-[7px] rounded-full ${aperto ? "bg-brand" : "bg-error"}`} />
                    {riapre || chiude ? (aperto ? "Aperto" : "Chiuso") : aperto ? "Aperto ora" : "Chiuso ora"}
                  </span>
                  {(riapre || chiude) && (
                    <>
                      <span aria-hidden className="mx-1">·</span>
                      <span data-testid={riapre ? "riapre" : "chiude"}>{riapre ? `apre ${riapre.replace(/^oggi /, "")}` : `fino ${chiude}`}</span>
                    </>
                  )}
                </span>
              )}
              {distance && (
                <span className="whitespace-nowrap">
                  {(aperto != null || rating != null) && <span aria-hidden className="mr-2.5">·</span>}
                  <span>{distance}</span>
                </span>
              )}
            </p>
          )}
          {/* Semplificare (20/10): i segnali brevi in UNA riga di pillole, non una riga ciascuno.
              Il contenitore sparisce se nessuno ha niente da dire (PostoLocale e BuoniPastoRiga arrivano dopo). */}
          <div data-testid="segnali-scheda" className="mt-2.5 flex flex-wrap items-center gap-1.5 empty:hidden">
            {gem && (
              <span data-testid="gemma" className="inline-flex rounded-pill bg-accent-light px-2.5 py-0.5 text-xs font-display font-semibold text-accent">
                💎 Poco conosciuto
              </span>
            )}
            {/* Aperto da poco (PROPOSTE.md, proposta 7): parola del titolare verificato, solo il primo anno. */}
            <AperturaPillola info={infoLocale} />
            {/* Buoni pasto: solo se almeno 2 persone che ci sono state concordano (PROPOSTE.md 19/10). */}
            <BuoniPastoRiga venueId={venue.id} category={category} />
            {/* Se il titolare di un locale verificato l'ha detto, "🌙 Martedì c'è posto" (POSIZIONAMENTO.md, proposta 1). */}
            <PostoPillola info={infoLocale} />
            {/* Chi ci è stato su Mapetite e com'era (solo da 5 voti in su, PROBLEMI.md 3). */}
            <VisiteMapetite venueId={googlePlaceId ?? venue.id} />
          </div>

          {/* IL VERDETTO MAPETITE: in corsivo tra due filetti, come una citazione di rivista.
              Se manca: "lo sto scrivendo" mentre arriva, altrimenti la frase di Google dichiarata come tale. */}
          {headline != null ? (
            <section data-testid="verdetto-box" className="mt-4 border-y border-t-[#1c1c1e] border-b-[#e3ddd2] pb-4 pt-3.5">
              <p data-testid="verdetto-scheda" className="flex items-center gap-1.5 font-display text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brand">
                <Sparkles size={12} className="shrink-0 text-accent" aria-hidden />
                Il verdetto Mapetite
              </p>
              <p className={`${SERIF} mt-2 text-[20px] italic leading-[1.24] tracking-[-0.005em] text-[#141414] min-[380px]:text-[22px]`}>{headline}</p>
            </section>
          ) : verdettoInArrivo ? (
            <section data-testid="verdetto-in-arrivo" className="mt-4 border-y border-t-[#1c1c1e] border-b-[#e3ddd2] pb-4 pt-3.5">
              <p className="flex items-center gap-1.5 font-display text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brand">
                <Sparkles size={12} className="shrink-0 text-accent" aria-hidden />
                Il verdetto Mapetite
              </p>
              <p className={`${SERIF} mt-2 animate-pulse text-[20px] italic leading-[1.24] text-text-muted`}>Lo sto scrivendo dalle recensioni…</p>
            </section>
          ) : googleLine ? (
            <section data-testid="verdetto-google" className="mt-4 border-y border-t-[#1c1c1e] border-b-[#e3ddd2] pb-4 pt-3.5">
              {/* Non è il verdetto: testo normale, più piccolo e grigio, dichiarato "Da Google" (collaudo del 22/10:
                  in corsivo grande si confondeva con il verdetto Mapetite). */}
              <p className="font-display text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted">{googleLabel}</p>
              <p className="mt-1.5 line-clamp-3 font-sans text-[15px] leading-[1.45] text-text/80">{googleLine}</p>
            </section>
          ) : null}

          {/* "Per te · …" in corallo: solo il perché già scritto, mai inventato. "Per te" solo se viene dai
              gusti; il perché della ricerca si chiama "Perché qui" (non parla della persona). Subito sotto il verdetto,
              prima dei ✓: è la ragione per cui Mapetite è diversa e deve stare nella prima schermata (collaudo 23/10). */}
          {perTeLine && (
            <p data-testid="per-te-scheda" className="mt-3.5 flex items-center gap-3 text-[13.5px] font-sans leading-snug text-[#3d4248]">
              <span aria-hidden className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border-2 border-accent text-accent">
                <Sparkles size={15} />
              </span>
              <span className="min-w-0">
                <b className="font-display font-semibold text-accent">{perTeText ? "Per te" : "Perché qui"}</b> · {perTeLine}
              </span>
            </p>
          )}

          {/* Requisiti della ricerca confermati: un tocco mostra la frase della recensione (copiata, mai riscritta). */}
          {(venue.requisiti?.length ?? 0) > 0 && (
            <div data-testid="requisiti-scheda" className="mt-3.5">
              <div className="flex flex-wrap gap-2">
                {venue.requisiti!.map(({ r }) => (
                  <button
                    key={r}
                    type="button"
                    aria-expanded={provaAperta === r}
                    onClick={() => setProvaAperta((x) => (x === r ? null : r))}
                    className={`inline-flex min-h-11 items-center gap-1.5 rounded-pill border px-3.5 text-[13.5px] font-display font-semibold active:scale-95 ${provaAperta === r ? "border-brand bg-brand text-white" : "border-[#e3ddd2] bg-white text-brand"}`}
                  >
                    <span aria-hidden className={provaAperta === r ? "text-white" : "text-success"}>✓</span>
                    {r}
                  </button>
                ))}
              </div>
              {provaAperta && venue.requisiti!.find((x) => x.r === provaAperta) && (
                <p data-testid="prova-recensione" className="mt-2 scroll-mb-28 text-[13.5px] font-sans leading-snug text-[#3d4248]">
                  <span className={`${SERIF} italic text-[#141414]`}>«{venue.requisiti!.find((x) => x.r === provaAperta)!.prova}»</span>
                  <span className="text-text-muted"> · da una recensione su Google</span>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Chi dei tuoi amici c'è stato: passaparola vero, solo tra chi segui. */}
        {friendsData && <AmiciQuiBox visitati={friendsData.visitati} daProvare={friendsData.daProvare} className="mx-[22px] mt-4" />}

        {/* Le tue note (stato, Com'era, classifica, tag e nota): solo per i salvati, in vista. */}
        {showPersonalBlock && personalBlock(true, true, (headline != null || verdettoInArrivo || googleLine != null) && (venue.requisiti?.length ?? 0) === 0 && !perTeLine && !friendsData)}

        {/* Locale non salvato senza barra Salva (scheda dall'assistente): le due scelte rapide aprono Salva. */}
        {!isSaved && onQuickSave && !saveSlot && (
          <div className="mx-[22px] mt-4 flex rounded-pill bg-bg p-1" data-testid="stato-rapido">
            {([["Da provare", "Da provare", "📌"], ["Già visitato", "Ci sono stato", "✓"]] as const).map(([tag, label, e]) => (
              <button
                key={tag}
                type="button"
                aria-label={`${e} ${label}`}
                onClick={() => onQuickSave(tag)}
                className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-pill text-[14px] font-display font-semibold text-text-muted active:scale-95"
              >
                <span aria-hidden>{e}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}

        {/* "Orari, contatti, recensioni ›": tutto il resto, un tocco più in là. Subito sotto il verdetto
            il filetto c'è già (quello sotto il verdetto): niente secondo filetto con il vuoto in mezzo (collaudo 22/10). */}
        <button
          type="button"
          data-testid="scheda-altro-info"
          aria-expanded={detailsOpen}
          aria-controls={`scheda-dettagli-${venue.id}`}
          onClick={openDetails}
          className={`mx-[22px] flex min-h-12 items-center justify-between pt-0.5 text-left text-[13.5px] font-sans text-[#4b5058] ${subitoDopoVerdetto ? "" : "mt-4 border-t border-[#e3ddd2]"}`}
        >
          Orari, contatti, recensioni
          <ChevronRight size={18} aria-hidden className={`shrink-0 transition-transform ${detailsOpen ? "rotate-90" : ""}`} />
        </button>

        <div id={`scheda-dettagli-${venue.id}`} data-testid="scheda-dettagli" hidden={!detailsOpen} className="scroll-mt-4">
          {/* Tre sezioni brevi: Info · Recensioni · In breve. */}
          <div role="tablist" aria-label="Sezioni della scheda" className="mx-[22px] mt-1 flex border-b border-[#e3ddd2]" data-testid="scheda-tabs">
            {tabs.map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`scheda-tab-${id}`}
                data-testid={`scheda-tab-${id}`}
                aria-selected={activeTab === id}
                aria-controls={`scheda-pannello-${id}`}
                onClick={() => setTab(id)}
                className={`-mb-px min-h-11 flex-1 border-b-2 text-sm font-display font-semibold ${activeTab === id ? "border-brand text-brand" : "border-transparent text-text-muted"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* In breve: sintesi, punti forti, tag. */}
          <div role="tabpanel" id="scheda-pannello-panoramica" aria-labelledby="scheda-tab-panoramica" hidden={activeTab !== "panoramica"} data-testid="pannello-panoramica">
            {hasOverview && (
              <div className="mx-[22px] mt-4">
                {showSynthesisBelow && (
                  <p className="font-sans text-[15px] leading-relaxed text-text">{synthesis}</p>
                )}
                {matchReasonBelow && (
                  <p className="mt-2 font-sans text-[15px] leading-relaxed text-text">
                    <span className="font-display font-semibold text-accent">Per la tua ricerca: </span>
                    {matchReasonText}
                  </p>
                )}
                {(goForChips.length > 0 || hasTags) && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {goForChips.map((chip) => (
                      <span key={`g-${chip}`} className="inline-flex items-center gap-1 rounded-pill bg-brand/10 px-2.5 py-1 text-xs font-display font-medium text-brand">
                        <Check size={12} className="shrink-0" aria-hidden />
                        {chip}
                      </span>
                    ))}
                    {senzaDoppioni([...goForChips, ...(tags ?? [])]).slice(goForChips.length).map((tag) => (
                      <span key={`t-${tag}`} className="rounded-pill border border-border px-2.5 py-1 text-xs font-display font-medium text-text-muted">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {dontExpectChips.length > 0 && (
                  <p className="mt-3 text-sm font-sans text-text-muted">
                    <span className="font-display font-semibold">Meno adatto se: </span>
                    {dontExpectChips.join(" · ")}
                  </p>
                )}
              </div>
            )}
            {/* Senza la scheda Recensioni il confronto con le altre fonti resta qui, dopo In breve. */}
            {!hasReviewsTab && confronto()}
          </div>

          {/* Recensioni: Google e community Mapetite, mai mescolate. */}
          {hasReviewsTab && (
            <div role="tabpanel" id="scheda-pannello-recensioni" aria-labelledby="scheda-tab-recensioni" hidden={activeTab !== "recensioni"} data-testid="pannello-recensioni">
              {/* "A confronto" in cima alle Recensioni, come il riepilogo dei voti di Google Maps.
                  La riga Mapetite porta alla community. */}
              {confronto(communitySlot ? () => document.querySelector("[data-testid=community-scheda]")?.scrollIntoView({ behavior: "smooth", block: "start" }) : undefined)}
              {hasReviews && (
                <div className="mx-[22px] mt-4">
                  <h3 className="flex items-baseline justify-between font-display text-base font-semibold text-brand">
                    Cosa dicono
                    <span className="text-xs font-sans font-normal text-text-muted">Recensioni da Google</span>
                  </h3>
                  <ul className="mt-1 divide-y divide-border">
                    {/* La recensione già in vista sotto il nome ("Da una recensione su Google") non si ripete (collaudo 23/10). */}
                    {selectedReviews!.filter((r) => venue.editorialSummary?.trim() || headline != null || verdettoInArrivo || r.text?.trim() !== firstReview).map((review, i) => (
                      <li key={i} className="flex gap-2 py-2.5">
                        <Quote size={14} className="mt-1 shrink-0 text-text-muted" aria-hidden />
                        <p className="font-sans text-sm leading-relaxed text-text">{review.text}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {communitySlot && (
                <div className="mx-[22px] mt-4" data-testid="community-scheda">
                  <h3 className="font-display text-base font-semibold text-brand">
                    Dalla community Mapetite
                  </h3>
                  <div className="mt-2">{communitySlot}</div>
                </div>
              )}
            </div>
          )}

          {/* Info: orari, indirizzo (si copia), contatti che non stanno già nella barra, Google Maps. */}
          <div role="tabpanel" id="scheda-pannello-info" aria-labelledby="scheda-tab-info" hidden={activeTab !== "info"} data-testid="pannello-info">
            <div className="mx-[22px] mt-2" data-testid="scheda-info">
              <div className="flex flex-col divide-y divide-border">
                {/* Il nome intero di Google, quando sotto la foto c'è quello accorciato. */}
                {nomeBreve.length < name.length && (
                  <p data-testid="nome-intero" className="flex min-h-11 items-center gap-3 py-2 text-sm font-sans text-text">
                    <Store size={18} className="shrink-0 text-brand" aria-hidden />
                    <span className="min-w-0 flex-1">{name}</span>
                  </p>
                )}
                {oggi && (
                  // Un tocco su "Oggi" apre gli orari di tutta la settimana, da Google (collaudo 23/10: "Info dice poco").
                  <div>
                    <button type="button" data-testid="orari-settimana-apri" aria-expanded={settimanaOpen} onClick={() => setSettimanaOpen((v) => !v)} className="flex min-h-11 w-full items-center gap-3 text-left text-sm font-sans text-text">
                      <Clock size={18} className="shrink-0 text-brand" aria-hidden />
                      <span data-testid="orari-oggi" className="min-w-0 flex-1"><span className="font-display font-semibold">{stanotte ? "Stanotte" : "Oggi"}</span> {oggi}</span>
                      <ChevronRight size={16} aria-hidden className={`shrink-0 text-text-muted transition-transform ${settimanaOpen ? "rotate-90" : ""}`} />
                    </button>
                    {settimanaOpen && (
                      <ul data-testid="orari-settimana" className="mb-2 ml-[30px] space-y-1 text-sm font-sans text-text-muted">
                        {Array.from({ length: 7 }, (_, i) => {
                          const d = new Date(adesso.getFullYear(), adesso.getMonth(), adesso.getDate() + i, 12);
                          const giorno = d.toLocaleDateString("it-IT", { weekday: "long" });
                          return (
                            <li key={i} className="flex justify-between gap-3">
                              <span className={i === 0 ? "font-display font-semibold text-text" : ""}>{giorno.charAt(0).toUpperCase() + giorno.slice(1)}</span>
                              <span className="text-right">{orariDelGiorno(venue.orari, d)}</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
                {address && (
                  <button type="button" data-testid="copia-indirizzo" onClick={copyAddress} className="flex min-h-12 items-center gap-3 text-left text-sm font-sans text-text">
                    <MapPin size={18} className="shrink-0 text-brand" aria-hidden />
                    <span className="min-w-0 flex-1">{displayAddress(address)}</span>
                    <span className="shrink-0 font-display font-semibold text-brand">{addressCopied ? "✓ Copiato" : "Copia"}</span>
                  </button>
                )}
                {/* Città e distanza stanno già sotto il nome: qui niente doppione (collaudo 23/10). */}
                {/* Il voto Google sta già sotto il nome e in Recensioni ("A confronto"): qui niente terza volta (collaudo 23/10). */}
                {telHref && !inBar("chiama") && (
                  <a href={telHref} onClick={() => signal("chiama")} aria-label={`Chiama ${name}`} className="flex min-h-12 items-center gap-3 text-sm font-display font-semibold text-brand">
                    <Phone size={18} className="shrink-0" aria-hidden /> Chiama
                  </a>
                )}
                {websiteUri != null && !inBar("sito") && (
                  <a href={websiteUri} onClick={() => signal("sito")} target="_blank" rel="noopener noreferrer" aria-label={`Sito di ${name}`} className="flex min-h-12 items-center gap-3 text-sm font-display font-semibold text-brand">
                    <Globe size={18} className="shrink-0" aria-hidden /> Sito
                  </a>
                )}
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center gap-3 text-sm font-display font-semibold text-accent">
                  <ExternalLink size={18} className="shrink-0" aria-hidden /> {oggi ? "Tutti gli orari e le foto su Google Maps →" : "Orari e foto su Google Maps →"}
                </a>
              </div>
            </div>
          </div>
        </div>

        {bookingOpen && (
          <BookingSheet
            place={{ id: googlePlaceId ?? venue.id, name, phone, websiteUri, openNow, lat, lng, orari: venue.orari ?? null }}
            initial={booking}
            onClose={() => { setBookingOpen(false); onBookingClosed?.(); }}
            alternative={bookingAlternatives}
            onAlternative={onBookAlternative}
          />
        )}

        {/* Barra teal arrotondata, staccata dal fondo (mockup A): Prenota (corallo, più larga) / Percorso /
            Salva, oppure Chiama / Percorso / Salva dove non si prenota. Sta sopra la barra in basso
            dell'app (--nav-height-mobile, che comprende già il bordo sicuro dell'iPhone). */}
        <div aria-hidden className="flex-1" />
        <div
          data-testid="barra-azioni"
          className="sticky bottom-[calc(max(var(--nav-height-mobile),env(safe-area-inset-bottom,0px))+var(--nav-sporgenza)+0.5rem)] z-10 mt-6 flex justify-center px-4"
        >
          <div className="w-full rounded-[22px] bg-brand p-2 shadow-[0_14px_30px_rgba(26,60,64,0.35)]">
          {nav && (
            <div data-testid="scheda-nav" className="-mt-1 mb-1 flex items-center justify-between text-white">
              <button type="button" onClick={onNavPrev} aria-label="Locale precedente" className="flex h-9 w-12 items-center justify-center rounded-full text-xl leading-none text-white/90 active:scale-95">‹</button>
              <span className="text-[13px] font-display font-semibold text-white/85">{nav.pos} di {nav.total}</span>
              <button type="button" onClick={onNavNext} aria-label="Locale successivo" className="flex h-9 w-12 items-center justify-center rounded-full text-xl leading-none text-white/90 active:scale-95">›</button>
            </div>
          )}
          <div className="flex w-full items-center gap-2">
            {lead === "prenota" && (
              <button type="button" data-testid="prenota-scheda" onClick={() => openBooking("barra")} aria-label={`Prenota da ${name}`} className={`${ACTION_TILE} bg-accent`} style={{ flexGrow: 1.4 }}>
                <CalendarCheck size={17} aria-hidden />
                Prenota
              </button>
            )}
            {(lead === "chiama" || extra === "chiama") && telHref && (
              <a href={telHref} onClick={() => signal("chiama", "barra")} aria-label={`Chiama ${name}`} className={`${TILE} ${extra === "chiama" ? "order-last" : ""}`}>
                <Phone size={17} aria-hidden />
                Chiama
              </a>
            )}
            {(lead === "sito" || extra === "sito") && websiteUri != null && (
              <a href={websiteUri} onClick={() => signal("sito", "barra")} target="_blank" rel="noopener noreferrer" aria-label={`Sito di ${name}`} className={`${TILE} ${extra === "sito" ? "order-last" : ""}`}>
                <Globe size={17} aria-hidden />
                Sito
              </a>
            )}
            <a
              href={directionsUrl} onClick={() => signal("percorso", "barra")}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={walk != null ? `Indicazioni: ${walk} min a piedi` : "Indicazioni"}
              className={TILE}
            >
              {walk != null ? <Footprints size={17} aria-hidden className="shrink-0" /> : <Navigation size={17} aria-hidden className="shrink-0" />}
              <span className="whitespace-nowrap">{walk != null ? `${walk} min` : "Percorso"}</span>
            </a>
            {saveSlot}
          </div>
          </div>
        </div>
        {/* Spazio sotto la barra: la nav mobile copre il fondo della scheda. */}
        <div aria-hidden style={{ height: "var(--nav-height-mobile)" }} />
      </div>
    );
  }

  return (
    <div className="relative flex flex-col rounded-card bg-surface shadow-float">
      {variant === "a" && (
        <>
      {/* 1. HEADER */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
        {shareNote && <span role="status" className="rounded-pill bg-surface px-2.5 py-1 text-xs font-sans text-text shadow-card">{shareNote}</span>}
        {shareOn && (
          <button
            type="button"
            onClick={share}
            aria-label={`Condividi ${name}`}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-brand shadow-card active:scale-95"
          >
            <Share2 size={18} />
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-text-muted shadow-card hover:text-text"
        >
          <X size={18} />
        </button>
      </div>

      {venue.photoRef && (
        <div className="relative">
          <PlacePhoto
            photoRef={venue.photoRef}
            alt={name}
            width={700}
            priority
            className="h-44 w-full rounded-t-card object-cover"
            credit={venue.photoAuthor}
            creditClassName="absolute bottom-2 left-3"
          />
        </div>
      )}
      <div className="px-5 pt-5">
        {!venue.photoRef && (
          <span
            role="img"
            aria-label={category ?? "locale"}
            className="text-4xl leading-none"
          >
            {getCategoryEmoji(category, name, venue.types)}
          </span>
        )}
        <h2 className={`${venue.photoRef ? "" : "mt-2 pr-24 "}font-title text-2xl font-semibold leading-tight text-brand in-data-[titoli=serif]:text-[2.1rem]`}>
          {nomeLeggibile(name)}
        </h2>

        {/* Come Places: "Città · distanza", poi tipo · voto · prezzo · aperto. */}
        {(cityFromAddress(address) || origin) && (
          <p data-testid="citta-distanza" className="mt-1 text-sm font-sans text-text-muted">
            {[cityFromAddress(address), origin ? distanceLabel(origin, { lat, lng }) : null].filter(Boolean).join(" · ")}
          </p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-sans text-text-muted">
          {categoryLabel(category, name) && (
            <>
              <span className="text-text">{categoryLabel(category, name)}</span>
              {rating != null && <span aria-hidden>·</span>}
            </>
          )}
          {rating != null && (
            <span className="inline-flex items-center gap-0.5">
              <span className="text-star">★</span>
              <span className="font-display font-semibold text-text">
                {rating.toLocaleString("it-IT", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}
              </span>
              {userRatingCount != null && <span>({userRatingCount})</span>}
            </span>
          )}
          {priceLabel && (
            <>
              <span aria-hidden>·</span>
              <span className="font-display text-text">{priceLabel}</span>
            </>
          )}
          {openNow != null && (
            <>
              <span aria-hidden>·</span>
              <span
                className={
                  openNow
                    ? "rounded-pill bg-brand/10 px-2 py-0.5 text-xs font-display font-semibold text-brand"
                    : "rounded-pill bg-error/10 px-2 py-0.5 text-xs font-display font-semibold text-error"
                }
              >
                {openNow ? "Aperto" : "Chiuso"}
              </span>
            </>
          )}
          {gem && (
            <span data-testid="gemma" className="rounded-pill bg-accent-light px-2 py-0.5 text-xs font-display font-semibold text-accent">
              💎 Poco conosciuto
            </span>
          )}
        </div>

        {address && (
          // Tocco sull'indirizzo: lo copia (per mandarlo a chi viene con te o incollarlo in un'altra app).
          <button
            type="button"
            data-testid="copia-indirizzo"
            onClick={async () => {
              try { await navigator.clipboard.writeText(displayAddress(address)); setAddressCopied(true); setTimeout(() => setAddressCopied(false), 2000); } catch { /* appunti non disponibili */ }
            }}
            className="mt-1 flex min-h-8 items-center gap-1.5 text-left text-xs font-sans text-text-muted"
          >
            <span>{displayAddress(address)}</span>
            <span className="shrink-0 font-display font-semibold text-brand">{addressCopied ? "✓ Copiato" : "Copia"}</span>
          </button>
        )}
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex min-h-10 items-center text-xs font-display font-semibold text-accent">
          Orari, foto e recensioni su Google Maps →
        </a>
      </div>

      {/* 2. CARD VERDETTO (teal): verdetto + matchReason + chip, tutto dentro. */}
      {verdictCard}
      {confronto(communitySlot ? () => document.querySelector("[data-testid=community-scheda]")?.scrollIntoView({ behavior: "smooth", block: "start" }) : undefined)}

        </>
      )}

      {/* Chi dei tuoi amici c'è stato (o lo vuole provare): passaparola vero, solo tra chi segui. */}
      {friendsData && <AmiciQuiBox visitati={friendsData.visitati} daProvare={friendsData.daProvare} />}
      {/* 3. TAG AI */}
      {hasTags && (
        <div className="mt-4 flex flex-wrap gap-1.5 px-5">
          {tags!.map((tag) => (
            <span
              key={tag}
              className="rounded-pill bg-accent/10 px-2.5 py-1 text-xs font-display font-medium text-accent"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Non salvato: le due scelte di Places come primo passo del salvataggio. */}
      {!isSaved && onQuickSave && (
        <div className="mx-5 mt-4 flex gap-2" data-testid="stato-rapido">
          {([["Da provare", "📌 Da provare"], ["Già visitato", "✓ Ci sono stato"]] as const).map(([tag, label]) => (
            <button
              key={tag}
              type="button"
              onClick={() => onQuickSave(tag)}
              className="min-h-11 flex-1 rounded-pill border border-border bg-white px-3 text-sm font-display font-semibold text-brand active:scale-95"
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Prenota (piano 1.3): messaggio già scritto per WhatsApp, chiamata o sito del locale. */}
      {/* Nella scheda B Prenota sta nella barra in basso. */}
      {variant === "a" && (phone != null || websiteUri != null) && (
        <div className="mx-5 mt-4">
          <button
            type="button"
            data-testid="prenota-scheda"
            onClick={() => openBooking("scheda")}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-pill bg-accent px-4 text-[15px] font-display font-semibold text-white shadow-card active:scale-[0.98]"
          >
            <CalendarCheck size={18} /> Prenota un tavolo
          </button>
        </div>
      )}
      {bookingOpen && (
        <BookingSheet
          place={{ id: googlePlaceId ?? venue.id, name, phone, websiteUri, openNow, lat, lng, orari: venue.orari ?? null }}
          initial={booking}
          onClose={() => { setBookingOpen(false); onBookingClosed?.(); }}
          alternative={bookingAlternatives}
          onAlternative={onBookAlternative}
        />
      )}

      {/* 4. LE TUE NOTE */}
      {showPersonalBlock && personalBlock(true)}

      {/* Liste di gruppo (piano 5.5): solo per i salvati, che hanno già l'UUID del locale. */}
      {isSaved && isUuid(venue.id) && (
        <div className="mx-5 mt-3">
          <Link
            href={`/gruppi?proponi=${venue.id}`}
            data-testid="proponi-gruppo"
            onClick={() => trackFeature("gruppo_proponi_scheda")}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-pill border border-border bg-white px-4 text-sm font-display font-semibold text-brand active:scale-[0.98]"
          >
            <span aria-hidden>🍽️</span> Proponi in una lista di gruppo
          </Link>
        </div>
      )}

      {/* 5. COSA DICONO — recensioni Google (prima: è quasi sempre piena) */}
      {hasReviews && (
        <div className="mt-5 border-t border-border px-5 pt-4">
          <h3 className="flex items-baseline justify-between font-display text-base font-semibold text-brand">
            Cosa dicono
            <span className="text-xs font-sans font-normal text-text-muted">Recensioni da Google</span>
          </h3>
          <div className="mt-2 flex flex-col gap-2">
            {selectedReviews!.map((review, i) => (
              <div
                key={i}
                className="rounded-card border border-border bg-surface p-3 shadow-card"
              >
                <Quote size={14} className="text-text-muted" />
                <p className="mt-1 font-sans text-sm leading-relaxed text-text">
                  {review.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. COMMUNITY (piani 5.6c, 5.6d): recensioni degli utenti e reel, mai mescolati ai dati Google. */}
      {communitySlot && (
        <div className="mt-5 border-t border-border px-5 pt-4" data-testid="community-scheda">
          <h3 className="flex items-baseline justify-between font-display text-base font-semibold text-brand">
            Dalla community Mapetite
            <span className="text-xs font-sans font-normal text-text-muted">Recensioni degli utenti</span>
          </h3>
          <div className="mt-2">{communitySlot}</div>
        </div>
      )}

      {/* 7. BARRA AZIONI FLOTTANTE: sempre visibile in fondo alla scheda mentre si scorre. */}
      {variant === "a" && (
      <div
        className="sticky bottom-[var(--nav-height-mobile)] z-10 mt-5 flex items-center gap-2 border-t border-border bg-surface/95 px-4 pt-3 pb-[calc(0.75rem+var(--nav-sporgenza))] backdrop-blur"
      >
        {nav && (
          <div data-testid="scheda-nav" className="order-last flex shrink-0 items-center text-brand">
            <button type="button" onClick={onNavPrev} aria-label="Locale precedente" className="flex h-11 w-8 items-center justify-center text-lg active:scale-95">‹</button>
            <span className="whitespace-nowrap text-xs font-display font-semibold">{nav.pos} di {nav.total}</span>
            <button type="button" onClick={onNavNext} aria-label="Locale successivo" className="flex h-11 w-8 items-center justify-center text-lg active:scale-95">›</button>
          </div>
        )}
        {saveSlot}

        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`} onClick={() => signal("percorso")}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={walk != null ? `Indicazioni: ${walk} min a piedi` : "Indicazioni"}
          className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-pill bg-brand px-4 py-2 text-sm font-display font-semibold text-white active:scale-95"
        >
          {walk != null ? <Footprints size={16} className="shrink-0" /> : <Navigation size={16} className="shrink-0" />}
          <span className="truncate">{walk != null ? `${walk} min a piedi` : "Indicazioni"}</span>
        </a>

        {phone != null && (
          <a
            href={`tel:${phone.replace(/[^\d+]/g, "")}`} onClick={() => signal("chiama")}
            aria-label={`Chiama ${name}`}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-brand active:scale-95"
          >
            <Phone size={18} />
          </a>
        )}

        {websiteUri != null && (
          <a
            href={websiteUri} onClick={() => signal("sito")}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Sito di ${name}`}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-brand active:scale-95"
          >
            <Globe size={18} />
          </a>
        )}
      </div>
      )}
      {/* Spazio sotto la barra: la nav mobile copre il fondo della scheda. */}
      <div aria-hidden style={{ height: "var(--nav-height-mobile)" }} />
    </div>
  );
}
