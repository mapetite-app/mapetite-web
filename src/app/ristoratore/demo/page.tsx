import type { Metadata } from "next";
import { computeRistoratore } from "@/lib/ristoratore";
import { demoDati } from "@/lib/ristoratore-demo";
import Pannello, { PERIODI } from "../pannello";

// Esempio dimostrativo del pannello del ristoratore (PIANO-25-OTTOBRE.md 8.2, presentazione
// agli investitori): dati INVENTATI, etichettati "Esempio dimostrativo" in cima. Mai spacciati
// per veri. Stessa grafica e stesso calcolo del pannello vero.
export const metadata: Metadata = {
  title: "Pannello del ristoratore (esempio) · Mapetite",
  description: "Esempio dimostrativo: come un ristoratore vede chi lo cerca, lo salva e lo sceglie su Mapetite.",
  robots: { index: false, follow: true },
};

export default async function RistoratoreDemoPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const sp = await searchParams;
  const giorni = PERIODI.find((p) => String(p) === sp.giorni) ?? 30;
  const dati = demoDati();
  const p = computeRistoratore(dati, giorni);
  return <Pannello p={p} locale={dati.locale} citta={dati.citta} verificato base="/ristoratore/demo" demo />;
}
