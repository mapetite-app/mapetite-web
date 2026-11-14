import type { Metadata } from "next";
import Link from "next/link";
import Avatar from "@/components/avatar";
import InvitoArrivo from "@/components/invito-arrivo";
import { loadProfilePage, viewerId, type PublicProfile } from "@/lib/social";
import { isValidHandle, personName } from "@/lib/handle";
import { cleanInviteCode, isFriendCode } from "@/lib/invito";
import { anteprimaInvito, loadMySocial, mioInvito } from "@/lib/social";
import InvitoAccetta from "@/components/invito-accetta";

// Pagina d'arrivo del link d'invito (piano 9.1): chi la apre capisce in una frase cos'è Mapetite
// e ha un solo pulsante, "Inizia". Se il codice è il nome di una persona con profilo pubblico
// compare il suo nome; altrimenti un testo neutro. Mai dati privati: si legge solo la vista
// pubblica dei profili (come /u/<nome>).

type Props = { params: Promise<{ codice: string }> };

// Codici generici scelti da Lorenzo (es. il link per il gruppo di tester del 25/10).
const GENERICI: Record<string, string> = {
  tester: "Sei tra i primi a provare Mapetite",
  amici: "Ti hanno invitato su Mapetite",
};

// Link personale di un amico (codice "i-…", 14/11): chi invita (null se il codice non esiste più, per
// esempio dopo "Nuovo link") e il nome che si è scelto.
// "errore": database o rete giù, non si sa (testo neutro, mai "non vale più").
async function amico(codice: string | null): Promise<{ nome: string | null } | null | "errore"> {
  if (!isFriendCode(codice)) return null;
  const a = await anteprimaInvito(codice);
  return a === "errore" ? a : a ? { nome: a.nome } : null;
}

async function inviter(codice: string | null): Promise<PublicProfile | null> {
  if (!codice || !isValidHandle(codice)) return null;
  const data = await loadProfilePage(codice);
  return data.stato === "ok" ? data.profile : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const codice = cleanInviteCode((await params).codice);
  const [p, a] = await Promise.all([inviter(codice), amico(codice)]);
  const chi = p ? personName(p) : a && a !== "errore" ? a.nome : null;
  const title = chi ? `${chi} ti invita su Mapetite` : "Un invito per te su Mapetite";
  const description = "La tua mappa dei locali: salva i posti che scopri sui social o dagli amici e ritrovali quando devi scegliere.";
  return {
    title,
    description,
    openGraph: { title, description, locale: "it_IT", type: "website", siteName: "Mapetite" },
  };
}

const PUNTI = [
  { e: "📸", t: "Salvi un locale in un gesto", s: "da Instagram, TikTok, Google Maps o dal consiglio di un amico" },
  { e: "🗺️", t: "Lo ritrovi sulla tua mappa", s: "diviso per città, occasione e «voglio andarci»" },
  { e: "✨", t: "Scegli in pochi secondi", s: "chiedi «cena romantica con terrazza» e trovi i posti giusti per te" },
];

