"use client";

import { useEffect, useState } from "react";
import { ExternalLink, ChevronRight } from "lucide-react";
import { trackFeature } from "@/lib/track";
import { cityFromAddress } from "@/lib/city";
import type { Community } from "@/lib/community";
import type { TripadvisorEsito } from "@/lib/tripadvisor";
import {
  type FonteConfronto,
  mediaVoti,
  michelinSearchUrl,
  mostraMichelin,
  mostraTheFork,
  mostraTripadvisor,
  theforkSearchUrl,
  tripadvisorSearchUrl,
  votoIt,
} from "@/lib/confronto";

// "A confronto" (richiesta di Lorenzo, 17/10): il locale visto da Mapetite, Google, Tripadvisor,
// Guida Michelin e TheFork, in poche righe come Places. Mai un numero inventato: Google dai dati
// già in scheda, Mapetite dalle recensioni della community, Tripadvisor solo dall'API ufficiale
// (con la chiave sul server); Michelin, TheFork e Tripadvisor senza chiave sono solo link di ricerca.

type Props = {
  venueId: string; // UUID (salvati) o Place ID (risultati): /api/places/community li accetta entrambi
  name: string;
  address: string | null;
  category: string | null;
  lat: number;
  lng: number;
  rating: number | null;
  userRatingCount: number | null;
  mapsUrl: string;
  hasVerdict: boolean;
  onMapetite?: () => void; // porta alla sezione Recensioni (community)
};

const ROW = "flex min-h-11 w-full items-center gap-3 py-1.5 text-left active:opacity-70";
const NAME = "w-[5.75rem] shrink-0 font-display text-sm font-semibold text-text";
const LINK_ROW = "flex min-h-10 w-full items-center gap-2 py-1 text-left text-sm font-display font-semibold text-brand active:opacity-70";

