import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { caricaAnnoLocale } from "@/lib/ristoratore-anno-server";
import AnnoVista from "../../anno-vista";

// "Il vostro anno su Mapetite" (proposta 87): come il pannello, solo per admin e titolare verificato (altrimenti 404).
export const metadata: Metadata = { title: "Il vostro anno su Mapetite · Mapetite", robots: { index: false, follow: false } };

export default async function AnnoLocalePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dati = await caricaAnnoLocale(id);
  if (!dati) notFound();
  return <AnnoVista nome={dati.nome} a={dati.anno} base={`/ristoratore/${id}`} />;
}
