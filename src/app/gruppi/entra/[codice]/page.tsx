import type { Metadata } from "next";
import Link from "next/link";
import { loadInvitoGruppo } from "@/lib/gruppi-server";
import { myUserId } from "@/lib/raccolte-server";
import { loadMySocial } from "@/lib/social";
import { gruppoPath, numeriGruppo } from "@/lib/gruppi";
import { GruppiInArrivo, nomeSuggerito } from "../../gruppi-ui";
import EntraForm from "./entra-form";

// Link d'invito di una lista di gruppo (piano 5.5): /gruppi/entra/<codice>.
// Si vede solo nome, simbolo e quante persone ci sono (mai nomi o posti prima di entrare).
// Chi non ha l'account si registra e torna qui; chi ce l'ha entra con un tocco.

type Props = { params: Promise<{ codice: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await loadInvitoGruppo((await params).codice);
  const title = data.stato === "ok" ? `Entra in "${data.invito.nome}" su Mapetite` : "Un invito per te su Mapetite";
  const description = "Scegliete insieme dove andare: ognuno propone un posto, si vota e vince il preferito.";
  return { title, description, openGraph: { title, description, locale: "it_IT", type: "website", siteName: "Mapetite" } };
}

export default async function EntraGruppoPage({ params }: Props) {
  const { codice } = await params;
  const [data, userId] = await Promise.all([loadInvitoGruppo(codice), myUserId()]);

  if (data.stato !== "ok") {
    return (
      <main className="mx-auto max-w-md px-4 pb-10 pt-6" data-testid="gruppo-invito">
        {data.stato === "in-arrivo" ? (
          <GruppiInArrivo />
        ) : (
          <section data-testid="gruppo-invito-non-valido" className="rounded-card border border-border bg-surface p-6 text-center">
            <p aria-hidden className="text-4xl">🔗</p>
            <p className="mt-2 font-display text-lg font-semibold text-brand">Invito non valido</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-text-muted">Il link è incompleto o la lista non esiste più. Chiedi all&apos;amico di rimandartelo.</p>
            <Link href="/mappa" className="mt-4 inline-flex min-h-11 items-center rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white">Apri Mapetite</Link>
          </section>
        )}
      </main>
    );
  }

  const { invito } = data;
  const next = encodeURIComponent(`/gruppi/entra/${data.codice}`);
  const social = userId && !invito.sono_dentro ? await loadMySocial(userId) : null;

  return (
    <main data-testid="gruppo-invito" className="mx-auto flex min-h-[calc(100dvh-var(--nav-height-mobile)-var(--nav-sporgenza))] max-w-md flex-col bg-bg">
      <section className="relative overflow-hidden rounded-b-[2rem] bg-brand px-6 pb-8 pt-6 text-white">
        <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/25" />
        <span aria-hidden className="pointer-events-none absolute -bottom-16 -left-8 h-36 w-36 rounded-full bg-white/5" />
        <p className="relative inline-flex items-center gap-1.5 rounded-pill bg-white/10 px-3 py-1.5 font-display text-xs font-semibold">
          <span aria-hidden className="h-2 w-2 rounded-full bg-accent" />
          Lista di gruppo
        </p>
        <span aria-hidden className="relative mt-8 flex h-16 w-16 items-center justify-center rounded-full bg-white/15 text-4xl ring-4 ring-white/10">{invito.emoji}</span>
        <h1 data-testid="gruppo-invito-titolo" className="relative mt-4 font-title text-[1.75rem] font-semibold leading-tight break-words">
          {invito.nome}
        </h1>
        <p className="relative mt-1 text-sm text-white/80">{numeriGruppo(invito)}</p>
        <p className="relative mt-3 text-[15px] font-sans leading-relaxed text-white/85">
          Ti hanno invitato a scegliere insieme dove andare: proponi i tuoi posti, metti 👍 a quelli che ti piacciono e il preferito sale in cima.
        </p>
      </section>

      <div className="mt-auto px-6 pb-6 pt-8">
        {invito.sono_dentro ? (
          <>
            <p className="mb-3 text-center text-sm text-text-muted">Sei già in questa lista.</p>
            <Link
              href={gruppoPath(invito.id)}
              data-testid="gruppo-invito-apri"
              className="flex min-h-13 w-full items-center justify-center rounded-pill bg-accent px-6 py-3.5 font-display text-base font-semibold text-white shadow-float active:scale-[0.98]"
            >
              Apri la lista
            </Link>
          </>
        ) : userId ? (
          <EntraForm codice={data.codice} nomeIniziale={social ? nomeSuggerito(social) : ""} />
        ) : (
          <>
            <a
              href={`/signup?next=${next}`}
              data-testid="gruppo-invito-registrati"
              className="flex min-h-13 w-full items-center justify-center rounded-pill bg-accent px-6 py-3.5 font-display text-base font-semibold text-white shadow-float active:scale-[0.98]"
            >
              Crea un account ed entra
            </a>
            <p className="mt-2 text-center text-xs text-text-muted">Gratis, in meno di un minuto.</p>
            <a href={`/login?next=${next}`} className="mt-1 flex min-h-11 items-center justify-center text-sm font-display font-semibold text-brand">
              Hai già un account? Accedi
            </a>
          </>
        )}
      </div>
    </main>
  );
}
