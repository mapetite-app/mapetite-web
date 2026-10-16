import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { loadGruppo } from "@/lib/gruppi-server";
import { loadMySaved, myUserId } from "@/lib/raccolte-server";
import { GruppiAccedi, GruppiInArrivo } from "../gruppi-ui";
import GruppoVista from "./gruppo-vista";

// Una lista di gruppo (piano 5.5): i posti proposti con i 👍, il più votato in cima,
// "Aggiungi dai tuoi salvati" e il link d'invito da mandare agli amici.
// Chi non è membro riceve la stessa risposta di una lista che non esiste (RLS).

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export const metadata: Metadata = { title: "Lista di gruppo · Mapetite" };

function Indietro() {
  return (
    <Link href="/gruppi" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-display font-semibold text-brand">
      <ArrowLeft size={18} aria-hidden /> Liste di gruppo
    </Link>
  );
}

export default async function GruppoPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const userId = await myUserId();
  if (!userId) return <GruppiAccedi next={`/gruppi/${encodeURIComponent(id)}`} />;

  const [data, saved] = await Promise.all([loadGruppo(id), loadMySaved(userId)]);

  if (data.stato !== "ok") {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-10 pt-4">
        <Indietro />
        <div className="mt-4">
          {data.stato === "in-arrivo" ? (
            <GruppiInArrivo />
          ) : (
            <section data-testid="gruppo-non-trovato" className="rounded-card border border-border bg-surface p-6 text-center">
              <p aria-hidden className="text-4xl">🔒</p>
              <p className="mt-2 font-display text-lg font-semibold text-brand">Lista non disponibile</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-text-muted">
                Questa lista non esiste o non ne fai parte. Per entrare serve il link d&apos;invito di un amico.
              </p>
            </section>
          )}
        </div>
      </div>
    );
  }

  const salvati = saved.map((s) => ({ placeId: s.placeId, name: s.name, category: s.category, address: s.address, lat: s.lat, lng: s.lng, googlePlaceId: s.googlePlaceId }));

  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-4" data-testid="gruppo">
      <Indietro />
      <GruppoVista
        userId={userId}
        gruppo={data.gruppo}
        membri={data.membri}
        postiIniziali={data.posti}
        salvati={salvati}
        appenaCreata={sp.nuova === "1"}
      />
    </div>
  );
}
