import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { validPhotoRef } from "@/app/locali/[id]/dati";
import { CODICE_RE, VOTANTE_RE } from "@/lib/voto-gruppo";
import { VOTANTE_COOKIE, adessoPer, leggiVoto } from "@/lib/voto-gruppo-server";
import VotoGruppo from "./voto-gruppo";

// "Manda al gruppo" (proposta 56): la pagina del voto, pubblica. Chi la apre da WhatsApp scrive un nome e
// vota con un tocco, senza account; vede chi ha votato cosa; all'ora scelta il voto si chiude e chi l'ha
// proposto vede il vincitore con "Prenota". Tutto in una schermata (390×844).
// Foto: il riferimento Google viaggia nel link (?f=…, come /locali/<id>?foto=), accettato solo se è di
// QUEL locale, e passa dal proxy in cache. Mai salvato da noi (termini Google, 3.2.3(b)).

type Props = { params: Promise<{ codice: string }>; searchParams: Promise<{ f?: string | string[] }> };

export const metadata: Metadata = {
  title: "Dove andiamo? Vota · Mapetite",
  description: "Tre posti scelti per stasera: tocca quello che preferisci, basta il tuo nome.",
  openGraph: { title: "Dove andiamo? Vota", description: "Tre posti scelti per stasera: tocca quello che preferisci, basta il tuo nome.", locale: "it_IT", type: "website", siteName: "Mapetite" },
  robots: { index: false },
};

async function viewer(): Promise<string | null> {
  if (process.env.NODE_ENV === "development" && process.env.E2E_FAKE_USER) {
    return (await cookies()).get("e2e_anonimo") ? null : process.env.E2E_FAKE_USER;
  }
  const { data } = await (await createClient()).auth.getUser();
  return data?.user?.id ?? null;
}

export default async function VotoPage({ params, searchParams }: Props) {
  const { codice } = await params;
  const { f } = await searchParams;
  const jar = await cookies();
  const votante = jar.get(VOTANTE_COOKIE)?.value ?? null;
  const io = await viewer();
  const stato = CODICE_RE.test(codice) ? await leggiVoto(codice, io, votante && VOTANTE_RE.test(votante) ? votante : null, adessoPer(jar.get("e2e_voto_ora")?.value)) : null;

  if (!stato || stato === "errore" || stato.posti.length === 0) {
    return (
      <main data-testid="voto-non-trovato" data-voto="" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center bg-bg px-6 text-center">
        <p aria-hidden className="text-4xl">🗳️</p>
        <h1 className="mt-3 font-title text-2xl font-semibold text-brand">{stato === "errore" ? "Non riesco ad aprire il voto" : "Questo voto non c'è più"}</h1>
        <p className="mt-2 text-sm font-sans text-text-muted">{stato === "errore" ? "Riprova tra poco." : "Chiedi a chi l'ha mandato un link nuovo."}</p>
        <Link href="/" className="mt-6 flex min-h-12 items-center justify-center rounded-pill bg-brand px-6 font-display text-sm font-semibold text-white">Scopri Mapetite</Link>
      </main>
    );
  }

  const refs = (Array.isArray(f) ? f : f ? [f] : []).slice(0, 3);
  const foto: Record<string, string> = {};
  for (const p of stato.posti) {
    const r = refs.map((x) => validPhotoRef(x, p.gid)).find(Boolean);
    if (r) foto[p.id] = r;
  }
  const qs = refs.length > 0 ? `?${refs.map((r) => `f=${encodeURIComponent(r)}`).join("&")}` : "";
  return <VotoGruppo iniziale={stato} foto={foto} percorso={`/voto/${codice}${qs}`} collegato={!!io} />;
}
