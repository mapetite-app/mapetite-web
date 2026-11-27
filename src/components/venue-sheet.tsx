"use client";

import { tagLabel, isStateTag } from "@/lib/tags";
import { Lock, X, Quote, Navigation, Globe, Phone, Check, Share, Share2, Footprints, CalendarCheck, Ellipsis, UsersRound, Store, ExternalLink, MapPin, Clock, Pencil, BadgeCheck, ChevronRight, Sparkles } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SchedaVisitaContext, type SchedaVisita } from "@/components/scheda-visita";
import { useBeta, useOptIn, useVariant } from "@/lib/beta";
import Link from "next/link";
import { track, trackFeature } from "@/lib/track";
import { isUuid } from "@/lib/gruppi";
import { bookingMakesSense } from "@/lib/bookable";
import SchedaCarosello from "@/components/scheda-carosello";
import AmiciQuiBox, { type FriendPerson } from "@/components/amici-qui-box";
import { conConsigliatoDa, mapetiteShareUrl, mioNome, nomeNeiLinkAcceso, sceltaNomeFatta, setNomeNeiLink, type MioNome } from "@/lib/share-place";
import { messaggioGrazie } from "@/lib/consigliato-da";
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
import { AperturaPillola, PostoPillola, PrezzoLocale, useInfoLocaleStato } from "@/components/posto-locale";
import AvvisoPosto from "@/components/avviso-posto";
import { frasePrezzo } from "@/lib/prezzo-locale";
import { fraseFreschezza } from "@/lib/freschezza-verdetto";
import { titoloGlutine, type Glutine } from "@/lib/glutine";
import { apertoIl, orariDelGiorno, prossimaApertura, prossimaChiusura, type Orari } from "@/lib/orari";
import BuoniPastoRiga from "@/components/buoni-pasto-riga";
import { salvatoDa } from "@/lib/ricordo-salvato";
import { browserClient } from "@/lib/supabase/client-lazy";
import VisiteMapetite from "@/components/visite-mapetite";

// Riquadri della barra azioni teal (mockup A "Editoriale", 21/10): icona e parola su una riga, 50px.
// La stessa classe la usa il pulsante Salva della mappa (SaveButton in map-view, prop `tile`).
export const ACTION_TILE =
  "flex h-[50px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[15px] px-2 text-[14.5px] font-display font-semibold text-white transition-transform active:scale-95";
