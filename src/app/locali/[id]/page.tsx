import type { Metadata } from "next";
import LogoMark from "@/components/logo-mark";
import PostoLocale from "@/components/posto-locale";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, X, Navigation, MapPin, BadgeCheck, Sparkles } from "lucide-react";
import PlacePhoto from "@/components/place-photo";
import { getCategoryEmoji } from "@/lib/emoji";
import { categoryLabel } from "@/lib/category-label";
import { cityFromAddress, displayAddress } from "@/lib/city";
import SalvaLocale from "./salva-locale";
import AmiciQui from "./amici-qui";
import CommunityLocale from "@/components/community-locale";
import { safeNext } from "@/lib/next-path";
import {
  cleanList,
  currentUserId,
  loadPublicPlace,
  priceLabel,
  ratingLabel,
  validPhotoRef,
} from "./dati";

// Mockup A "Editoriale" (21/10), come la scheda della mappa: nome e verdetto in serif, fondo carta.
const SERIF = "font-[family-name:var(--font-newsreader)]";

// Pagina pubblica di un locale: è dove arriva l'amico a cui è stato condiviso.
// Stile della scheda (mockup A): foto grande, categoria in maiuscoletto, nome in serif, il verdetto Mapetite
// (solo se già in cache: mai testo nuovo), percorso, l'invito a salvarlo in Mapetite e, a parte,
// "Dalla community Mapetite" (recensioni e reel degli utenti, letti dal telefono).

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

function kindLine(category: string | null, price: number | null, rating: number | null): string {
  return [categoryLabel(category), priceLabel(price), ratingLabel(rating)].filter(Boolean).join(" · ");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await loadPublicPlace(id);
  if (!data) return { title: "Locale non trovato · Mapetite" };
  const { place, synthesis } = data;
  const city = cityFromAddress(place.address);
  const title = `${place.name}${city ? ` · ${city}` : ""} · Mapetite`;
  const verdict = synthesis?.verdict?.trim() || null;
  const context = kindLine(place.category, place.price_level, place.rating);
  const description = verdict
    ? `Il verdetto Mapetite: ${verdict}`
    : `${context ? `${context}. ` : ""}Salvalo in Mapetite per ritrovarlo quando serve.`;
  return {
    title,
    description,
    openGraph: { title: place.name, description, locale: "it_IT", type: "website", siteName: "Mapetite" },
  };
}

