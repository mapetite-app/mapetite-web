import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Maximize2 } from "lucide-react";
import Avatar from "@/components/avatar";
import SeguiButton from "@/components/segui-button";
import CondividiLink from "@/components/condividi-link";
import InvitoMapetite from "@/components/invito-mapetite";
import MappaPersonaLazy from "@/components/mappa-persona-lazy";
import SocialInArrivo from "@/components/social-in-arrivo";
import { PostoRiga } from "@/components/posto-persona";
import { loadProfilePage } from "@/lib/social";
import { personName, profileMapPath, profilePath } from "@/lib/handle";
import { isVisited, mapSpots, plural, publicCollections } from "@/lib/social-view";
import { collectionColor, publicCollectionPath } from "@/lib/raccolte";
import { loadPublicRanks } from "@/lib/classifica-server";
import { topByCity } from "@/lib/classifica";
import { cityFromAddress } from "@/lib/city";
import ClassificaLista from "@/components/classifica-lista";
import CreatorBadge from "@/components/creator-badge";

// Profilo pubblico di una persona (piano 5.1): si apre anche senza account (link condiviso).
// Solo se la persona ha scelto di renderlo pubblico; mai note private, mai gusti dichiarati.

type Props = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const data = await loadProfilePage(handle);
  if (data.stato !== "ok") return { title: "Profilo · Mapetite" };
  const name = personName(data.profile);
  const description = `${name} su Mapetite: ${plural(data.profile.visitati, "posto visitato", "posti visitati")}, ${plural(data.profile.da_provare, "da provare", "da provare")}${data.profile.city ? ` a ${data.profile.city}` : ""}.`;
  return {
    title: `${name} (@${data.profile.handle}) · Mapetite`,
    description,
    openGraph: { title: `${name} su Mapetite`, description, locale: "it_IT", type: "profile", siteName: "Mapetite" },
  };
}

function TopBar() {
  return (
    <div className="flex items-center justify-between px-4 pt-4">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 rounded-pill bg-brand px-3 py-1.5 font-display text-xs font-semibold text-white"
      >
        <span aria-hidden className="h-2 w-2 rounded-full bg-accent" />
        Mapetite
      </Link>
    </div>
  );
}

