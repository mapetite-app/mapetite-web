import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Avatar from "@/components/avatar";
import CondividiLink from "@/components/condividi-link";
import InvitoMapetite from "@/components/invito-mapetite";
import MappaPersonaLazy from "@/components/mappa-persona-lazy";
import SocialInArrivo from "@/components/social-in-arrivo";
import { PostoRiga } from "@/components/posto-persona";
import { loadProfilePage } from "@/lib/social";
import { personName, profileMapPath, profilePath } from "@/lib/handle";
import { isVisited, mapSpots, plural } from "@/lib/social-view";

// "La mappa di Giulia" (piano 5.3/5.4): i posti di una persona su una mappa grande, con link
// che si apre anche senza account e l'invito a creare la propria mappa in fondo.

type Props = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const data = await loadProfilePage(handle);
  if (data.stato !== "ok") return { title: "Mappa · Mapetite" };
  const name = personName(data.profile);
  const description = `${plural(data.places.length, "posto", "posti")} scelti da ${name}: dove è stato e dove vuole andare.`;
  return {
    title: `La mappa di ${name} · Mapetite`,
    description,
    openGraph: { title: `La mappa di ${name}`, description, locale: "it_IT", type: "website", siteName: "Mapetite" },
  };
}

export default async function MappaPersonaPage({ params }: Props) {
  const { handle } = await params;
  const data = await loadProfilePage(handle);

  if (data.stato !== "ok") {
    return (
      <main className="mx-auto min-h-dvh max-w-md bg-bg px-4 pb-10 pt-6" data-testid="mappa-persona-non-disponibile">
        {data.stato === "in-arrivo" ? (
          <SocialInArrivo titolo="Le mappe degli amici arrivano presto" />
        ) : (
          <section className="rounded-card border border-border bg-surface p-6 text-center">
            <p aria-hidden className="text-4xl">🔒</p>
            <p className="mt-2 font-display text-lg font-semibold text-brand">Mappa non disponibile</p>
            <p className="mx-auto mt-1 max-w-xs text-sm font-sans text-text-muted">Questo profilo non esiste oppure è privato.</p>
          </section>
        )}
      </main>
    );
  }

  const { profile, places, viewer } = data;
  const name = personName(profile);
  const spots = mapSpots(places);
  const visitedCount = places.filter(isVisited).length;

  return (
    <main className="mx-auto min-h-dvh max-w-md bg-bg pb-10" data-testid="mappa-persona-pagina">
      <div className="flex items-center gap-3 px-4 pt-4">
        <Link href={profilePath(profile.handle)} aria-label={`Profilo di ${name}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-white text-brand">
          <ArrowLeft size={18} aria-hidden />
        </Link>
        <Link href={profilePath(profile.handle)} className="flex min-w-0 flex-1 items-center gap-2.5">
          <Avatar person={profile} size={40} />
          <span className="min-w-0">
            <span className="block truncate font-title text-lg font-semibold leading-tight text-text">La mappa di {name}</span>
            <span className="block truncate text-xs font-sans text-text-muted">
              {plural(visitedCount, "visitato", "visitati")} · {plural(places.length - visitedCount, "da provare", "da provare")}
            </span>
          </span>
        </Link>
      </div>

      <div className="mt-4 px-4">
        {spots.length > 0 ? (
          <div className="h-[55dvh] min-h-[320px]">
            <MappaPersonaLazy spots={spots} className="h-full w-full" />
          </div>
        ) : (
          <p data-testid="profilo-vuoto" className="rounded-card border border-border bg-surface p-5 text-center text-sm font-sans text-text-muted">
            {name} non ha ancora posti pubblici sulla mappa.
          </p>
        )}
      </div>

      <div className="mt-3 flex justify-end px-4">
        <CondividiLink
          path={profileMapPath(profile.handle)}
          cosa="mappa"
          title={`La mappa di ${name} su Mapetite`}
          text={`I posti di ${name} su Mapetite`}
          label="Condividi la mappa"
          testId="condividi-mappa"
        />
      </div>

      {places.length > 0 && (
        <ul className="mt-4 space-y-2 px-4">
          {places.slice(0, 60).map((s) => (
            <li key={s.place_id}><PostoRiga spot={s} /></li>
          ))}
        </ul>
      )}

      {!viewer && <InvitoMapetite returnPath={profileMapPath(profile.handle)} />}
    </main>
  );
}
