import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import Avatar from "@/components/avatar";
import AmiciIntanto from "./amici-intanto";
import { loadMySaved } from "@/lib/raccolte-server";
import { PostoCard } from "@/components/posto-persona";
import { loadCreatorLists, loadFeed, loadMyGems, loadScopritori, loadVerdetti, viewerId } from "@/lib/social";
import ScopritoriAmici from "./scopritori-amici";
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
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center gap-4 bg-[#f8f6f2] px-6 text-center" data-testid="amici-accedi">
        {/* Revisore 1/11 (terzo giro): icona a tratto teal al posto dell'emoji blu. */}
        <span aria-hidden data-testid="amici-icona" className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-brand"><Users size={30} strokeWidth={1.6} /></span>
        <p className="font-title text-2xl text-text">I posti dei tuoi amici</p>
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
  // Scopritori (5.6): null senza la migrazione 20261016_scopritori → la sezione non compare.
  const [scopritori, mieGemme, verdetti] = seguo.length > 0 && feed.stato !== "in-arrivo"
    ? await Promise.all([loadScopritori(seguo), loadMyGems(viewer), loadVerdetti(feed.attivita.map((s) => s.place_id))])
    : [null, null, {} as Record<string, string>];
  const hasCreators = creators.some((c) => c.places.length > 0);
  const creatorSection = (
    <div id="creator" className="scroll-mt-4">
      <CreatorListe creators={creators} viewer={viewer} seguo={seguo} />
    </div>
  );
  const chip = "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-pill border border-[#e3ddd2] bg-white px-4 text-sm font-display font-semibold text-brand active:scale-95";

  return (
    // Fondo carta come Salvati (revisore 1/11, terzo giro).
    <div className="min-h-[calc(100dvh-4rem)] bg-[#f8f6f2] md:min-h-[calc(100dvh-3.5rem)]">
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-6" data-testid="amici">
      <h1 className="font-title text-3xl font-semibold text-text">Amici</h1>
      <p className="mt-1 text-sm font-sans text-text-muted">I posti di chi ha gusti come i tuoi, non quelli di tutti.</p>

      {feed.stato === "in-arrivo" ? (
        // Revisore 2/11: niente più "Gli amici arrivano presto" a tutta pagina: le cose vere che si fanno già.
        <AmiciIntanto userId={viewer} saved={await loadMySaved(viewer).catch(() => [])} />
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
            {/* Gli amici che non sono ancora su Mapetite: il link personale (sta nel profilo, si apre da solo). */}
            <Link href="/profilo#invita" data-testid="amici-invita" className={chip}>
              <span aria-hidden>💌</span> Invita un amico
            </Link>
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

          {scopritori && <ScopritoriAmici amici={scopritori} mie={mieGemme} viewer={viewer} />}

          <section className="mt-6" aria-labelledby="attivita-titolo">
            <h2 id="attivita-titolo" className="text-xs font-display font-semibold uppercase tracking-wider text-text-muted">Attività</h2>
            {feed.seguiti.length === 0 ? (
              <div data-testid="amici-vuoto" className="mt-2 rounded-card border border-[#e8e2d8] bg-white p-5 text-center">
                <p className="font-display text-base font-semibold text-brand">Non segui ancora nessuno</p>
                <p className="mx-auto mt-1 max-w-xs text-sm font-sans text-text-muted">
                  Cerca un amico per nome in alto, oppure apri il link del suo profilo e tocca &quot;Segui&quot;.
                </p>
              </div>
            ) : feed.attivita.length === 0 ? (
              <p data-testid="amici-nessuna-attivita" className="mt-2 rounded-card border border-[#e8e2d8] bg-white p-5 text-center text-sm font-sans text-text-muted">
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
                          <PostoCard key={s.place_id} spot={s} verdict={verdetti[s.place_id] ?? null} />
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
    </div>
  );
}