export default async function InvitoPage({ params }: Props) {
  const codice = cleanInviteCode((await params).codice);
  const [p, a, viewer] = await Promise.all([inviter(codice), amico(codice), viewerId()]);
  const chiAmico = a === "errore" ? null : a;
  const loggedIn = !!viewer;
  const name = p ? personName(p) : chiAmico?.nome ?? null;
  const perAmico = isFriendCode(codice);
  // Già iscritto e link di un amico: "Diventa amico" qui, con il nome se ancora non ce l'ha. Solo se chi invita
  // esiste e non sei tu (revisore 14/11, terzo giro: prima il tasto compariva anche su un codice inesistente o sul proprio).
  const proprio = loggedIn && perAmico && !!chiAmico && (await mioInvito()) === codice;
  const puoiAccettare = loggedIn && perAmico && !!chiAmico && !proprio;
  const mio = puoiAccettare && viewer ? await loadMySocial(viewer) : null;
  const chiediNome = !!mio && ("stato" in mio || !mio.display_name?.trim());
  const posti = p ? p.visitati + p.da_provare : 0;
  const titolo = name ? `${name} ti ha invitato su Mapetite` : (codice && GENERICI[codice]) || "Ti hanno invitato su Mapetite";

  return (
    <main data-testid="invito-pagina" className="mx-auto flex min-h-[calc(100dvh-var(--nav-height-mobile)-var(--nav-sporgenza))] max-w-md flex-col bg-bg">
      {codice && <InvitoArrivo codice={codice} loggedIn={loggedIn} />}

      <section className="relative overflow-hidden rounded-b-[2rem] bg-brand px-6 pb-8 pt-6 text-white">
        <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/25" />
        <span aria-hidden className="pointer-events-none absolute -bottom-16 -left-8 h-36 w-36 rounded-full bg-white/5" />
        <p className="relative inline-flex items-center gap-1.5 rounded-pill bg-white/10 px-3 py-1.5 font-display text-xs font-semibold">
          <span aria-hidden className="h-2 w-2 rounded-full bg-accent" />
          Mapetite
        </p>
        <div className="relative mt-8 flex items-center gap-3">
          {p ? (
            <Avatar person={p} size={56} className="ring-4 ring-white/15" />
          ) : (
            <span aria-hidden className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-3xl ring-4 ring-white/10">💌</span>
          )}
          {p && posti > 0 && (
            <p data-testid="invito-posti" className="text-sm font-sans text-white/80">
              {posti === 1 ? "1 posto" : `${posti} posti`} sulla sua mappa
            </p>
          )}
        </div>
        <h1 data-testid="invito-titolo" className="relative mt-4 font-title text-[1.75rem] font-semibold leading-tight">
          {titolo}
        </h1>
        <p className="relative mt-3 text-[15px] font-sans leading-relaxed text-white/85">
          La tua mappa personale dei locali: non perdi più i posti che scopri e li ritrovi quando devi scegliere.
        </p>
      </section>

      <ul className="flex flex-col gap-3 px-6 pt-6">
        {PUNTI.map((x) => (
          <li key={x.t} className="flex items-start gap-3">
            <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-light text-xl">{x.e}</span>
            <span className="min-w-0 pt-0.5">
              <span className="block font-display text-[15px] font-semibold text-brand">{x.t}</span>
              <span className="block text-sm font-sans text-text-muted">{x.s}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-auto px-6 pb-6 pt-8">
        {loggedIn ? (
          <>
            {puoiAccettare && codice ? (
              <InvitoAccetta codice={codice} nome={name} chiediNome={chiediNome} />
            ) : (
              <p data-testid="invito-neutro" className="mb-3 text-center text-sm font-sans text-text-muted">
                {proprio ? "Questo è il tuo link d'invito: mandalo a un amico." : perAmico && a !== "errore" ? "Questo invito non vale più: chiedi un link nuovo." : "Hai già un account: sei dentro."}
              </p>
            )}
            <Link
              href="/mappa"
              data-testid="invito-apri"
              className={puoiAccettare ? "flex min-h-11 w-full items-center justify-center font-display text-sm font-semibold text-brand" : "flex min-h-13 w-full items-center justify-center rounded-pill bg-accent px-6 py-3.5 font-display text-base font-semibold text-white shadow-float active:scale-[0.98]"}
            >
              Apri la tua mappa
            </Link>
          </>
        ) : (
          <>
            <Link
              href="/signup"
              data-testid="invito-inizia"
              className="flex min-h-13 w-full items-center justify-center rounded-pill bg-accent px-6 py-3.5 font-display text-base font-semibold text-white shadow-float active:scale-[0.98]"
            >
              Inizia
            </Link>
            {/* Solo il link personale di un amico (codice "i-…") propone l'amicizia, e la chiede con un tasto alla
                fine del primo accesso: qui lo si dice prima (revisore 14/11). */}
            <p data-testid="invito-amicizia" className="mt-2 text-center text-[13px] font-sans text-text-muted">
              {perAmico && chiAmico ? <>Gratis. Dopo, se vuoi, diventi amico di {name ?? "chi ti ha invitato"}.</> : "Gratis, in meno di un minuto."}
            </p>
            <Link href="/login" className="mt-1 flex min-h-11 items-center justify-center text-sm font-display font-semibold text-brand">
              Hai già un account? Accedi
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