export default async function ProfiloPubblicoPage({ params }: Props) {
  const { handle } = await params;
  const data = await loadProfilePage(handle);

  if (data.stato === "in-arrivo") {
    return (
      <main className="mx-auto min-h-dvh max-w-md bg-bg pb-10" data-testid="profilo-pubblico-in-arrivo">
        <TopBar />
        <div className="px-4 pt-6">
          <SocialInArrivo titolo="I profili pubblici arrivano presto" />
        </div>
      </main>
    );
  }

  if (data.stato === "non-trovato") {
    return (
      <main className="mx-auto min-h-dvh max-w-md bg-bg pb-10" data-testid="profilo-non-trovato">
        <TopBar />
        <section className="mx-4 mt-6 rounded-card border border-border bg-surface p-6 text-center">
          <p aria-hidden className="text-4xl">🔒</p>
          <p className="mt-2 font-display text-lg font-semibold text-brand">Profilo non disponibile</p>
          <p className="mx-auto mt-1 max-w-xs text-sm font-sans text-text-muted">
            Questo profilo non esiste oppure è privato. Chiedi a chi te l&apos;ha mandato di renderlo pubblico dal suo profilo.
          </p>
        </section>
        <InvitoMapetite returnPath="/amici" />
      </main>
    );
  }

  const { profile, places, iFollow, isMe, viewer, creator } = data;
  const name = personName(profile);
  const path = profilePath(profile.handle);
  const spots = mapSpots(places);
  const collections = publicCollections(places);
  const visited = places.filter(isVisited);
  const want = places.filter((p) => !isVisited(p)); // salvato e non ancora visitato = da provare
  // Top per città (piano 4.3): solo i visitati messi in classifica; nascosta senza la migrazione.
  const ranks = await loadPublicRanks(profile.id);
  const tops = ranks
    ? topByCity(visited.flatMap((p) => (ranks.has(p.place_id) ? [{ ...p, city: cityFromAddress(p.address), score: ranks.get(p.place_id)! }] : [])), 5).slice(0, 3)
    : [];
  const stats = [
    { label: "Visitati", value: profile.visitati, id: "visitati" },
    { label: "Da provare", value: profile.da_provare, id: "da-provare" },
    { label: "Seguaci", value: profile.seguaci, id: "seguaci" },
    { label: "Seguiti", value: profile.seguiti, id: "seguiti" },
  ];

  return (
    <main className="mx-auto min-h-dvh max-w-md bg-bg pb-10" data-testid="profilo-pubblico">
      <TopBar />

      <header className="px-4 pt-5">
        <div className="flex items-center gap-4">
          <Avatar person={profile} size={72} />
          <div className="min-w-0">
            <h1 className="truncate font-title text-2xl font-semibold leading-tight text-text">{name}</h1>
            <p className="truncate text-sm font-sans text-text-muted">@{profile.handle}</p>
            {creator && (
              <p className="mt-1">
                <CreatorBadge tipo={creator.tipo} />
              </p>
            )}
            {profile.city && (
              <p className="mt-0.5 flex items-center gap-1 text-sm font-sans text-text-muted">
                <MapPin size={14} aria-hidden className="shrink-0 text-brand" />
                <span className="truncate">{profile.city}</span>
              </p>
            )}
          </div>
        </div>
        {profile.bio && <p data-testid="profilo-bio" className="mt-3 text-[15px] font-sans leading-relaxed text-text">{profile.bio}</p>}

        <dl data-testid="profilo-numeri" className="mt-4 grid grid-cols-4 gap-2">
          {stats.map((s) => (
            <div key={s.id} data-testid={`numero-${s.id}`} className="flex flex-col items-center rounded-card border border-border bg-surface px-1 py-2.5">
              <dd className="font-title text-xl font-semibold leading-none text-brand">{s.value}</dd>
              <dt className="mt-1 text-[11px] font-display leading-tight text-text-muted">{s.label}</dt>
            </div>
          ))}
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
          {isMe ? (
            <Link href="/profilo#profilo-pubblico" className="inline-flex min-h-11 items-center rounded-pill border border-border bg-white px-5 text-sm font-display font-semibold text-brand">
              Modifica profilo
            </Link>
          ) : (
            <SeguiButton viewerId={viewer} targetId={profile.id} targetName={name} initialFollowing={iFollow} returnPath={path} />
          )}
          <CondividiLink
            path={path}
            cosa="profilo"
            title={`${name} su Mapetite`}
            text={isMe ? "Ecco i miei posti preferiti su Mapetite" : `I posti di ${name} su Mapetite`}
            testId="condividi-profilo"
          />
        </div>
      </header>

      {collections.length > 0 && (
        <section className="mt-6 px-4" aria-labelledby="raccolte-titolo">
          <h2 id="raccolte-titolo" className="text-xs font-display font-semibold uppercase tracking-wider text-text-muted">Raccolte</h2>
          <div data-testid="profilo-raccolte" className="mt-2 flex flex-wrap gap-1.5">
            {collections.map((c) => (
              <Link
                key={c.name}
                href={publicCollectionPath(profile.handle, c.name)}
                data-testid="raccolta-pubblica-link"
                className="inline-flex min-h-9 max-w-full items-center gap-1 rounded-pill bg-accent-light px-3 py-1 text-[13px] font-display font-medium text-accent active:scale-95"
              >
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: collectionColor(c.name) }} />
                <span className="truncate">{c.name}</span>
                <span className="text-accent/70">· {c.count}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {tops.length > 0 && (
        <section className="mt-6 px-4" aria-labelledby="top-titolo" data-testid="profilo-top">
          <h2 id="top-titolo" className="mb-2 font-title text-xl font-semibold text-brand">I preferiti di {name}</h2>
          <div className="space-y-4">
            {tops.map(([city, list]) => (
              <div key={city}>
                <p className="mb-1.5 text-xs font-display font-semibold uppercase tracking-wider text-text-muted">🏆 Top {city}</p>
                <ClassificaLista testId="top-voce" voci={list.map((p) => ({ id: p.place_id, name: p.name, category: p.category, href: `/locali/${p.place_id}` }))} />
              </div>
            ))}
          </div>
        </section>
      )}

      {spots.length > 0 && (
        <section className="mt-6 px-4" aria-labelledby="mappa-titolo">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="mappa-titolo" className="text-xs font-display font-semibold uppercase tracking-wider text-text-muted">La mappa di {name}</h2>
            <Link href={profileMapPath(profile.handle)} data-testid="apri-mappa-persona" className="inline-flex min-h-10 items-center gap-1 text-sm font-display font-semibold text-accent">
              <Maximize2 size={14} aria-hidden /> Apri
            </Link>
          </div>
          <div className="h-56">
            <MappaPersonaLazy spots={spots} className="h-full w-full" />
          </div>
          <p className="mt-2 flex items-center gap-3 text-xs font-sans text-text-muted">
            <span className="inline-flex items-center gap-1"><span aria-hidden className="h-2.5 w-2.5 rounded-full bg-accent" /> Visitati</span>
            <span className="inline-flex items-center gap-1"><span aria-hidden className="h-2.5 w-2.5 rounded-full bg-brand" /> Da provare</span>
          </p>
        </section>
      )}

      {places.length === 0 ? (
        <p data-testid="profilo-vuoto" className="mx-4 mt-6 rounded-card border border-border bg-surface p-5 text-center text-sm font-sans text-text-muted">
          {name} non ha ancora posti pubblici sulla mappa.
        </p>
      ) : (
        <>
          {visited.length > 0 && (
            <section className="mt-6 px-4" aria-labelledby="visitati-titolo">
              <h2 id="visitati-titolo" className="mb-2 font-title text-xl font-semibold text-brand">Già provati</h2>
              <ul className="space-y-2">
                {visited.slice(0, 30).map((s) => (
                  <li key={s.place_id}><PostoRiga spot={s} /></li>
                ))}
              </ul>
            </section>
          )}
          {want.length > 0 && (
            <section className="mt-6 px-4" aria-labelledby="voglio-titolo">
              <h2 id="voglio-titolo" className="mb-2 font-title text-xl font-semibold text-brand">Da provare</h2>
              <ul className="space-y-2">
                {want.slice(0, 30).map((s) => (
                  <li key={s.place_id}><PostoRiga spot={s} /></li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {!viewer && <InvitoMapetite returnPath={path} />}
    </main>
  );
}
