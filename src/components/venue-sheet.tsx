"use client";

import { tagLabel, isStateTag } from "@/lib/tags";
import { X, Quote, Navigation, Globe, Phone, Check, Share2, Footprints, CalendarCheck, Ellipsis, Copy, UsersRound, Store, ExternalLink, MapPin, Clock, Pencil } from "lucide-react";
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
import { categoryLabel } from "@/lib/category-label";
import { cityFromAddress, displayAddress } from "@/lib/city";
import { distanceLabel, walkMinutes } from "@/lib/distance";
import BookingSheet, { type BookingAlternative } from "@/components/booking-sheet";
import type { BookingDetails } from "@/lib/booking";
import { VisitaContext } from "@/lib/visita-context";
import { votoOf, votoTag } from "@/lib/diario";
import ConfrontoFonti from "@/components/confronto-fonti";
import PostoLocale from "@/components/posto-locale";
import { orariDelGiorno, prossimaApertura, type Orari } from "@/lib/orari";
import BuoniPastoRiga from "@/components/buoni-pasto-riga";

// Riquadri della barra azioni flottante (scheda B, come Places): stessa misura per tutti e tre.
// La stessa classe la usa il pulsante Salva della mappa (SaveButton in map-view, prop `tile`).
export const ACTION_TILE =
  "flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 text-xs font-display font-semibold text-white transition-transform active:scale-95";
const TILE = `${ACTION_TILE} bg-white/10`;

type SchedaTab = "panoramica" | "recensioni" | "info";

type Friends = { visitati: FriendPerson[]; daProvare: FriendPerson[] };

