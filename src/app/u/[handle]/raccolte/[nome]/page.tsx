import type { Metadata } from "next";
import Link from "next/link";
import Avatar from "@/components/avatar";
import CondividiLink from "@/components/condividi-link";
import InvitoMapetite from "@/components/invito-mapetite";
import MappaPersonaLazy from "@/components/mappa-persona-lazy";
import SocialInArrivo from "@/components/social-in-arrivo";
import { PostoRiga } from "@/components/posto-persona";
import { getCategoryEmoji } from "@/lib/emoji";
import { loadProfilePage } from "@/lib/social";
import { personName, profilePath } from "@/lib/handle";
import { mapSpots } from "@/lib/social-view";
import { isStateTag } from "@/lib/tags";
import { collectionColor, collectionFromParam, inCollection, placesLabel, publicCollectionPath } from "@/lib/raccolte";

// Raccolta condivisa (piano 4.1), in sola lettura: si apre anche senza account, solo se il
// profilo della persona è pubblico. Solo dati pubblici (salvati_pubblici): mai la nota privata.

type Props = { params: Promise<{ handle: string; nome: string }> };

async function load(params: Props["params"]) {
  const { handle, nome } = await params;
  const name = collectionFromParam(nome);
  const data = await loadProfilePage(handle);
  const places = data.stato === "ok" && name && !isStateTag(name) ? inCollection(data.places, name) : [];
  return { name, data, places };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name, data, places } = await load(params);
  if (data.stato !== "ok" || !name || places.length === 0) return { title: "Raccolta · Mapetite" };
  const who = personName(data.profile);
  const description = `${placesLabel(places.length)} scelti da ${who}: ${places.slice(0, 3).map((p) => p.name).join(", ")}${places.length > 3 ? "…" : ""}`;
  return {
    title: `${name} · ${who} · Mapetite`,
    description,
    openGraph: { title: `“${name}” di ${who}`, description, locale: "it_IT", type: "website", siteName: "Mapetite" },
  };
}

export default async function RaccoltaPubblicaPage({ params }: Props) {
  const { name, data, places } = await load(params);

  if (data.stato === "in-arrivo") {
    return (
      <main className="mx-auto min-h-dvh max-w-md bg-bg px-4 pb-10 pt-6" data-testid="raccolta-pubblica-in-arrivo">
        <SocialInArrivo titolo="Le raccolte condivise arrivano presto" />
      </main>
    );
  }
  if (data.stato !== "ok" || !name || places.length === 0) {
    return (
      <main className="mx-auto min-h-dvh max-w-md bg-bg pb-10" data-testid="raccolta-pubblica-non-trovata">
        <section className="mx-4 mt-10 rounded-card border border-border bg-surface p-6 text-center">
          <p aria-hidden className="text-4xl">🔒</p>
          <p className="mt-2 font-display text-lg font-semibold text-brand">Raccolta non disponibile</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-text-muted">
            Questa raccolta non esiste più oppure il profilo è privato.
          </p>
        </section>
        <InvitoMapetite returnPath="/amici" />
      </main>
    );
  }

  const { profile, viewer } = data;
  const who = personName(profile);
  const path = publicCollectionPath(profile.handle, name);
  const spots = mapSpots(places);

  return (
    <main className="mx-auto min-h-dvh max-w-md bg-bg pb-10" data-testid="raccolta-pubblica">
      <header className="px-4 pt-4">
        <Link href={profilePath(profile.handle)} className="flex min-h-11 items-center gap-2.5">
          <Avatar person={profile} size={32} />
          <span className="min-w-0 truncate text-sm font-display font-semibold text-text">{who} <span className="font-normal text-text-muted">@{profile.handle}</span></span>
        </Link>
        <div className="relative mt-2 overflow-hidden rounded-card px-4 pb-4 pt-5 text-white shadow-card" style={{ backgroundColor: collectionColor(name) }}>
          <span aria-hidden className="pointer-events-none absolute -bottom-3 -right-1 flex gap-1 text-[56px] leading-none opacity-30">
            {places.slice(0, 3).map((p) => <span key={p.place_id}>{getCategoryEmoji(p.category, p.name)}</span>)}
          </span>
          <p className="relative text-[11px] font-display font-semibold uppercase tracking-wider text-white/70">Raccolta di {who}</p>
          <h1 className="relative mt-1 font-title text-[28px] font-semibold leading-tight [overflow-wrap:anywhere]">{name}</h1>
          <p className="relative mt-1 text-sm text-white/80">{placesLabel(places.length)}</p>
        </div>
        <div className="mt-3">
          <CondividiLink path={path} cosa="raccolta" title={`“${name}” di ${who} · Mapetite`} text={`La raccolta “${name}” di ${who} su Mapetite`} testId="condividi-raccolta-pubblica" />
        </div>
      </header>

      {spots.length > 0 && (
        <section className="mt-5 px-4" aria-label="Mappa della raccolta">
          <div className="h-44">
            <MappaPersonaLazy spots={spots} className="h-full w-full" />
          </div>
        </section>
      )}

      <section className="mt-5 px-4" aria-label="Locali della raccolta">
        <ul className="space-y-2">
          {places.map((s) => (
            <li key={s.place_id}><PostoRiga spot={s} /></li>
          ))}
        </ul>
      </section>

      {!viewer && <InvitoMapetite returnPath={path} />}
    </main>
  );
}
