import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, X, Navigation, MapPin, BadgeCheck } from "lucide-react";
import PlacePhoto from "@/components/place-photo";
import { getCategoryEmoji } from "@/lib/emoji";
import { categoryLabel } from "@/lib/category-label";
import { cityFromAddress, displayAddress } from "@/lib/city";
import SalvaLocale from "./salva-locale";
import AmiciQui from "./amici-qui";
import { safeNext } from "@/lib/next-path";
import {
  cleanList,
  currentUserId,
  loadPublicPlace,
  priceLabel,
  ratingLabel,
  validPhotoRef,
} from "./dati";

// Pagina pubblica di un locale: è dove arriva l'amico a cui è stato condiviso.
// Stile della scheda B (Places): foto grande, nome, contesto, il verdetto Mapetite
// (solo se già in cache: mai testo nuovo), percorso, e l'invito a salvarlo in Mapetite.

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
    <div className="flex h-48 items-center justify-center bg-brand/10 text-7xl" aria-hidden>
      {emoji}
    </div>
  );

  return (
    <main className="mx-auto min-h-dvh max-w-md bg-bg pb-8" data-testid="locale-pubblico">
      <div className="relative">
        {photoRef ? (
          <PlacePhoto photoRef={photoRef} alt={place.name} width={800} priority className="h-56 w-full object-cover" fallback={heroFallback} />
        ) : (
          heroFallback
        )}
        <Link
          href="/"
          className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-pill bg-black/45 px-3 py-1.5 font-display text-xs font-semibold text-white backdrop-blur"
        >
          <span aria-hidden className="h-2 w-2 rounded-full bg-accent" />
          Mapetite
        </Link>
      </div>

      <div className="px-5 pt-5">
        <h1 className="font-title text-3xl font-semibold leading-tight text-text in-data-[titoli=serif]:text-[2.4rem]">
          {place.name}
        </h1>
        {/* Badge "Verificato" (piano 8.1): il titolare ha rivendicato il locale e Mapetite l'ha verificato. */}
        {place.verified_at && (
          <p data-testid="locale-verificato" className="mt-2 inline-flex items-center gap-1 rounded-pill bg-brand/10 px-2.5 py-1 text-xs font-display font-semibold text-brand">
            <BadgeCheck size={14} className="shrink-0" aria-hidden />
            Verificato dal titolare
          </p>
        )}
        {city && <p className="mt-2 text-[15px] font-sans text-text-muted">{city}</p>}
        {kind && <p data-testid="locale-tipo" className="mt-0.5 text-[15px] font-sans text-text-muted">{kind}</p>}
      </div>

      {/* Passaparola: quanti amici (persone che segui) ci sono stati o vogliono provarlo. */}
      <AmiciQui placeId={place.id} />

      {hasVerdict && (
        <section data-testid="verdetto-pubblico" className="mx-5 mt-5 rounded-card bg-brand p-5 shadow-card">
          {(verdict != null || synthText != null) && (
            <>
              <p className="text-xs font-display font-semibold uppercase tracking-wide text-accent">Il verdetto Mapetite</p>
              {verdict && <p className="mt-2 font-display text-xl font-semibold leading-relaxed text-white">{verdict}</p>}
              {synthText && <p className="mt-2 font-sans text-sm leading-relaxed text-white/80">{synthText}</p>}
            </>
          )}
          {goFor.length > 0 && (
            <div className={verdict != null || synthText != null ? "mt-4 border-t border-white/15 pt-3" : ""}>
              <p className="text-xs font-display font-semibold uppercase tracking-wide text-white/80">Ci dovresti andare se</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {goFor.map((chip) => (
                  <span key={chip} className="inline-flex items-center gap-1 rounded-pill bg-white/15 px-2.5 py-1 text-xs font-display font-medium text-white">
                    <Check size={12} className="shrink-0" />
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          )}
          {dontExpect.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-display font-semibold uppercase tracking-wide text-white/60">Meno adatto se</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {dontExpect.map((chip) => (
                  <span key={chip} className="inline-flex items-center gap-1 rounded-pill bg-white/10 px-2.5 py-1 text-xs font-display font-medium text-white/60">
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
        <p className="mx-5 mt-5 flex items-start gap-2 text-sm font-sans text-text-muted">
          <MapPin size={16} className="mt-0.5 shrink-0 text-brand" aria-hidden />
          <span>{displayAddress(place.address)}</span>
        </p>
      )}

      <div className="mx-5 mt-4 flex gap-2">
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