export type Venue = {
  id: string;
  name: string;
  address: string | null;
  category: string | null;
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
  // Locale non ancora salvato: "📌 Voglio andarci / ✓ Ci sono stato" aprono Salva con lo stato già scelto.
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
};

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
  const gem = useOptIn("gemme") && isGem(rating, userRatingCount);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [addressCopied, setAddressCopied] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(autoBook);
  // Scheda B: sezione aperta e menu "Altro".
  const [tab, setTab] = useState<SchedaTab>("panoramica");
  const [menuOpen, setMenuOpen] = useState(false);
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
  const goForChips = Array.isArray(goFor)
    ? goFor.filter((c) => c != null && c.trim() !== "").map((c) => c.trim())
    : [];
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
  const emoji = getCategoryEmoji(category, name);
  // Riga di contesto della variante B (sezione Info): "Roma · 600 m".
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
  const placeLine = [cityFromAddress(address), origin ? distanceLabel(origin, { lat, lng }) : null]
    .filter(Boolean)
    .join(" · ");

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
  // "Voglio andarci / Ci sono stato" stanno già nella riga delle azioni (scheda B).
  const personalBlock = (withStatus: boolean) => (
    <div className="mx-5 mt-4 rounded-card border-2 border-accent/30 bg-surface p-4">
        <p className="text-xs font-display font-semibold uppercase tracking-wide text-accent">
          Le tue note
        </p>
        {withStatus && onVisitStatus && (
          <div className="mt-2 flex gap-2" data-testid="stato-salvato">
            {([["Da provare", "📌 Voglio andarci"], ["Già visitato", "✓ Ci sono stato"]] as const).map(([tag, label]) => {
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
            {/* Proposta CEO 20/10: ti è piaciuto un posto poco recensito? Un tocco per lasciare due righe su Google,
                dove servono al locale (link pubblico di Google, nessun dato passa da noi). Non sui locali con 300 recensioni o più (non ne hanno bisogno). */}
            {personalTags?.includes("Mi è piaciuto") && googlePlaceId && !/^[0-9a-f-]{36}$/i.test(googlePlaceId) && (userRatingCount == null || userRatingCount < 300) && (
              <a
                data-testid="recensione-google"
                href={`https://search.google.com/local/writereview?placeid=${encodeURIComponent(googlePlaceId)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackFeature("recensione_google", userRatingCount != null ? { risultati: userRatingCount } : undefined)}
                className="mt-2 flex min-h-10 items-center gap-1.5 text-xs font-sans text-text-muted underline-offset-2 hover:underline"
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

  // ── Scheda B (predefinita, stile Places), riordinata il 16/10 su richiesta di Lorenzo:
  // "stesse cose, schermo più pulito". In vista senza toccare nulla: foto, nome, una riga di
  // fatti, il verdetto Mapetite e una riga di azioni a icone uguali. Il resto sta in tre schede
  // (Panoramica · Recensioni · Info) e le azioni secondarie nel menu "Altro".
  if (variant === "b") {
    const copyAddress = async () => {
      if (!address) return;
      try { await navigator.clipboard.writeText(displayAddress(address)); setAddressCopied(true); setTimeout(() => setAddressCopied(false), 2000); } catch { /* appunti non disponibili */ }
    };
    // Il verdetto in vista: la frase editoriale; se manca, la sintesi (mai testo inventato).
    const headline = verdictText ?? (synthesis?.trim() || null);
    const showSynthesisBelow = verdictText != null && synthesis != null && synthesis.trim() !== "";
    const hasOverview =
      showSynthesisBelow || hasTags || goForChips.length > 0 || dontExpectChips.length > 0;
    const hasReviewsTab = hasReviews || communitySlot != null;
    // Orari Google della ricerca (i salvati non li hanno): oggi in Info, "apre alle 19:00" se chiuso.
    const adesso = new Date();
    const oggi = orariDelGiorno(venue.orari, adesso);
    const riapre = openNow === false ? prossimaApertura(venue.orari, adesso) : null;
    const tabs = [
      ["panoramica", "Panoramica"],
      ...(hasReviewsTab ? [["recensioni", "Recensioni"]] : []),
      ["info", "Info"],
    ] as [SchedaTab, string][];
    const activeTab: SchedaTab = tab === "recensioni" && !hasReviewsTab ? "panoramica" : tab;
    const statusTiles: { tag: "Da provare" | "Già visitato"; label: string; emoji: string }[] = [
      { tag: "Da provare", label: "Voglio andarci", emoji: "📌" },
      { tag: "Già visitato", label: "Ci sono stato", emoji: "✓" },
    ];
    const menuItem =
      "flex min-h-12 w-full items-center gap-3 px-4 text-left text-[15px] font-sans text-text active:bg-bg";
    const ICON_BTN = "flex h-11 w-11 items-center justify-center rounded-full border active:scale-95";
    const iconBtn = `${ICON_BTN} border-border bg-white text-brand`;
    const altroMenu = (
      <>
                <button type="button" aria-label="Chiudi il menu" className="fixed inset-0 z-20 cursor-default" onClick={() => setMenuOpen(false)} />
                <div role="menu" data-testid="altro-menu" className="absolute right-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-card border border-border bg-surface py-1 shadow-float">
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
                  {canEdit && (
                    <button role="menuitem" type="button" onClick={() => { setMenuOpen(false); onEdit(); }} className={menuItem}>
                      <Pencil size={18} className="shrink-0 text-brand" aria-hidden /> Modifica tag e nota
                    </button>
                  )}
                  {address && (
                    <button role="menuitem" type="button" data-testid="altro-copia-indirizzo" onClick={() => { void copyAddress(); setMenuOpen(false); }} className={menuItem}>
                      <Copy size={18} className="shrink-0 text-brand" aria-hidden /> Copia indirizzo
                    </button>
                  )}
                  <a role="menuitem" href={mapsUrl} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)} className={menuItem}>
                    <ExternalLink size={18} className="shrink-0 text-brand" aria-hidden /> Apri su Google Maps
                  </a>
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
    const facts = [
      categoryLabel(category),
      rating != null ? `★ ${rating.toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}` : null,
      priceLabel,
      origin ? distanceLabel(origin, { lat, lng }) : null,
    ].filter(Boolean) as string[];

    return (
      <div className="relative flex flex-col rounded-card bg-surface shadow-float">
        <SchedaCarosello
          photoRefs={venue.photoRef ? [venue.photoRef] : []}
          name={name}
          credit={venue.photoAuthor}
          lat={lat}
          lng={lng}
          directionsUrl={directionsUrl}
          onDirections={() => signal("percorso", "carosello")}
          fallback={<div className="flex h-full w-full items-center justify-center bg-brand/10 text-6xl">{emoji}</div>}
          overlay={
            <button
              type="button"
              onClick={onClose}
              aria-label="Chiudi"
              className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur"
            >
              <X size={20} />
            </button>
          }
        />

        {/* Nome e UNA riga di fatti: tipo · voto · prezzo · distanza · aperto. */}
        <div className="px-5 pt-4">
          {/* Semplificare (Lorenzo 17/10): Condividi e Altro come icone accanto al nome, non più una riga di riquadri. */}
          <div className="flex items-start gap-2">
            {/* Nomi lunghi ("La Tavernetta 29 da Tony e Andrea") su 2 righe, non 3: il verdetto resta in vista. */}
            <h2 className={`min-w-0 flex-1 font-title font-semibold leading-tight text-text ${name.length > 24 ? "text-[1.4rem] in-data-[titoli=serif]:text-[1.8rem]" : "text-[1.75rem] in-data-[titoli=serif]:text-[2.2rem]"}`}>
              {name}
            </h2>
            <div className="relative flex shrink-0 gap-2 pt-0.5" data-testid="azioni-scheda">
              {shareOn && (
                <button type="button" onClick={share} aria-label={`Condividi ${name}`} className={iconBtn}>
                  <Share2 size={18} aria-hidden />
                </button>
              )}
              <button
                type="button"
                data-testid="altro-apri"
                aria-label="Altro"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                onClick={() => setMenuOpen((o) => !o)}
                className={menuOpen ? `${ICON_BTN} border-brand bg-brand text-white` : iconBtn}
              >
                <Ellipsis size={18} aria-hidden />
              </button>
              {menuOpen && altroMenu}
            </div>
          </div>
          {shareNote && <p role="status" className="mt-1 text-xs font-sans text-text-muted">{shareNote}</p>}
          <p data-testid="scheda-fatti" className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[14px] font-sans text-text-muted">
            {facts.map((f, i) => (
              <span key={f} className="inline-flex items-center gap-1.5">
                {i > 0 && <span aria-hidden>·</span>}
                <span className={i === 0 ? "text-text" : ""}>{f}</span>
              </span>
            ))}
            {openNow != null && !riapre && (
              <span className="inline-flex items-center gap-1.5">
                {facts.length > 0 && <span aria-hidden>·</span>}
                <span aria-hidden className={`h-2 w-2 rounded-full ${openNow ? "bg-success" : "bg-error"}`} />
                <span className={openNow ? "text-success" : "text-error"}>{openNow ? "Aperto ora" : "Chiuso ora"}</span>
              </span>
            )}
          </p>
          {/* Come Places: chiuso → quando riapre, su una riga sua (orari Google della ricerca). */}
          {riapre && (
            <p data-testid="riapre" className="mt-1 flex items-center gap-1.5 text-[14px] font-sans text-text-muted">
              <span aria-hidden className="h-2 w-2 rounded-full bg-error" />
              <span className="text-error">Chiuso ora</span>
              <span aria-hidden>·</span>
              <span>apre {riapre.replace(/^oggi /, "")}</span>
            </p>
          )}
          {/* Semplificare (20/10): i segnali brevi in UNA riga di pillole, non una riga ciascuno.
              Il contenitore sparisce se nessuno ha niente da dire (PostoLocale e BuoniPastoRiga arrivano dopo). */}
          <div data-testid="segnali-scheda" className="mt-2 flex flex-wrap items-center gap-1.5 empty:hidden [&>*]:mt-0!">
            {gem && (
              <span data-testid="gemma" className="inline-flex rounded-pill bg-accent-light px-2.5 py-0.5 text-xs font-display font-semibold text-accent">
                💎 Poco conosciuto
              </span>
            )}
            {/* Locale verificato: badge e, se il titolare l'ha detto, "🌙 Martedì c'è posto" (POSIZIONAMENTO.md, proposta 1). */}
            <PostoLocale venueId={venue.id} />
            {/* Buoni pasto: solo se almeno 2 persone che ci sono state concordano (PROPOSTE.md 19/10). */}
            <BuoniPastoRiga venueId={venue.id} />
          </div>
        </div>

        {/* Il verdetto Mapetite: sempre in vista, senza toccare nulla. */}
        {(headline != null || matchReasonText != null) && (
          <div data-testid="verdetto-box" className="mx-5 mt-4 rounded-card bg-brand p-4 shadow-card">
            <p data-testid="verdetto-scheda" className="text-[11px] font-display font-semibold uppercase tracking-wide text-accent">
              Il verdetto Mapetite
            </p>
            {headline && (
              <p className="mt-1.5 font-display text-lg font-semibold leading-snug text-white">{headline}</p>
            )}
            {matchReasonText && (
              <p className={`${headline ? "mt-2.5 border-t border-white/15 pt-2.5" : "mt-1.5"} font-sans text-sm leading-relaxed text-white/85`}>
                <span className="font-display font-semibold text-accent">✦ Per te: </span>
                {matchReasonText}
              </p>
            )}
          </div>
        )}
        {headline == null && matchReasonText == null && verdettoInArrivo && (
          <div data-testid="verdetto-in-arrivo" className="mx-5 mt-4 rounded-card bg-brand p-4 shadow-card">
            <p className="text-[11px] font-display font-semibold uppercase tracking-wide text-accent">Il verdetto Mapetite</p>
            <p className="mt-1.5 animate-pulse font-sans text-sm text-white/80">Lo sto scrivendo dalle recensioni…</p>
          </div>
        )}

        {/* Stato del salvato: una scelta sola (salvare sta già nella barra in basso). Locale non salvato
            senza barra (scheda dall'assistente): le due scelte rapide aprono Salva. */}
        {((isSaved && onVisitStatus) || (!isSaved && onQuickSave && !saveSlot)) && (
          <div className="mx-5 mt-4 flex rounded-pill bg-bg p-1" data-testid={isSaved ? "stato-salvato" : "stato-rapido"}>
            {statusTiles.map(({ tag, label, emoji: e }) => {
              const on = isSaved && (personalTags?.includes(tag) ?? false);
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={isSaved ? on : undefined}
                  aria-label={`${e} ${label}`}
                  onClick={() => {
                    if (!isSaved) { onQuickSave?.(tag); return; }
                    // Diario (4.4): appena segnato "Ci sono stato", il foglio "Com'è andata?".
                    if (tag === "Già visitato" && !on) setVisitAskedAt(Date.now());
                    onVisitStatus?.(tag);
                  }}
                  className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-pill text-[14px] font-display font-semibold active:scale-95 ${on ? "bg-surface text-brand shadow-card" : "text-text-muted"}`}
                >
                  <span aria-hidden>{e}</span>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Tre schede brevi al posto della lunga colonna di riquadri. */}
        <div role="tablist" aria-label="Sezioni della scheda" className="mx-5 mt-5 flex border-b border-border" data-testid="scheda-tabs">
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

        {/* Panoramica: chi ci è stato, le tue note, in breve. */}
        <div role="tabpanel" id="scheda-pannello-panoramica" aria-labelledby="scheda-tab-panoramica" hidden={activeTab !== "panoramica"} data-testid="pannello-panoramica">
          {friendsData && <AmiciQuiBox visitati={friendsData.visitati} daProvare={friendsData.daProvare} />}
          {showPersonalBlock && personalBlock(false)}
          {hasOverview && (
            <div className="mx-5 mt-4">
              <h3 className="font-display text-base font-semibold text-brand">In breve</h3>
              {showSynthesisBelow && (
                <p className="mt-1.5 font-sans text-[15px] leading-relaxed text-text">{synthesis}</p>
              )}
              {(goForChips.length > 0 || hasTags) && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {goForChips.map((chip) => (
                    <span key={`g-${chip}`} className="inline-flex items-center gap-1 rounded-pill bg-brand/10 px-2.5 py-1 text-xs font-display font-medium text-brand">
                      <Check size={12} className="shrink-0" aria-hidden />
                      {chip}
                    </span>
                  ))}
                  {tags?.filter((t) => !goForChips.some((g) => g.toLowerCase() === t.trim().toLowerCase())).map((tag) => (
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
            {/* Semplificare (20/10): "A confronto" in cima alle Recensioni, come il riepilogo dei voti di
                Google Maps; la Panoramica resta verdetto + In breve. La riga Mapetite porta alla community. */}
            {confronto(communitySlot ? () => document.querySelector("[data-testid=community-scheda]")?.scrollIntoView({ behavior: "smooth", block: "start" }) : undefined)}
            {hasReviews && (
              <div className="mx-5 mt-4">
                <h3 className="flex items-baseline justify-between font-display text-base font-semibold text-brand">
                  Cosa dicono
                  <span className="text-xs font-sans font-normal text-text-muted">Recensioni da Google</span>
                </h3>
                <ul className="mt-1 divide-y divide-border">
                  {selectedReviews!.map((review, i) => (
                    <li key={i} className="flex gap-2 py-2.5">
                      <Quote size={14} className="mt-1 shrink-0 text-text-muted" aria-hidden />
                      <p className="font-sans text-sm leading-relaxed text-text">{review.text}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {communitySlot && (
              <div className="mx-5 mt-4" data-testid="community-scheda">
                <h3 className="flex items-baseline justify-between font-display text-base font-semibold text-brand">
                  Dalla community Mapetite
                  <span className="text-xs font-sans font-normal text-text-muted">Recensioni degli utenti</span>
                </h3>
                <div className="mt-2">{communitySlot}</div>
              </div>
            )}
          </div>
        )}

        {/* Info: indirizzo (si copia), contatti che non stanno già nella barra, Google Maps. */}
        <div role="tabpanel" id="scheda-pannello-info" aria-labelledby="scheda-tab-info" hidden={activeTab !== "info"} data-testid="pannello-info">
          <div className="mx-5 mt-4" data-testid="scheda-info">
            <h3 className="font-display text-base font-semibold text-brand">Indirizzo e contatti</h3>
            <div className="mt-1 flex flex-col divide-y divide-border">
              {address && (
                <button type="button" data-testid="copia-indirizzo" onClick={copyAddress} className="flex min-h-12 items-center gap-3 text-left text-sm font-sans text-text">
                  <MapPin size={18} className="shrink-0 text-brand" aria-hidden />
                  <span className="min-w-0 flex-1">{displayAddress(address)}</span>
                  <span className="shrink-0 font-display font-semibold text-brand">{addressCopied ? "✓ Copiato" : "Copia"}</span>
                </button>
              )}
              {placeLine && (
                <p data-testid="citta-distanza" className="flex min-h-11 items-center gap-3 text-sm font-sans text-text-muted">
                  <Navigation size={18} className="shrink-0 text-brand" aria-hidden />
                  {placeLine}
                </p>
              )}
              {oggi && (
                <p data-testid="orari-oggi" className="flex min-h-11 items-center gap-3 text-sm font-sans text-text">
                  <Clock size={18} className="shrink-0 text-brand" aria-hidden />
                  <span><span className="font-display font-semibold">Oggi</span> {oggi}</span>
                </p>
              )}
              {userRatingCount != null && rating != null && (
                <p className="flex min-h-11 items-center gap-3 text-sm font-sans text-text-muted">
                  <span aria-hidden className="w-[18px] shrink-0 text-center text-star">★</span>
                  {`${rating.toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} su Google · ${userRatingCount.toLocaleString("it-IT")} recensioni`}
                </p>
              )}
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

        {bookingOpen && (
          <BookingSheet
            place={{ id: googlePlaceId ?? venue.id, name, phone, websiteUri, openNow, lat, lng, orari: venue.orari ?? null }}
            initial={booking}
            onClose={() => setBookingOpen(false)}
            alternative={bookingAlternatives}
            onAlternative={onBookAlternative}
          />
        )}

        {/* Barra scura a tre riquadri, staccata dal fondo (come Places): Prenota / Percorso / Salva,
            oppure Chiama / Percorso / Salva dove non si prenota. Sta sopra la barra in basso
            dell'app (--nav-height-mobile, che comprende già il bordo sicuro dell'iPhone). */}
        <div
          data-testid="barra-azioni"
          className="sticky bottom-[calc(max(var(--nav-height-mobile),env(safe-area-inset-bottom,0px))+var(--nav-sporgenza)+0.5rem)] z-10 mt-6 flex justify-center px-4"
        >
          {/* Bordo chiaro: sopra il riquadro scuro del verdetto la barra si fondeva con il testo sotto (18/10). */}
          <div className="flex w-full max-w-[22rem] items-stretch gap-1.5 rounded-[1.25rem] bg-brand p-1.5 shadow-float ring-[3px] ring-surface">
            {lead === "prenota" && (
              <button type="button" data-testid="prenota-scheda" onClick={() => openBooking("barra")} aria-label={`Prenota da ${name}`} className={`${ACTION_TILE} bg-accent`}>
                <CalendarCheck size={18} aria-hidden />
                Prenota
              </button>
            )}
            {(lead === "chiama" || extra === "chiama") && telHref && (
              <a href={telHref} onClick={() => signal("chiama", "barra")} aria-label={`Chiama ${name}`} className={`${TILE} ${extra === "chiama" ? "order-last" : ""}`}>
                <Phone size={18} aria-hidden />
                Chiama
              </a>
            )}
            {(lead === "sito" || extra === "sito") && websiteUri != null && (
              <a href={websiteUri} onClick={() => signal("sito", "barra")} target="_blank" rel="noopener noreferrer" aria-label={`Sito di ${name}`} className={`${TILE} ${extra === "sito" ? "order-last" : ""}`}>
                <Globe size={18} aria-hidden />
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
              {walk != null ? <Footprints size={18} aria-hidden /> : <Navigation size={18} aria-hidden />}
              <span className="whitespace-nowrap">{walk != null ? `${walk} min` : "Percorso"}</span>
            </a>
            {saveSlot}
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
            {getCategoryEmoji(category, name)}
          </span>
        )}
        <h2 className={`${venue.photoRef ? "" : "mt-2 pr-24 "}font-title text-2xl font-semibold leading-tight text-brand in-data-[titoli=serif]:text-[2.1rem]`}>
          {name}
        </h2>

        {/* Come Places: "Città · distanza", poi tipo · voto · prezzo · aperto. */}
        {(cityFromAddress(address) || origin) && (
          <p data-testid="citta-distanza" className="mt-1 text-sm font-sans text-text-muted">
            {[cityFromAddress(address), origin ? distanceLabel(origin, { lat, lng }) : null].filter(Boolean).join(" · ")}
          </p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-sans text-text-muted">
          {categoryLabel(category) && (
            <>
              <span className="text-text">{categoryLabel(category)}</span>
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
                    ? "rounded-pill bg-success/15 px-2 py-0.5 text-xs font-display font-semibold text-success"
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
          {([["Da provare", "📌 Voglio andarci"], ["Già visitato", "✓ Ci sono stato"]] as const).map(([tag, label]) => (
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
          onClose={() => setBookingOpen(false)}
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