// Mockup A: nome e verdetto in serif editoriale (Newsreader, già caricato in layout.tsx, come la home),
// fondo carta caldo come la home nuova.
const SERIF = "font-[family-name:var(--font-newsreader)]";
const PAPER = "bg-white"; // Lorenzo 5/11: niente più carta crema, bianco pieno come Places
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
  // Proposta 58: chi te l'ha consigliato (solo sui salvati, privato).
  consigliatoDa?: string | null;
  // Proposta 59: lucchetto "Solo per me" (si cambia in Modifica).
  soloPerMe?: boolean;
  // Proposta 68: quando l'hai salvato (saved_places.created_at), per "Salvato a marzo · da un reel Instagram".
  savedAt?: string | null;
  // Proposta 66: "Non contarlo nei miei gusti" (si cambia in Modifica).
  fuoriGusti?: boolean;
  photoRef?: string | null;
  orari?: Orari | null;
  photoAuthor?: string | null;
  // "Per te" dai gusti (mappa del gusto): scritto dall'AI solo con i gusti veri (vedi haiku-synthesis).
  perTe?: string | null;
  // Proposta 48 "Perché ti piacerà": "Come Roscioli, tra i posti che ti sono piaciuti: prezzi simili", dai tuoi 👍
  // (src/lib/perche-piacera.ts). Più concreto del "Per te" dell'AI: se c'è, prende il suo posto.
  percheTiPiacera?: string | null;
  // Requisiti della ricerca confermati, con la frase della recensione che li prova (proposta 18).
  requisiti?: { r: string; prova: string }[] | null;
  // Proposta 91 "Per chi è celiaco": cosa dicono del senza glutine le recensioni Google lette (src/lib/glutine.ts).
  glutine?: Glutine | null;
  // Frase di Google sul locale: si mostra, dichiarata, solo se il verdetto manca.
  editorialSummary?: string | null;
  // Proposta 45: stato da Google ("CLOSED_PERMANENTLY", "CLOSED_TEMPORARILY"), solo se noto.
  businessStatus?: string | null;
  // Proposta 67: da quante recensioni Google parla il verdetto e la data (ISO) della più recente.
  recensioniN?: number | null;
  recensioneUltima?: string | null;
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
  // Proposta 78: "Potrebbe piacerti anche" in fondo alla scheda (la passa map-view, solo con 2+ posti simili).
  similiSlot?: React.ReactNode;
  onBookAlternative?: (id: string, details: BookingDetails) => void;
  autoBook?: boolean;
  onBookingClosed?: () => void;
  // "Altri come questo" (proposta 27): solo per i salvati con 👍 o "Ci sono stato" (e non 👎).
  onAltriCome?: () => void;
  // Proposta 45: dalla scheda di un posto che ha chiuso, la stessa ricerca di "Altri come questo".
  onSimiliChiuso?: () => void;
  // "‹ 2 di 8 ›" tra i risultati (revisore del 2/11, D28: la pillola galleggiava sopra la scheda): sta dentro
  // la barra azioni in basso, la scheda prende tutto lo spazio.
  nav?: { pos: number; total: number } | null;
  onNavPrev?: () => void;
  onNavNext?: () => void;
  // Proposta 58: chi sta guardando (per leggere il proprio nome da mettere nei link condivisi).
  userId?: string | null;
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
  similiSlot,
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
  onSimiliChiuso,
  nav = null,
  onNavPrev,
  onNavNext,
  userId = null,
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
  const consigliatoDa = isSaved ? venue.consigliatoDa?.trim() || null : null;
  // Proposta 68 nella scheda: "Salvato a marzo · da un reel Instagram" in "Le tue note". Il reel collegato si legge
  // solo per i propri salvati (una lettura, solo le proprie righe); nota e consiglio hanno già la loro riga.
  const [reelMio, setReelMio] = useState<{ id: string; fonte: string; url: string } | null>(null);
  // Minore del revisore (19/11): la riga aspetta la lettura del reel (al massimo 1,5 s), con lo spazio già
  // riservato, così "· dal reel" non compare dopo la data con un lampo.
  const [reelLetto, setReelLetto] = useState<string | null>(null);
  const leggeReel = isSaved && !!userId && isUuid(venue.id);
  useEffect(() => {
    if (!leggeReel) return;
    let vivo = true;
    // Il tetto conta dalla domanda al database, non dal caricamento del client (lento solo in sviluppo).
    let basta: ReturnType<typeof setTimeout> | undefined;
    void browserClient()
      .then((client) => { basta = setTimeout(() => { if (vivo) setReelLetto(venue.id); }, 1500); return client.from("contenuti_locali").select("fonte, url").eq("user_id", userId).eq("place_id", venue.id).order("created_at", { ascending: true }).limit(1); })
      .then(({ data, error }) => {
        const r = !error && Array.isArray(data) && data[0] ? (data[0] as { fonte: string; url: string }) : null;
        if (vivo && r) setReelMio({ id: venue.id, ...r });
      }, () => {})
      .finally(() => { if (vivo) setReelLetto(venue.id); });
    return () => { vivo = false; if (basta) clearTimeout(basta); };
  }, [leggeReel, userId, venue.id]);
  const salvato = isSaved ? salvatoDa(venue.savedAt, reelMio?.id === venue.id ? reelMio : null) : null;
  const salvatoPronto = !leggeReel || reelLetto === venue.id;
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
  // Segnali sotto il nome: oltre 2 righe passano a una riga che scorre (si misura quando arrivano, per locale).
  const segnaliRef = useRef<HTMLDivElement>(null);
  const [segnaliScorre, setSegnaliScorre] = useState(false);
  const [segnaliDi, setSegnaliDi] = useState(venue.id);
  if (segnaliDi !== venue.id) { setSegnaliDi(venue.id); setSegnaliScorre(false); }
  // Prima misura prima di disegnare (niente fotogramma a 5 righe). Una volta che scorre resta così per quel locale
  // (anche se un segnale sparisce o il telefono gira): niente salti avanti e indietro.
  useLayoutEffect(() => {
    const el = segnaliRef.current;
    if (!el || segnaliScorre) return;
    const misura = () => {
      const kids = Array.from(el.querySelectorAll(":scope > * > *")) as HTMLElement[];
      if (kids.length < 2) return;
      // Righe vere: un elemento apre una riga nuova se comincia sotto il fondo della riga prima (pillole e riquadro
      // alti diversi, centrati, non hanno lo stesso offsetTop).
      let righe = 0, fondo = -Infinity;
      for (const k of [...kids].sort((a, b) => a.offsetTop - b.offsetTop)) {
        if (k.offsetHeight === 0) continue;
        if (k.offsetTop >= fondo - 2) { righe++; fondo = k.offsetTop + k.offsetHeight; } else fondo = Math.max(fondo, k.offsetTop + k.offsetHeight);
      }
      if (righe > 2) setSegnaliScorre(true);
    };
    misura();
    const ro = new ResizeObserver(misura);
    ro.observe(el);
    const mo = new MutationObserver(misura);
    mo.observe(el, { childList: true, subtree: true });
    return () => { ro.disconnect(); mo.disconnect(); };
  }, [segnaliScorre, venue.id]);
  // Proposta 91 "Per chi è celiaco": bocciata due volte il 27/11 (7,5 e 7,5), corretta e spenta per tutti
  // finché un revisore nuovo non la approva: si accende con ?beta=celiaco.
  const glutineScheda = useOptIn("celiaco") ? venue.glutine ?? null : null;
  // Con la riga "🌾 Senza glutine" niente chip "✓ senza glutine" doppione (mai un ✓ e un ⚠️ insieme).
  const SUL_GLUTINE = /glutin|celiac|gluten/i;
  const requisitiScheda = glutineScheda ? venue.requisiti?.filter((x) => !SUL_GLUTINE.test(x.r)) : venue.requisiti;
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
  // Proposta 58: il proprio nome per i link (letto all'apertura), la scelta del telefono e la riga dopo Condividi.
  const [mio, setMio] = useState<MioNome | null>(null);
  const [nomeAcceso, setNomeAcceso] = useState(true);
  const [rigaNome, setRigaNome] = useState(false);
  useEffect(() => {
    if (!shareOn) return;
    let vivo = true;
    void mioNome(userId).then((m) => { if (vivo) { setMio(m); setNomeAcceso(nomeNeiLinkAcceso()); if (!sceltaNomeFatta()) setRigaNome(true); } });
    return () => { vivo = false; };
  }, [shareOn, userId]);
  const cambiaNomeNeiLink = (acceso: boolean) => { setNomeNeiLink(acceso); setNomeAcceso(acceso); trackFeature("condividi_nome", { stato: acceso ? "si" : "no" }); };
  // Revisore 15/11 (proposta 59): su un posto col lucchetto la riga non invita a condividerlo col proprio nome.
  const rigaNomeLink = rigaNome && mio?.nelLink && !(isSaved && venue.soloPerMe) ? (
    <span data-testid="condividi-nome" role="status" className="flex items-center gap-1 text-[13px] font-sans text-text">
      <span>{nomeAcceso ? "Il link porta il tuo nome" : "Link senza nome"}</span>
      <span aria-hidden>·</span>
      <button type="button" data-testid="condividi-nome-cambia" onClick={() => cambiaNomeNeiLink(!nomeAcceso)} className="inline-flex min-h-11 min-w-11 items-center justify-center px-1 font-display font-semibold text-brand underline underline-offset-2">
        {nomeAcceso ? "Togli" : "Metti il nome"}
      </button>
    </span>
  ) : null;
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
  // Testata compatta (revisore del 6/11 sera, come Google Maps e Places): quando la foto è scorsa via, in alto
  // resta una barra bianca fissa con Chiudi, il nome e "‹ 1 di 12 ›". Prima, scorrendo, X e frecce sparivano.
  const radiceRef = useRef<HTMLDivElement>(null);
  const [compatta, setCompatta] = useState(false);
  useEffect(() => {
    // In ascolto su tutta la pagina (fase di cattura): la scheda scorre dentro contenitori diversi a seconda di dove si apre.
    const onScroll = () => {
      const radice = radiceRef.current;
      if (!radice) return;
      const foto = radice.querySelector("[data-testid=scheda-carosello], [data-testid=scheda-intestazione-emoji]")?.getBoundingClientRect();
      const cima = Math.max(0, radice.parentElement?.getBoundingClientRect().top ?? 0);
      // Revisore 7/11: con "foto.bottom < 72" a 375×667 c'era una zona (60–88 px di scorrimento) senza X né frecce:
      // i tasti sulla foto erano già usciti e la testata non era ancora comparsa. Ora compare appena i tasti escono.
      setCompatta(foto != null && foto.height > 0 && foto.top - cima <= -48);
    };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", onScroll, { capture: true });
  }, [venue.id]);
  useEffect(() => {
    if (livelloFoto >= 1 || detailsOpen) return;
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
    // Proposta 58: con il proprio primo nome ("da=Giulia"), già letto all'apertura della scheda, solo se il profilo
    // è pubblico o si ha almeno un amico, e se non l'hai tolto ("Togli" qui sotto). Mai un'attesa in più al tocco.
    const mapetiteUrl = await mapetiteShareUrl({ ...venue, lat, lng });
    const conNome = mapetiteUrl != null && mio?.nelLink === true;
    const url = mapetiteUrl ? conConsigliatoDa(mapetiteUrl, conNome && nomeAcceso ? mio.nome : null) : mapsUrl;
    if (conNome) { setRigaNome(true); if (!sceltaNomeFatta()) setNomeNeiLink(nomeAcceso); }
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

  // "Dillo a Giulia" (proposta 58): il messaggio pronto per chi te l'ha consigliato, dal foglio di condivisione
  // del telefono o, senza, da WhatsApp. Nessun dato passa da noi: solo il segnale d'uso, senza nome né testo.
  const dilloA = async (chi: string) => {
    const piaciuto = personalTags?.includes("Mi è piaciuto") ?? false;
    trackFeature("dillo_amico", { voto: piaciuto ? "su" : "altro" });
    // Revisore 15/11 (secondo): con il link del posto il consiglio riporta l'amico su Mapetite. I salvati hanno già
    // l'UUID: il link si scrive subito, senza attese che farebbero perdere il tocco su iPhone.
    const url = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(venue.id) ? `${window.location.origin}/locali/${venue.id}` : null;
    const text = messaggioGrazie(name, piaciuto);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share(url ? { title: `Per ${chi}`, text, url } : { title: `Per ${chi}`, text });
        return;
      } catch (err) {
        // Chiuso il foglio: niente. Altri errori (es. il telefono non accetta più il tocco): si passa a WhatsApp.
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(url ? `${text}\n${url}` : text)}`, "_blank", "noopener,noreferrer");
  };

  const hasReviews = selectedReviews != null && selectedReviews.length > 0;
  // Verdetto bipolare come CHIP: filtra gli elementi non vuoti dell'array.
  // dont_expect è spesso [] per il vincolo feroce lato prompt → resta nascosto.
  const matchReasonText =
    matchReason != null && matchReason.trim() !== "" ? matchReason.trim() : null;
  const verdictText =
    verdict != null && verdict.trim() !== "" ? verdict.trim() : null;
  const goForChips = senzaDoppioni(Array.isArray(goFor)
    ? goFor.filter((c) => c != null && c.trim() !== "" && !(glutineScheda && SUL_GLUTINE.test(c))).map((c) => c.trim())
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
  // "Da 3 recensioni Google, la più recente di ottobre" (proposta 67): null se il verdetto non le ha salvate.
  const freschezza = fraseFreschezza({ n: venue.recensioniN, ultima: venue.recensioneUltima });
  const hasTags = tags != null && tags.length > 0;
  const hasPersonalTags = personalTags != null && personalTags.length > 0;
  const showPersonalBlock =
    isSaved && (hasPersonalTags || personalNote != null || canEdit || onVisitStatus != null);
  const priceLabelGoogle =
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
  const [statoRapido, setStatoRapido] = useState<{ id: string; tag: "Da provare" | "Già visitato" } | null>(null);
  const quickSaveTag = (tag: "Da provare" | "Già visitato") => { setStatoRapido({ id: venue.id, tag }); onQuickSave?.(tag); };
  const variant = useVariant("scheda");
  // Proposta 61: la sezione recensioni usa il "Ci sono stato" di questa scheda (un solo tasto per schermata).
  // Tasto in vista: nei salvati in "Le tue note"; nei non salvati la fila "Da provare / Ci sono stato"
  // (scheda A sempre, scheda B solo senza barra Salva: altrimenti sta nel menu ⋯).
  // Revisore 16/11 sera: nell'assistente, dopo "✓ Ci sono stato" della fila rapida, la scheda non riceve i tag
  // (niente onVisitStatus): si ricorda qui lo stato scelto per quel posto, così la sezione apre subito il modulo.
  const statoRapidoDi = statoRapido?.id === venue.id ? statoRapido.tag : null;
  const tastoVisitaInVista = isSaved ? onVisitStatus != null && showPersonalBlock : onQuickSave != null && (variant !== "b" || !saveSlot);
  const schedaVisita: SchedaVisita = {
    visitato: isSaved
      ? onVisitStatus ? (personalTags?.includes("Già visitato") ?? false) : statoRapidoDi === "Già visitato" ? true : null
      : onQuickSave ? false : null,
    vai: tastoVisitaInVista
      ? () => document.querySelector(isSaved ? "[data-testid=stato-salvato]" : "[data-testid=stato-rapido]")?.scrollIntoView({ behavior: "smooth", block: "center" })
      : null,
    segna: !tastoVisitaInVista && !isSaved && onQuickSave ? () => quickSaveTag("Già visitato") : null,
  };
  // Locale verificato e "c'è posto" (parola del titolare): spunta accanto al nome e pillola sotto.
  const { info: infoLocale, pronto: infoPronta } = useInfoLocaleStato(venue.id);
  // Se il titolare verificato dichiara il prezzo a testa, niente "€€€€" di Google accanto (due fonti in contrasto, revisore 17/11).
  // Finché la risposta del locale non arriva la fascia non si mostra: prima compariva e poi spariva (revisore 4).
  const priceLabel = !infoPronta || (infoLocale?.verificato && frasePrezzo(infoLocale.prezzo)) ? null : priceLabelGoogle;
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
            {freschezza && (
              <p data-testid="verdetto-freschezza" className="mt-2 font-sans text-xs text-white/60">{freschezza}</p>
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
    <div data-testid="tue-note" className={editorial ? `mx-[22px] ${senzaFiletto ? "mt-3.5" : "mt-4 border-t border-[#e1e5e5] pt-3.5"}` : "mx-5 mt-4 rounded-card border-2 border-accent/30 bg-surface p-4"}>
        <p className={`font-display font-semibold uppercase text-accent ${editorial ? "text-[10.5px] tracking-[0.14em]" : "text-xs tracking-wide"}`}>
          Le tue note
        </p>
        {salvato && salvatoPronto && (
          <p data-testid="salvato-quando-scheda" className="mt-1 min-h-4 text-xs font-sans text-text-muted">
            {[salvato.data, salvato.fonte && (salvato.data ? salvato.fonte : `${salvato.fonte.charAt(0).toUpperCase()}${salvato.fonte.slice(1)}`)].filter(Boolean).join(" · ")}
          </p>
        )}
        {/* Mentre si legge il reel: la riga vuota tiene il posto (niente salto quando arriva). */}
        {!salvatoPronto && salvato && <p aria-hidden data-testid="salvato-quando-attesa" className="mt-1 min-h-4 text-xs" />}
        {/* Proposta 59: il lucchetto "Solo per me" (si cambia in Modifica). */}
        {isSaved && venue.soloPerMe && (
          <p data-testid="solo-per-me-scheda" className="mt-1.5 flex items-center gap-1.5 text-sm font-sans text-text-muted">
            <Lock size={14} className="shrink-0 text-brand" aria-hidden />
            <span>Solo per te: non lo vedono gli amici</span>
          </p>
        )}
        {/* Proposta 66: fuori dai gusti (si cambia in Modifica). */}
        {isSaved && venue.fuoriGusti && (
          <p data-testid="fuori-gusti-scheda" className="mt-1.5 flex items-center gap-1.5 text-sm font-sans text-text-muted">
            <Sparkles size={14} className="shrink-0 text-brand" aria-hidden />
            <span>Fuori dai tuoi gusti</span>
          </p>
        )}
        {/* Proposta 58: chi te l'ha consigliato (dal link condiviso o scritto a mano in Modifica). */}
        {consigliatoDa && (
          <p data-testid="consigliato-scheda" className="mt-1.5 flex items-center gap-1.5 text-sm font-sans text-text-muted">
            <UsersRound size={14} className="shrink-0 text-brand" aria-hidden />
            <span className="min-w-0 truncate">Te l&apos;ha consigliato <span className="font-display font-semibold text-brand">{consigliatoDa}</span></span>
          </p>
        )}
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
                  className={`min-h-11 flex-1 rounded-pill border px-3 text-sm font-display font-semibold active:scale-95 ${on ? "border-brand bg-brand text-white" : "border-border bg-white text-brand"}`}
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
            {/* Proposta 58 e 27: "Dillo a Giulia" e "Altri come questo" su una riga sola, metà ciascuno (revisore 15/11:
                due tasti bordati uno sotto l'altro pesavano troppo). Da soli prendono tutta la riga. */}
            {(consigliatoDa || (onAltriCome && !personalTags?.includes("Non fa per me"))) && (
              <div className="mt-2 flex gap-2">
                {consigliatoDa && (
                  <button
                    type="button"
                    data-testid="dillo-amico"
                    onClick={() => void dilloA(consigliatoDa)}
                    className="flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-pill border border-border bg-white px-3 text-sm font-display font-semibold text-brand active:scale-[0.98]"
                  >
                    <Share2 size={15} className="shrink-0" aria-hidden />
                    <span className="truncate">Dillo a {consigliatoDa.split(" ")[0]}</span>
                  </button>
                )}
                {onAltriCome && !personalTags?.includes("Non fa per me") && (
                  <button
                    type="button"
                    data-testid="altri-come"
                    onClick={onAltriCome}
                    className="flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-pill border border-accent/40 bg-accent/5 px-3 text-sm font-display font-semibold text-accent active:scale-[0.98]"
                  >
                    <span className="truncate">✨ {consigliatoDa ? "Altri così" : "Altri come questo"}</span>
                  </button>
                )}
              </div>
            )}
            {/* Proposta CEO 20/10: ti è piaciuto un posto poco recensito? Un tocco per lasciare due righe su Google,
                dove servono al locale (link pubblico di Google, nessun dato passa da noi). Non sui locali con 300 recensioni o più (non ne hanno bisogno). */}
            {personalTags?.includes("Mi è piaciuto") && venue.businessStatus !== "CLOSED_PERMANENTLY" && googlePlaceId && !/^[0-9a-f-]{36}$/i.test(googlePlaceId) && (userRatingCount == null || userRatingCount < 300) && (
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
        {/* Proposta 72: "Avvisami quando c'è posto", in fondo alle note (azione secondaria, revisore 21/11),
            solo per i salvati di un locale verificato (parola del titolare). */}
        {isSaved && !!userId && isUuid(venue.id) && infoLocale?.verificato && !personalTags?.includes("Non fa per me") && <AvvisoPosto venueId={venue.id} />}
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
    const daiTuoiPosti = venue.percheTiPiacera?.trim() || null;
    const perTeText = daiTuoiPosti ?? (venue.perTe?.trim() || null);
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
    // Blocco sopra la barra: punti forti (al massimo 4, su 2 righe) e 2 frasi delle recensioni Google già in
    // scheda, tagliate a 140 caratteri a fine frase o a fine parola. Mai la recensione già in vista sotto il nome.
    const puntiForti = goForChips.slice(0, 4);
    const a140 = (t: string) => {
      const pulito = t.replace(/\s+/g, " ").trim();
      if (pulito.length <= 140) return pulito;
      const cut = pulito.slice(0, 140);
      const fine = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
      return fine >= 60 ? cut.slice(0, fine + 1) : `${cut.replace(/[\s,;:–-]+\S*$/, "")}…`;
    };
    const recensioneInVista = !venue.editorialSummary?.trim() && headline == null && !verdettoInArrivo ? firstReview : null;
    const frasiRecensioni = [...new Set(
      (selectedReviews ?? [])
        .map((r) => r.text?.trim() ?? "")
        .filter((t) => t.length >= 20 && t !== recensioneInVista)
        .map(a140),
    )].slice(0, 2);
    // Nulla tra il verdetto e "Orari, contatti, recensioni": basta il filetto sotto il verdetto.
    const subitoDopoVerdetto = (headline != null || verdettoInArrivo || googleLine != null)
      && (requisitiScheda?.length ?? 0) === 0 && !glutineScheda && !perTeLine && !friendsData && !showPersonalBlock && !(!isSaved && onQuickSave && !saveSlot);
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
                    <button role="menuitem" type="button" data-testid="altro-ci-sono-stato" onClick={() => { setMenuOpen(false); quickSaveTag("Già visitato"); }} className={menuItem}>
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
      <div ref={radiceRef} className={`relative flex min-h-full flex-col rounded-card ${PAPER} shadow-float`}>
        <div className="sticky top-0 z-30 h-0">
          <div
            data-testid="scheda-testata-compatta"
            aria-hidden={!compatta}
            className={`absolute inset-x-0 top-0 flex items-center gap-2 border-b border-border bg-white/95 px-2 pb-1.5 pt-[calc(env(safe-area-inset-top,0px)+0.375rem)] backdrop-blur transition-[opacity,transform] duration-200 ${compatta ? "opacity-100" : "pointer-events-none -translate-y-2 opacity-0"}`}
          >
            <button type="button" onClick={onClose} aria-label="Chiudi la scheda" tabIndex={compatta ? 0 : -1} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text active:scale-95"><X size={20} aria-hidden /></button>
            <span className="min-w-0 flex-1 truncate font-display text-[15px] font-semibold text-brand">{nomeBreve}</span>
            {nav && compatta && (
              <span data-testid="scheda-nav-compatta" className="flex shrink-0 items-center text-text">
                <button type="button" onClick={onNavPrev} aria-label="Locale precedente" className="flex h-11 w-11 items-center justify-center rounded-full text-xl leading-none active:scale-95">‹</button>
                <span className="whitespace-nowrap text-[13px] font-display font-semibold tabular-nums">{nav.pos} di {nav.total}</span>
                <button type="button" onClick={onNavNext} aria-label="Locale successivo" className="flex h-11 w-11 items-center justify-center rounded-full text-xl leading-none active:scale-95">›</button>
              </span>
            )}
          </div>
        </div>
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
          // Revisore 6/11 sera: la foto finiva quasi sempre in una striscia da 64–96 px, mentre Places e Mapstr aprono con
          // una foto grande. Ora non scende mai sotto 160 px; la riga "Orari, contatti, recensioni" si raggiunge scorrendo.
          heightClass={livelloFoto >= 1 ? "h-40" : "h-56 [@media(max-height:760px)]:h-44"}
          // Senza foto niente riquadro grigio da 220px con l'emoji piccola (revisore del 2/11, r4): intestazione bassa
          // (120px più la zona sicura) con l'emoji su fondo del marchio, e il nome sale.
          heightSenzaFoto="h-[calc(env(safe-area-inset-top,0px)+7.5rem)]"
          fallback={
            // Emoji a sinistra sotto i tasti (revisore 6/11 sera): al centro ci sono "‹ 1 di 12 ›".
            <div data-testid="scheda-intestazione-emoji" className="flex h-full w-full items-end bg-brand px-[22px] pb-3 pt-[env(safe-area-inset-top,0px)]">
              <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-[26px] leading-none">{emoji}</span>
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
              {/* "‹ 1 di 12 ›" in alto al centro sulla foto (designer 6/11): la barra azioni in basso torna su una riga. */}
              {/* Una sola coppia di frecce per volta: quando c'è la testata compatta, quella. */}
              {nav && !compatta && (
                <div data-testid="scheda-nav" className="absolute left-1/2 top-[calc(env(safe-area-inset-top,0px)+1rem)] flex h-11 -translate-x-1/2 items-center rounded-full bg-white/90 text-text shadow-card backdrop-blur">
                  <button type="button" onClick={onNavPrev} aria-label="Locale precedente" className="flex h-11 w-11 items-center justify-center rounded-full text-xl leading-none active:scale-95">‹</button>
                <span className="whitespace-nowrap text-[13px] font-display font-semibold tabular-nums">{nav.pos} di {nav.total}</span>
                <button type="button" onClick={onNavNext} aria-label="Locale successivo" className="flex h-11 w-11 items-center justify-center rounded-full text-xl leading-none active:scale-95">›</button>
                </div>
              )}
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
          {rigaNomeLink}
          {(venue.businessStatus === "CLOSED_PERMANENTLY" || venue.businessStatus === "CLOSED_TEMPORARILY") && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p data-testid="scheda-chiuso" className="inline-flex rounded-pill bg-[#33373d] px-2.5 py-1 text-[12.5px] font-semibold font-sans text-white">
                {venue.businessStatus === "CLOSED_PERMANENTLY" ? "Secondo Google ha chiuso" : "Secondo Google è chiuso per ora"}
              </p>
              {venue.businessStatus === "CLOSED_PERMANENTLY" && onSimiliChiuso && (
                <button type="button" data-testid="scheda-simili-chiuso" onClick={onSimiliChiuso} className="min-h-[32px] rounded-pill border border-black/10 bg-white px-3 text-[12.5px] font-semibold font-sans text-brand active:bg-black/[0.04]">
                  Simili qui vicino ›
                </button>
              )}
            </div>
          )}
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
          {/* Voce "Semplificare" (27/11): oltre 2 righe (fino a 132 px a 360 con prezzo, "c'è posto", aperto da poco e 👍)
              il riquadro del titolare resta intero su una riga sua e le pillole corte vanno in una riga che scorre di lato,
              con la sfumatura a destra (revisore 27/11: il riquadro tagliato e fuori schermo non andava). Con pochi segnali
              tutto come prima, a capo. Il riquadro del titolare viene per primo: è il segnale più utile. */}
          <div
            ref={segnaliRef}
            data-testid="segnali-scheda"
            data-scorre={segnaliScorre ? "1" : undefined}
            className={`mt-2.5 hidden gap-1.5 has-[>*>*]:flex ${segnaliScorre ? "flex-col" : "flex-wrap items-center"}`}
          >
            <div data-testid="segnali-titolare" className={segnaliScorre ? "flex flex-wrap items-center gap-1.5 empty:hidden" : "contents"}>
              {/* Prezzo a testa detto dal titolare verificato (PROPOSTE.md 65), separato dai € di Google; dal 1/11 al 6/1
                  il menu delle feste (PROPOSTE.md 90) prende il suo posto nello stesso riquadro. */}
              <PrezzoLocale info={infoLocale} />
              {/* Se il titolare di un locale verificato l'ha detto, "🌙 Martedì c'è posto" (POSIZIONAMENTO.md, proposta 1).
                  Subito dopo il prezzo: le due frasi del titolare vicine, un solo "· dice il locale" (revisore 17/11). */}
              <PostoPillola info={infoLocale} conPrezzo />
            </div>
            <div
              data-testid="segnali-corti"
              role={segnaliScorre ? "group" : undefined}
              aria-label={segnaliScorre ? "Altri segnali del locale, scorri di lato" : undefined}
              tabIndex={segnaliScorre ? 0 : undefined}
              className={segnaliScorre ? "-mx-[22px] flex flex-nowrap items-center gap-1.5 overflow-x-auto px-[22px] pb-0.5 [mask-image:linear-gradient(to_right,#000_82%,transparent)] [scrollbar-width:none] empty:hidden [&::-webkit-scrollbar]:hidden [&>*]:shrink-0" : "contents"}
            >
              {gem && (
                <span data-testid="gemma" className="inline-flex rounded-pill bg-accent-light px-2.5 py-0.5 text-xs font-display font-semibold text-accent">
                  💎 Poco conosciuto
                </span>
              )}
              {/* Aperto da poco (PROPOSTE.md, proposta 7): parola del titolare verificato, solo il primo anno. */}
              <AperturaPillola info={infoLocale} />
              {/* Buoni pasto: solo se almeno 2 persone che ci sono state concordano (PROPOSTE.md 19/10). */}
              <BuoniPastoRiga venueId={venue.id} category={category} />
              {/* Chi ci è stato su Mapetite e com'era (solo da 5 voti in su, PROBLEMI.md 3), con quanto ha speso a testa
                  (PROPOSTE.md 64, da 5 risposte, fascia scelta da almeno 2 senza pareggi) nella stessa pillola, anche se il locale dichiara il suo prezzo (due fonti, mai nascoste l'una dall'altra). */}
              <VisiteMapetite venueId={googlePlaceId ?? venue.id} spesaId={venue.id} />
            </div>
          </div>

          {/* IL VERDETTO MAPETITE: in corsivo tra due filetti, come una citazione di rivista.
              Se manca: "lo sto scrivendo" mentre arriva, altrimenti la frase di Google dichiarata come tale. */}
          {headline != null ? (
            <section data-testid="verdetto-box" className="mt-4 border-y border-t-[#cfd6d6] border-b-[#e1e5e5] pb-4 pt-3.5">
              <p data-testid="verdetto-scheda" className="flex items-center gap-1.5 font-display text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brand">
                <Sparkles size={12} className="shrink-0 text-accent" aria-hidden />
                Il verdetto Mapetite
              </p>
              <p className={`${SERIF} mt-2 text-[20px] italic leading-[1.24] tracking-[-0.005em] text-[#141414] min-[380px]:text-[22px]`}>{headline}</p>
              {/* Da quando parla il verdetto (proposta 67): una riga piccola e grigia, solo con dati salvati. */}
              {freschezza && (
                <p data-testid="verdetto-freschezza" className="mt-2 font-sans text-[12px] leading-snug text-text-muted">{freschezza}</p>
              )}
            </section>
          ) : verdettoInArrivo ? (
            <section data-testid="verdetto-in-arrivo" className="mt-4 border-y border-t-[#cfd6d6] border-b-[#e1e5e5] pb-4 pt-3.5">
              <p className="flex items-center gap-1.5 font-display text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brand">
                <Sparkles size={12} className="shrink-0 text-accent" aria-hidden />
                Il verdetto Mapetite
              </p>
              <p className={`${SERIF} mt-2 animate-pulse text-[20px] italic leading-[1.24] text-text-muted`}>Lo sto scrivendo dalle recensioni…</p>
            </section>
          ) : googleLine ? (
            <section data-testid="verdetto-google" className="mt-4 border-y border-t-[#cfd6d6] border-b-[#e1e5e5] pb-4 pt-3.5">
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
            // Designer 6/11: senza il cerchio con la scintilla (sembrava un pulsante, terza ✦ dello schermo): una riga
            // che continua il verdetto, come la descrizione sotto il nome in Places.
            <p data-testid="per-te-scheda" data-fonte={daiTuoiPosti ? "salvati" : perTeText ? "gusti" : "ricerca"} className="mt-3 text-[13.5px] font-sans leading-snug text-[#3d4248]">
              <span className="min-w-0">
                <b className="font-display font-semibold text-accent">{perTeText ? "Per te" : "Perché qui"}</b> · {perTeLine}
              </span>
            </p>
          )}

          {/* Requisiti della ricerca confermati: un tocco mostra la frase della recensione (copiata, mai riscritta). */}
          {(requisitiScheda?.length ?? 0) > 0 && (
            <div data-testid="requisiti-scheda" className="mt-3.5">
              <div className="flex flex-wrap gap-2">
                {requisitiScheda!.map(({ r }) => (
                  <button
                    key={r}
                    type="button"
                    aria-expanded={provaAperta === r}
                    onClick={() => setProvaAperta((x) => (x === r ? null : r))}
                    className={`inline-flex min-h-11 items-center gap-1.5 rounded-pill border px-3.5 text-[13.5px] font-display font-semibold active:scale-95 ${provaAperta === r ? "border-brand bg-brand text-white" : "border-[#e1e5e5] bg-white text-brand"}`}
                  >
                    <span aria-hidden className={provaAperta === r ? "text-white" : "text-success"}>✓</span>
                    {r}
                  </button>
                ))}
              </div>
              {provaAperta && requisitiScheda!.find((x) => x.r === provaAperta) && (
                <p data-testid="prova-recensione" className="mt-2 scroll-mb-28 text-[13.5px] font-sans leading-snug text-[#3d4248]">
                  <span className={`${SERIF} italic text-[#141414]`}>«{requisitiScheda!.find((x) => x.r === provaAperta)!.prova}»</span>
                  <span className="text-text-muted"> · da una recensione su Google</span>
                </p>
              )}
            </div>
          )}

          {/* Proposta 91 "Per chi è celiaco": solo per chi ha "Senza glutine" tra i gusti o lo cerca (il server manda il
              campo solo allora). Cosa dicono le recensioni, con la frase copiata; mai "sicuro" o "adatto ai celiaci". */}
          {glutineScheda && (
            <div data-testid="glutine-scheda" data-stato={glutineScheda.stato} className="mt-3.5 text-[13.5px] font-sans leading-snug text-[#3d4248]">
              {/* Revisore 27/11: testo in linea (niente "·" orfano a fine riga quando va a capo). */}
              <p>
                <b className="font-display font-semibold text-brand"><span aria-hidden>🌾</span> Senza glutine</b>
                <span className={glutineScheda.stato === "attenzione" ? "font-semibold text-[#b3261e]" : ""}>
                  <span aria-hidden className="font-normal text-text-muted"> · </span>
                  {glutineScheda.stato === "bene" && <span aria-hidden className="text-success">✓ </span>}
                  {glutineScheda.stato === "attenzione" && <span aria-hidden>⚠️ </span>}
                  {titoloGlutine(glutineScheda)}
                </span>
              </p>
              {glutineScheda.frase && (
                <p data-testid="glutine-frase" className="mt-1">
                  <span className={`${SERIF} italic text-[#141414]`}>«{glutineScheda.frase}»</span>
                  <span className="text-text-muted"> · da una recensione su Google</span>
                </p>
              )}
              {/* Chiama dove serve: senza notizie e con un avviso (revisore 27/11). */}
              {(glutineScheda.stato === "niente" || glutineScheda.stato === "attenzione") && (
                <p className="mt-0.5 flex items-center gap-2 text-text-muted">
                  <span>Chiedi al locale prima di andare.</span>
                  {telHref && (
                    <a data-testid="glutine-chiama" href={telHref} onClick={() => signal("chiama")} className="inline-flex min-h-11 items-center gap-1 font-display font-semibold text-brand">
                      <Phone size={14} aria-hidden /> Chiama
                    </a>
                  )}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Chi dei tuoi amici c'è stato: passaparola vero, solo tra chi segui. */}
        {friendsData && <AmiciQuiBox visitati={friendsData.visitati} daProvare={friendsData.daProvare} className="mx-[22px] mt-4" />}

        {/* Le tue note (stato, Com'era, classifica, tag e nota): solo per i salvati, in vista. */}
        {showPersonalBlock && personalBlock(true, true, (headline != null || verdettoInArrivo || googleLine != null) && (requisitiScheda?.length ?? 0) === 0 && !glutineScheda && !perTeLine && !friendsData)}

        {/* Locale non salvato senza barra Salva (scheda dall'assistente): le due scelte rapide aprono Salva. */}
        {!isSaved && onQuickSave && !saveSlot && (
          <div className="mx-[22px] mt-4 flex rounded-pill bg-bg p-1" data-testid="stato-rapido">
            {([["Da provare", "Da provare", "📌"], ["Già visitato", "Ci sono stato", "✓"]] as const).map(([tag, label, e]) => (
              <button
                key={tag}
                type="button"
                aria-label={`${e} ${label}`}
                onClick={() => quickSaveTag(tag)}
                className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-pill text-[14px] font-display font-semibold text-text-muted active:scale-95"
              >
                <span aria-hidden>{e}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Sopra la barra, a scheda chiusa: i punti forti e due frasi delle recensioni Google già caricate
            (revisore del 2/11, r5: senza foto restava un terzo di schermo vuoto). Solo dati già presenti nella
            scheda, nessuna chiamata in più; senza dati il blocco non c'è. Corto: al massimo 2 righe di pillole. */}
        {(puntiForti.length > 0 || frasiRecensioni.length > 0) && (
          <section data-testid="scheda-in-vista" className="mx-[22px] mt-1 pb-2">
            {puntiForti.length > 0 && (
              <div data-testid="scheda-punti-forti">
                <div className="mt-1 flex max-h-[4.25rem] flex-wrap gap-1.5 overflow-hidden">
                  {puntiForti.map((chip) => (
                    <span key={chip} className="inline-flex max-w-full items-center gap-1 rounded-pill border border-[#d9dede] bg-white px-3 py-1.5 text-[13px] font-sans font-medium text-text">
                      <Check size={12} className="shrink-0" aria-hidden />
                      <span className="truncate">{chip}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {frasiRecensioni.length > 0 && (
              <div data-testid="scheda-frasi-recensioni" className={puntiForti.length > 0 ? "mt-4" : ""}>
                <ul className="flex flex-col gap-2">
                  {frasiRecensioni.map((f) => (
                    <li key={f} className="font-sans text-[14px] leading-[1.45] text-[#4b5058]">«{f}»</li>
                  ))}
                </ul>
                <p className="mt-1.5 text-[11.5px] font-sans text-text-muted">dalle recensioni Google</p>
              </div>
            )}
          </section>
        )}

        {/* "Orari, contatti, recensioni ›": tutto il resto, un tocco più in là. Designer 6/11: chiude il racconto
            (verdetto → perché → per cosa andarci → frasi → altro) invece di interromperlo, come la riga › di Albo. */}
        <button
          type="button"
          data-testid="scheda-altro-info"
          aria-expanded={detailsOpen}
          aria-controls={`scheda-dettagli-${venue.id}`}
          onClick={openDetails}
          className={`mx-[22px] flex min-h-12 items-center justify-between pt-0.5 text-left text-[13.5px] font-sans text-[#4b5058] ${subitoDopoVerdetto && !(puntiForti.length > 0 || frasiRecensioni.length > 0) ? "" : "mt-2 border-t border-[#e1e5e5]"}`}
        >
          Orari, contatti, recensioni
          <ChevronRight size={18} aria-hidden className={`shrink-0 transition-transform ${detailsOpen ? "rotate-90" : ""}`} />
        </button>

        <div id={`scheda-dettagli-${venue.id}`} data-testid="scheda-dettagli" hidden={!detailsOpen} className="scroll-mt-4">
          {/* Tre sezioni brevi: Info · Recensioni · In breve. */}
          <div role="tablist" aria-label="Sezioni della scheda" className="mx-[22px] mt-1 flex border-b border-[#e1e5e5]" data-testid="scheda-tabs">
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
                  <div className="mt-2"><SchedaVisitaContext.Provider value={schedaVisita}>{communitySlot}</SchedaVisitaContext.Provider></div>
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

        {similiSlot}

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
              // Revisore 4/11 sera: niente percorso verso un posto che ha chiuso per sempre.
              className={`${TILE} ${venue.businessStatus === "CLOSED_PERMANENTLY" ? "hidden" : ""}`}
              data-testid="scheda-percorso"
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
        {rigaNomeLink && <span className="rounded-pill bg-surface px-2.5 shadow-card">{rigaNomeLink}</span>}
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
              <span data-testid="fascia-google" className="font-display text-text">{priceLabel}</span>
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
              onClick={() => quickSaveTag(tag)}
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
          <div className="mt-2"><SchedaVisitaContext.Provider value={schedaVisita}>{communitySlot}</SchedaVisitaContext.Provider></div>
        </div>
      )}
      {similiSlot}

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