export default async function LocalePubblicoPage({ params, searchParams }: Props) {
  const { id } = await params;
  const data = await loadPublicPlace(id);
  if (!data) notFound();
  const { place, synthesis } = data;
  const sp = await searchParams;
  const fotoParam = Array.isArray(sp.foto) ? sp.foto[0] : sp.foto;
  const photoRef = validPhotoRef(fotoParam, place.google_place_id);
  const userId = await currentUserId();
  // Ritorno dopo accesso/registrazione: di nuovo qui, con "salva=1" per evidenziare il pulsante
  // (il salvataggio resta un tocco esplicito). La foto si tiene se il percorso non diventa troppo lungo.
  const backBase = `/locali/${place.id}?salva=1`;
  const returnPath =
    (photoRef ? safeNext(`${backBase}&foto=${encodeURIComponent(photoRef)}`) : null) ?? backBase;
  const salvaParam = Array.isArray(sp.salva) ? sp.salva[0] : sp.salva;
  const highlightSave = userId != null && salvaParam === "1";

  const emoji = getCategoryEmoji(place.category, place.name);
  const city = cityFromAddress(place.address);
  const kind = kindLine(place.category, place.price_level, place.rating);
  const verdict = synthesis?.verdict?.trim() || null;
  const synthText = synthesis?.synthesis?.trim() || null;
  const goFor = cleanList(synthesis?.go_for);
  const dontExpect = cleanList(synthesis?.dont_expect);
  const hasVerdict = verdict != null || synthText != null || goFor.length > 0 || dontExpect.length > 0;

  const directions = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}${place.google_place_id ? `&query_place_id=${encodeURIComponent(place.google_place_id)}` : ""}`;
  const heroFallback = (
    <div className="flex h-56 items-center justify-center bg-brand/10 text-7xl" aria-hidden>
      {emoji}
    </div>
  );

  return (
    <main className="mx-auto min-h-dvh max-w-md bg-[#f8f6f2] pb-8" data-testid="locale-pubblico">
      <div className="relative">
        {photoRef ? (
          <PlacePhoto photoRef={photoRef} alt={place.name} width={800} priority className="h-72 w-full object-cover" fallback={heroFallback} />
        ) : (
          heroFallback
        )}
        <Link
          href="/"
          className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-pill bg-black/45 px-3 py-1.5 font-display text-xs font-semibold text-white backdrop-blur"
        >
          <LogoMark size={18} className="rounded-[5px]" />
          Mapetite
        </Link>
      </div>

      <div className="px-[22px] pt-[22px]">
        {/* Riga di categoria in maiuscoletto: tipo · prezzo · voto · città (mockup A). */}
        {(kind || city) && (
          <p className="font-display text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            {kind && <span data-testid="locale-tipo">{kind}</span>}
            {kind && city && <span aria-hidden> · </span>}
            {city && <span>{city}</span>}
          </p>
        )}
        <h1 className={`${SERIF} mt-2 font-medium leading-[1.02] tracking-[-0.02em] text-[#141414] ${place.name.length > 22 ? "text-[32px]" : "text-[40px]"}`}>
          {place.name}
        </h1>
        {/* Badge "Verificato" (piano 8.1): il titolare ha rivendicato il locale e Mapetite l'ha verificato. */}
        {place.verified_at && (
          <p data-testid="locale-verificato" className="mt-2.5 inline-flex items-center gap-1 rounded-pill bg-brand/10 px-2.5 py-1 text-xs font-display font-semibold text-brand">
            <BadgeCheck size={14} className="shrink-0" aria-hidden />
            Verificato dal titolare
          </p>
        )}
        {place.verified_at && <PostoLocale venueId={place.id} />}
      </div>

      {/* Passaparola: quanti amici (persone che segui) ci sono stati o vogliono provarlo. */}
      <AmiciQui placeId={place.id} />

      {/* Il verdetto Mapetite in corsivo tra due filetti, come una citazione di rivista (solo se in cache). */}
      {hasVerdict && (
        <section data-testid="verdetto-pubblico" className="mx-[22px] mt-5 border-y border-t-[#1c1c1e] border-b-[#e3ddd2] pb-4 pt-3.5">
          {(verdict != null || synthText != null) && (
            <>
              <p className="flex items-center gap-1.5 font-display text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brand">
                <Sparkles size={12} className="shrink-0 text-accent" aria-hidden />
                Il verdetto Mapetite
              </p>
              {verdict && <p className={`${SERIF} mt-2 text-[22px] italic leading-[1.24] tracking-[-0.005em] text-[#141414]`}>{verdict}</p>}
              {synthText && <p className="mt-2 font-sans text-[15px] leading-relaxed text-[#3d4248]">{synthText}</p>}
            </>
          )}
          {goFor.length > 0 && (
            <div className={verdict != null || synthText != null ? "mt-3.5" : ""}>
              <p className="font-display text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted">Ci dovresti andare se</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {goFor.map((chip) => (
                  <span key={chip} className="inline-flex items-center gap-1 rounded-pill bg-brand/10 px-2.5 py-1 text-xs font-display font-medium text-brand">
                    <Check size={12} className="shrink-0" />
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          )}
          {dontExpect.length > 0 && (
            <div className="mt-3">
              <p className="font-display text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted">Meno adatto se</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {dontExpect.map((chip) => (
                  <span key={chip} className="inline-flex items-center gap-1 rounded-pill border border-border px-2.5 py-1 text-xs font-display font-medium text-text-muted">
                    <X size={12} className="shrink-0" />
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {place.address && (
        <p className="mx-[22px] mt-5 flex items-start gap-2 text-sm font-sans text-text-muted">
          <MapPin size={16} className="mt-0.5 shrink-0 text-brand" aria-hidden />
          <span>{displayAddress(place.address)}</span>
        </p>
      )}

      <div className="mx-[22px] mt-4 flex gap-2">
        <a
          href={directions}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-pill bg-brand px-4 text-sm font-display font-semibold text-white active:scale-95"
        >
          <Navigation size={16} className="shrink-0" />
          Percorso
        </a>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 flex-1 items-center justify-center whitespace-nowrap rounded-pill border border-border bg-white px-3 text-[13px] font-display font-semibold text-brand active:scale-95"
        >
          Apri su Google Maps
        </a>
      </div>

      <SalvaLocale placeId={place.id} placeName={place.name} userId={userId} returnPath={returnPath} highlight={highlightSave} />

      {/* Piani 5.6c e 5.6d: recensioni degli utenti e reel collegati al locale, separati dai dati Google. */}
      <section data-testid="community-pubblica" className="mx-5 mt-6 border-t border-border pt-4">
        <h2 className="flex items-baseline justify-between font-display text-base font-semibold text-brand">
          Dalla community Mapetite
          <span className="text-xs font-sans font-normal text-text-muted">Recensioni degli utenti</span>
        </h2>
        <div className="mt-2">
          <CommunityLocale id={place.id} userId={userId} contesto="locale" loginHref={`/login?next=${encodeURIComponent(`/locali/${place.id}`)}`} />
        </div>
      </section>

      {/* Piano 8.1: un invito discreto per chi gestisce il locale (sparisce quando è verificato). */}
      {!place.verified_at && (
        <p className="mx-5 mt-6 text-center text-xs font-sans text-text-muted">
          Sei il titolare?{" "}
          <Link data-testid="rivendica-locale" href={`/per-i-ristoratori/rivendica?locale=${place.id}`} className="font-display font-semibold text-brand underline underline-offset-2">
            Rivendica questo locale
          </Link>
        </p>
      )}
    </main>
  );
}
