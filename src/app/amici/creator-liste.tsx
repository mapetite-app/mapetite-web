import Link from "next/link";
import Avatar from "@/components/avatar";
import CreatorBadge from "@/components/creator-badge";
import SeguiButton from "@/components/segui-button";
import TracciaFunzione from "@/components/traccia-funzione";
import type { CreatorList } from "@/lib/social";
import { personName, profilePath } from "@/lib/handle";
import { collectionColor, publicCollectionPath, summarizeCollections } from "@/lib/raccolte";
import { plural } from "@/lib/social-view";

// "Liste dei creator da seguire" (piano 5.6b): food blogger, critici e guide scelti da Mapetite,
// con le loro raccolte pubbliche. Nascosta se non c'è nessun creator (o senza la migrazione).
// Ordine: chi non segui ancora prima, poi chi ha più raccolte. Nessun numero di seguaci come
// criterio: non vogliamo premiare il più popolare (VISIONE.md).
export default function CreatorListe({ creators, viewer, seguo }: { creators: CreatorList[]; viewer: string; seguo: string[] }) {
  const cards = creators
    .map((c) => ({ ...c, raccolte: summarizeCollections(c.places, 3) }))
    .filter((c) => c.raccolte.length > 0 || c.places.length > 0)
    .sort((a, b) => Number(seguo.includes(a.profile.id)) - Number(seguo.includes(b.profile.id)) || b.raccolte.length - a.raccolte.length);
  if (cards.length === 0) return null;
  return (
    <section className="mt-6" aria-labelledby="creator-titolo" data-testid="creator-liste">
      <TracciaFunzione nome="creator_liste" contesto="amici" />
      <h2 id="creator-titolo" className="font-title text-xl font-semibold text-brand">Liste dei creator da seguire</h2>
      <p className="mt-0.5 text-sm font-sans text-text-muted">Food blogger e critici scelti da Mapetite, con i posti che consigliano davvero.</p>
      <ul className="-mx-4 mt-3 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2">
        {cards.map(({ profile, tipo, places, raccolte }) => {
          const name = personName(profile);
          const path = profilePath(profile.handle);
          return (
            <li key={profile.id} data-testid="creator-card" className="w-[78vw] max-w-[300px] shrink-0 snap-start rounded-card border border-border bg-white p-4 shadow-card">
              <div className="flex items-center gap-3">
                <Link href={path} aria-label={`Profilo di ${name}`}>
                  <Avatar person={profile} size={48} />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={path} className="block truncate font-display text-base font-semibold text-text">{name}</Link>
                  <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                    <CreatorBadge tipo={tipo} size="sm" />
                    {tipo && <span className="truncate text-xs font-sans text-text-muted">{tipo}</span>}
                  </div>
                </div>
              </div>
              {raccolte.length > 0 ? (
                <ul className="mt-3 space-y-1.5">
                  {raccolte.slice(0, 3).map((r) => (
                    <li key={r.name}>
                      <Link
                        href={publicCollectionPath(profile.handle, r.name)}
                        data-testid="creator-raccolta"
                        className="flex min-h-11 items-center gap-2 rounded-card bg-surface px-3 py-2 active:scale-[0.99]"
                      >
                        <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: collectionColor(r.name) }} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-display text-sm font-semibold text-text">{r.name}</span>
                          <span className="block truncate text-xs font-sans text-text-muted">{r.preview.map((p) => p.name).join(" · ")}</span>
                        </span>
                        <span className="shrink-0 text-xs font-sans text-text-muted">{r.count}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <Link href={path} className="mt-3 flex min-h-11 items-center rounded-card bg-surface px-3 text-sm font-sans text-text-muted">
                  {plural(places.length, "posto sulla sua mappa", "posti sulla sua mappa")} →
                </Link>
              )}
              <div className="mt-3">
                <SeguiButton viewerId={viewer} targetId={profile.id} targetName={name} initialFollowing={seguo.includes(profile.id)} returnPath="/amici" compact />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
