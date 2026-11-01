import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { loadMyGruppi } from "@/lib/gruppi-server";
import { loadMySaved, myUserId } from "@/lib/raccolte-server";
import { loadMySocial } from "@/lib/social";
import { isUuid } from "@/lib/gruppi";
import { GruppiAccedi, GruppiInArrivo, nomeSuggerito } from "./gruppi-ui";
import GruppiElenco from "./gruppi-elenco";

// Liste di gruppo (piano 5.5): le proprie liste e "Nuova lista".
// Con ?proponi=<UUID del locale> (dalla scheda di un locale salvato) si sceglie in quale lista proporlo.

export const metadata: Metadata = { title: "Liste di gruppo · Mapetite" };

type Props = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> };

export default async function GruppiPage({ searchParams }: Props) {
  const sp = await searchParams;
  const proponiId = typeof sp.proponi === "string" && isUuid(sp.proponi) ? sp.proponi : null;
  const userId = await myUserId();
  if (!userId) return <GruppiAccedi next={proponiId ? `/gruppi?proponi=${proponiId}` : "/gruppi"} />;

  const [gruppi, social, saved] = await Promise.all([
    loadMyGruppi(),
    loadMySocial(userId),
    proponiId ? loadMySaved(userId) : Promise.resolve([]),
  ]);
  const posto = proponiId ? saved.find((s) => s.placeId === proponiId) : undefined;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-4" data-testid="gruppi">
      <Link href="/amici" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-display font-semibold text-brand">
        <ArrowLeft size={18} aria-hidden /> Amici
      </Link>
      <h1 className="mt-1 font-title text-3xl font-semibold text-text">Liste di gruppo</h1>
      <p className="mt-1 text-sm font-sans text-text-muted">Ognuno propone un posto, si vota con 👍 e il preferito sale in cima.</p>

      <div className="mt-5">
        {"stato" in gruppi ? (
          <GruppiInArrivo />
        ) : (
          <GruppiElenco
            userId={userId}
            gruppi={gruppi}
            nomeIniziale={nomeSuggerito(social)}
            proponi={posto ? { placeId: posto.placeId, name: posto.name } : proponiId ? { placeId: proponiId, name: null } : null}
          />
        )}
      </div>
    </div>
  );
}
