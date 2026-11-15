import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import Avatar from "@/components/avatar";
import AmiciIntanto from "./amici-intanto";
import { loadMySaved } from "@/lib/raccolte-server";
import { PostoCard } from "@/components/posto-persona";
import { loadAmici, loadCreatorLists, loadFeed, loadMyGems, loadMySocial, loadScopritori, loadVerdetti, mioInvito, viewerId } from "@/lib/social";
import ScopritoriAmici from "./scopritori-amici";
import { personName, profilePath } from "@/lib/handle";
import { groupActivity, isVisited, whenLabel } from "@/lib/social-view";
import CercaPersone from "./cerca-persone";
import AmicoRiga from "./amico";
import InvitoSospeso from "./invito-sospeso";
import SenzaInvitoSospeso from "./senza-invito-sospeso";
import CreatorListe from "./creator-liste";
import InvitaAmico from "@/components/invita-amico";

// Amici (piano 5.2): chi segui, cosa ha salvato o dove è stato, e la ricerca delle persone.
// Stile Places "People": riga di avatar in alto, poi attività con le card dei locali.

export const metadata: Metadata = { title: "Amici · Mapetite" };

export default async function AmiciPage() {
  const viewer = await viewerId();

  if (!viewer) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center gap-4 bg-[#f6f7f7] px-6 text-center" data-testid="amici-accedi">
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
  // Amici (ci si segue a vicenda, 14/11): tutti con il foglio "Togli dagli amici"; quelli con il profilo privato
  // si vedono per nome, mai i posti. Chi segui senza essere amici resta un link al suo profilo.
  const amici = feed.stato === "in-arrivo" ? [] : await loadAmici();
  const amiciIds = new Set(amici.map((a) => a.id));
  const soloSeguiti = feed.stato === "in-arrivo" ? [] : feed.seguiti.filter((p) => !amiciIds.has(p.id));
  // Senza nome non si accetta un invito (lo vedrà l'amico) né si ha il link: serve a "Diventa amico" e a InvitaAmico.
  const mioSocial = feed.stato === "in-arrivo" ? await loadMySocial(viewer) : feed.mio;
  const senzaNome = !!mioSocial && !("stato" in mioSocial) && !mioSocial.display_name?.trim();
  // Scopritori (5.6): null senza la migrazione 20261016_scopritori → la sezione non compare.
  const [scopritori, mieGemme, verdetti] = seguo.length > 0 && feed.stato !== "in-arrivo"
    ? await Promise.all([loadScopritori(seguo), loadMyGems(viewer), loadVerdetti(feed.attivita.map((s) => s.place_id))])
    : [null, null, {} as Record<string, string>];
  const hasCreators = creators.some((c) => c.places.length > 0);
  // Nessun amico e nessuno seguito (revisore 14/11, quarto giro): lo stato vuoto è l'invito, non una frase.
  const vuota = feed.stato !== "in-arrivo" && feed.seguiti.length === 0 && amici.length === 0;
  const codiceInvito = vuota ? await mioInvito() : null;
  const privato = feed.stato !== "in-arrivo" && !feed.mio?.is_public;
  const creatorSection = (
    <div id="creator" className="scroll-mt-4">
      <CreatorListe creators={creators} viewer={viewer} seguo={seguo} />
    </div>
  );
  const chip = "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-pill border border-[#e1e5e5] bg-white px-4 text-sm font-sans font-medium text-brand active:scale-95";

  return (
    // Fondo carta come Salvati (revisore 1/11, terzo giro).
    <div className="min-h-[calc(100dvh-4rem)] bg-[#f6f7f7] md:min-h-[calc(100dvh-3.5rem)]">
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-6" data-testid="amici">
      <h1 className="font-title text-3xl font-semibold text-text">Amici</h1>
      {/* Revisori 15/11: il sottotitolo dice quello che la pagina fa davvero (prima prometteva "chi ha gusti come i tuoi"). */}
      <p data-testid="amici-sottotitolo" className="mt-1 text-sm font-sans text-text-muted">Dove sono stati e dove vogliono andare i tuoi amici.</p>
      <InvitoSospeso senzaNome={senzaNome} />

      {feed.stato === "in-arrivo" ? (
        // Revisore 2/11: niente più "Gli amici arrivano presto" a tutta pagina: le cose vere che si fanno già.
        <AmiciIntanto userId={viewer} saved={await loadMySaved(viewer).catch(() => [])} codice={await mioInvito()} senzaNome={senzaNome} />
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
            {/* Gli amici che non sono ancora su Mapetite: il link personale (sta nel profilo, si apre da solo).
                Con la pagina vuota l'invito è già sotto, a tutta larghezza: niente doppione. */}
            {!vuota && (
              <SenzaInvitoSospeso>
                <Link href="/profilo#invita" data-testid="amici-invita" className={chip}>
                  <span aria-hidden>💌</span> Invita un amico
                </Link>
              </SenzaInvitoSospeso>
            )}
          </nav>

          {/* Senza nessuno da seguire, i creator sono il primo passo: vengono subito. */}
          {feed.seguiti.length === 0 && creatorSection}

          {amici.length + soloSeguiti.length > 0 && (
            <section className="mt-6" aria-labelledby="seguiti-titolo">
              {/* Revisore 14/11 (terzo giro): "Amici" quando lo sono (vi seguite a vicenda), non "Chi segui". */}
              <h2 id="seguiti-titolo" data-testid="seguiti-titolo" className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                {soloSeguiti.length === 0 ? "Amici" : amici.length === 0 ? "Chi segui" : "Amici e chi segui"} · {amici.length + soloSeguiti.length}
              </h2>
              <ul data-testid="seguiti" className="-mx-4 mt-2 flex gap-3 overflow-x-auto px-4 pb-1">
                {amici.map((a) => <AmicoRiga key={a.id} amico={a} />)}
                {soloSeguiti.map((p) => (
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

          {/* Revisore 15/11: con la pagina vuota sotto c'è solo l'invito, niente intestazione "Attività". */}
          <section className="mt-6" aria-labelledby={vuota ? undefined : "attivita-titolo"} aria-label={vuota ? "Invita un amico" : undefined}>
            {!vuota && <h2 id="attivita-titolo" data-testid="attivita-titolo" className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">Attività</h2>}
            {vuota ? (
              <SenzaInvitoSospeso>
                <div data-testid="amici-vuoto" className="mt-2">
                  <InvitaAmico userId={viewer} handle={feed.mio?.handle ?? null} codice={codiceInvito} senzaNome={senzaNome} vuoto />
                </div>
              </SenzaInvitoSospeso>
            ) : feed.attivita.length === 0 ? (
              <p data-testid="amici-nessuna-attivita" className="mt-2 rounded-card border border-[#e3e7e7] bg-white p-5 text-center text-sm font-sans text-text-muted">
                {feed.seguiti.length === 0 ? "I tuoi amici hanno il profilo privato: i loro posti non si vedono." : "Chi segui non ha ancora salvato posti. Torna più tardi."}
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

          {/* "Fatti trovare" (revisore 14/11, quarto giro): uscito dal primo accesso, qui un riquadro discreto. Il
              profilo si rende pubblico da /profilo, dove si vede prima cosa vedranno gli altri.
              Revisore 15/11: nello stato vuoto una cosa sola, "Manda il tuo link"; "Fatti trovare" quando c'è qualcuno. */}
          {privato && !vuota && (
            <section data-testid="amici-fatti-trovare" className="mt-6 flex items-center gap-3 rounded-card border border-[#e3e7e7] bg-white px-4 py-3">
              <span aria-hidden className="text-xl">🙋</span>
              <p className="min-w-0 flex-1 text-[13px] font-sans leading-snug text-text-muted">
                <span className="block font-display text-[14px] font-semibold text-text">Fatti trovare</span>
                Gli amici ti cercano per nome solo con il profilo pubblico.
              </p>
              <Link href="/profilo#profilo-pubblico" data-testid="amici-rendi-pubblico" className="inline-flex min-h-11 shrink-0 items-center px-1 font-display text-sm font-semibold text-brand">
                Rendi pubblico
              </Link>
            </section>
          )}

          {feed.seguiti.length > 0 && creatorSection}
        </>
      )}
    </div>
    </div>
  );
}