export default function ConfrontoFonti({ venueId, name, address, category, lat, lng, rating, userRatingCount, mapsUrl, hasVerdict, onMapetite }: Props) {
  const citta = cityFromAddress(address);
  const showTa = mostraTripadvisor();
  const tocco = (fonte: FonteConfronto, stato: string) => trackFeature("confronto_fonte", { contesto: fonte, stato });

  // Voti della community Mapetite (stessa lettura della sezione Recensioni).
  const [community, setCommunity] = useState<{ id: string; voti: number[] } | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/places/community?id=${encodeURIComponent(venueId)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((c: Community | null) => {
        if (!c) return;
        setCommunity({ id: venueId, voti: [...c.recensioni.map((r) => r.rating), ...(c.mia ? [c.mia.rating] : [])] });
      })
      .catch(() => { /* rete assente o scheda chiusa: niente voto Mapetite */ });
    return () => ctrl.abort();
  }, [venueId]);
  const media = community?.id === venueId ? mediaVoti(community.voti) : null;

  // Tripadvisor: numeri solo se il server ha la chiave e ha abbinato il locale con sicurezza.
  const taKey = `${name}|${lat}|${lng}`;
  const [ta, setTa] = useState<{ key: string; esito: TripadvisorEsito } | null>(null);
  useEffect(() => {
    if (!showTa) return;
    const ctrl = new AbortController();
    fetch(`/api/places/tripadvisor?${new URLSearchParams({ nome: name, lat: String(lat), lng: String(lng) })}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((e: TripadvisorEsito | null) => { if (e) setTa({ key: taKey, esito: e }); })
      .catch(() => { /* resta il link di ricerca */ });
    return () => ctrl.abort();
  }, [showTa, name, lat, lng, taKey]);
  const taDato = ta?.key === taKey && ta.esito.stato === "trovato" ? ta.esito.dato : null;

  const googleValue =
    rating != null
      ? `★ ${votoIt(rating)}${userRatingCount != null ? ` · ${userRatingCount.toLocaleString("it-IT")} recensioni` : ""}`
      : null;
  const showMapetite = media != null || hasVerdict;

  const links: { fonte: FonteConfronto; href: string; label: string }[] = [
    ...(showTa && !taDato ? [{ fonte: "tripadvisor" as const, href: tripadvisorSearchUrl(name, citta), label: "Cercalo su Tripadvisor" }] : []),
    ...(mostraMichelin(category) ? [{ fonte: "michelin" as const, href: michelinSearchUrl(name), label: "Cercalo nella Guida Michelin" }] : []),
    ...(mostraTheFork(category) ? [{ fonte: "thefork" as const, href: theforkSearchUrl(name, citta), label: "Cercalo su TheFork" }] : []),
  ];

  return (
    <section data-testid="confronto" aria-labelledby="confronto-titolo" className="mx-5 mt-4 rounded-card border border-border bg-surface px-4 pb-1.5 pt-3">
      <h3 id="confronto-titolo" className="text-[11px] font-display font-semibold uppercase tracking-wide text-text-muted">
        A confronto
      </h3>
      <div className="mt-1 flex flex-col divide-y divide-border">
        {showMapetite && (
          <button
            type="button"
            data-testid="confronto-mapetite"
            onClick={() => {
              tocco("mapetite", media ? "voti" : "verdetto");
              if (media && onMapetite) onMapetite();
              else document.querySelector("[data-testid=verdetto-box],[data-testid=verdetto-scheda]")?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
            className={ROW}
          >
            <span className={`${NAME} text-brand`}>Mapetite</span>
            <span className="min-w-0 flex-1 text-sm font-sans text-text">
              {media ? (
                <>
                  <span className="font-display font-semibold">★ {votoIt(media.media)}</span>
                  <span className="text-text-muted"> · {media.n === 1 ? "1 recensione" : `${media.n} recensioni`}</span>
                </>
              ) : (
                <span className="text-text-muted">Il verdetto è qui sopra</span>
              )}
            </span>
            <ChevronRight size={16} className="shrink-0 text-text-muted" aria-hidden />
          </button>
        )}

        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="confronto-google"
          onClick={() => tocco("google", googleValue ? "voto" : "link")}
          aria-label={googleValue ? `Google: ${googleValue.replace("★ ", "voto ")} (si apre Google Maps)` : "Apri su Google Maps"}
          className={ROW}
        >
          <span className={NAME}>Google</span>
          <span className="min-w-0 flex-1 text-sm font-sans text-text">
            {googleValue ? (
              <>
                <span className="font-display font-semibold"><span className="text-star">★</span> {votoIt(rating!)}</span>
                {userRatingCount != null && <span className="text-text-muted"> · {userRatingCount.toLocaleString("it-IT")} recensioni</span>}
              </>
            ) : (
              <span className="text-text-muted">Apri su Google Maps</span>
            )}
          </span>
          <ExternalLink size={15} className="shrink-0 text-text-muted" aria-hidden />
        </a>

        {taDato && (
          <a
            href={taDato.webUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="confronto-tripadvisor"
            onClick={() => tocco("tripadvisor", "voto")}
            className={ROW}
          >
            <span className={NAME}>Tripadvisor</span>
            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm font-sans text-text">
              {taDato.ratingImageUrl ? (
                // Bolle ufficiali del voto (regole di visualizzazione di Tripadvisor).
                // eslint-disable-next-line @next/next/no-img-element
                <img src={taDato.ratingImageUrl} alt={taDato.rating != null ? `${votoIt(taDato.rating)} su 5` : ""} className="h-3.5 w-auto" />
              ) : taDato.rating != null ? (
                <span className="font-display font-semibold">{votoIt(taDato.rating)}</span>
              ) : null}
              {taDato.numReviews != null && (
                <span className="whitespace-nowrap text-text-muted">{taDato.numReviews.toLocaleString("it-IT")} recensioni</span>
              )}
            </span>
            <ExternalLink size={15} className="shrink-0 text-text-muted" aria-hidden />
          </a>
        )}

        {links.length > 0 && (
          <div className="flex flex-col py-1">
            {links.map((l) => (
              <a
                key={l.fonte}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                data-testid={`confronto-link-${l.fonte}`}
                onClick={() => tocco(l.fonte, "ricerca")}
                aria-label={`${l.label} (si apre in una nuova scheda)`}
                className={LINK_ROW}
              >
                <span className="min-w-0 flex-1">{l.label}</span>
                <ExternalLink size={15} className="shrink-0" aria-hidden />
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
