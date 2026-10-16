import type { Metadata } from "next";
import Link from "next/link";
import Avatar from "@/components/avatar";
import SocialInArrivo from "@/components/social-in-arrivo";
import { PostoCard } from "@/components/posto-persona";
import { loadCreatorLists, loadFeed, viewerId } from "@/lib/social";
import { personName, profilePath } from "@/lib/handle";
import { groupActivity, isVisited, whenLabel } from "@/lib/social-view";
import CercaPersone from "./cerca-persone";
import CreatorListe from "./creator-liste";

// Amici (piano 5.2): chi segui, cosa ha salvato o dove è stato, e la ricerca delle persone.
// Stile Places "People": riga di avatar in alto, poi attività con le card dei locali.

export const metadata: Metadata = { title: "Amici · Mapetite" };

export default async function AmiciPage() {
  const viewer = await viewerId();

  if (!viewer) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center" data-testid="amici-accedi">
        <p aria-hidden className="text-4xl">👥</p>
        <p className="font-display text-xl font-semibold text-brand">I posti dei tuoi amici</p>
        <p className="max-w-xs text-sm text-text-muted">Accedi per seguire gli amici e vedere dove sono stati e dove vogliono andare.</p>
        <div className="flex gap-2">
          <a href="/login?next=%2Famici" className="inline-flex min-h-11 items-center rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white">Accedi</a>
          <a href="/signup?next=%2Famici" className="inline-flex min-h-11 items-center rounded-pill border border-border px-5 text-sm font-display font-semibold text-brand">Crea un account</a>
        </div>
      </div>
    );
  }

  const [feed, creators] = await Promise.all([loadFeed(viewer), loadCreatorLists(viewer)]);
  const seguo = feed.stato === "in-arrivo" ? [] : feed.seguiti.map((p) => p.id);
  const hasCreators = creators.some((c) => c.places.length > 0);
  const creatorSection = (
    <div id="creator" className="scroll-mt-4">
      <CreatorListe creators={creators} viewer={viewer} seguo={seguo} />
    </div>
  );
  const chip = "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-pill border border-border bg-surface px-4 text-sm font-display font-semibold text-brand active:scale-95";

  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-6" data-testid="amici">
      <h1 className="font-title text-3xl font-semibold text-brand">Amici</h1>
      <p className="mt-1 text-sm font-sans text-text-muted">I posti di chi ha gusti come i tuoi, non quelli di tutti.</p>

      {feed.stato === "in-arrivo" ? (
        <div className="mt-6"><SocialInArrivo /></div>
      ) : (
        <>
          {/* Trova persone: la ricerca per nome, come "Search by name" di Places. */}
          <div className="mt-4" id="trova">
            <CercaPersone viewerId={viewer} seguo={seguo} />
          </div>

          {/* Ingressi compatti: le altre cose della pagina, a un tocco. */}
          <nav aria-label="Scorciatoie" data-testid="amici-ingressi" className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
            <Link href="/gruppi" data-testid="amici-gruppi" className={chip}>
              <span aria-hidden>🍽️</span> Liste di gruppo
            </Link>
            {hasCreators && (
              <a href="#creator" data-testid="amici-vai-creator" className={chip}>
                <span aria-hidden>⭐</span> Creator da seguire
              </a>
            )}
            {!feed.mio?.is_public && (
              <Link href="/profilo#profilo-pubblico" data-testid="amici-rendi-pubblico" className={chip}>
                <span aria-hidden>🙋</span> Fatti trovare
              </Link>
            )}
          </nav>

          {/* Senza nessuno da seguire, i creator sono il primo passo: vengono subito. */}
          {feed.seguiti.length === 0 && creatorSection}

          {feed.seguiti.length > 0 && (
            <section className="mt-6" aria-labelledby="seguiti-titolo">
              <h2 id="seguiti-titolo" className="text-xs font-display font-semibold uppercase tracking-wider text-text-muted">Chi segui · {feed.seguiti.length}</h2>
              <ul data-testid="seguiti" className="-mx-4 mt-2 flex gap-3 overflow-x-auto px-4 pb-1">
                {feed.seguiti.map((p) => (
                  <li key={p.id} className="shrink-0">
                    <Link href={profilePath(p.handle)} className="flex w-16 flex-col items-center gap-1 text-center">
                      <Avatar person={p} size={52} />
                      <span className="w-full truncate text-[11px] font-display text-text">{personName(p)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-6" aria-labelledby="attivita-titolo">
            <h2 id="attivita-titolo" className="text-xs font-display font-semibold uppercase tracking-wider text-text-muted">Attività</h2>
            {feed.seguiti.length === 0 ? (
              <div data-testid="amici-vuoto" className="mt-2 rounded-card border border-border bg-surface p-5 text-center">
                <p className="font-display text-base font-semibold text-brand">Non segui ancora nessuno</p>
                <p className="mx-auto mt-1 max-w-xs text-sm font-sans text-text-muted">
                  Cerca un amico per nome in alto, oppure apri il link del suo profilo e tocca &quot;Segui&quot;.
                </p>
              </div>
            ) : feed.attivita.length === 0 ? (
              <p data-testid="amici-nessuna-attivita" className="mt-2 rounded-card border border-border bg-surface p-5 text-center text-sm font-sans text-text-muted">
                Chi segui non ha ancora salvato posti. Torna più tardi.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-border">
                {groupActivity(feed.attivita).map((group) => {
                  const first = group[0];
                  const name = personName(first);
                  const others = group.length - 1;
                  return (
                    <li key={`${first.user_id}-${first.created_at}`} data-testid="attivita" className="py-4">
                      <div className="flex items-start gap-3">
                        <Link href={profilePath(first.handle)} aria-label={`Profilo di ${name}`}>
                          <Avatar person={first} size={40} />
                        </Link>
                        <p className="min-w-0 flex-1 text-[15px] font-sans leading-snug text-text-muted">
                          <Link href={profilePath(first.handle)} className="font-display font-semibold text-text">{name}</Link>{" "}
                          {isVisited(first) ? "ha provato" : "ha salvato"}{" "}
                          <span className="font-display font-semibold text-text">{first.name}</span>
                          {others > 0 && <> e {others === 1 ? "un altro posto" : `altri ${others} posti`}</>}
                          <span className="block text-xs text-text-muted">{whenLabel(first.created_at)}</span>
                        </p>
                      </div>
                      <div className="-mx-4 mt-3 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1">
                        {group.slice(0, 10).map((s) => (
                          <PostoCard key={s.place_id} spot={s} />
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {feed.seguiti.length > 0 && creatorSection}
        </>
      )}
    </div>
  );
}
