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
  // Tavoli chiesti da Mapetite (PROPOSTE.md 3, passo 3): anche questi inventati, in proporzione al periodo.
  const tavoli = Math.round(giorni * 0.6) + 4;
  // Spenta come nel pannello vero (bocciata due volte il 31/10 notte): si vede con ?beta=tavoli.
  const prenotazioni = sp.beta === "tavoli" ? { tavoli, diParola: Math.round(tavoli * 0.45), persone: tavoli - Math.round(tavoli * 0.15), personeParola: Math.round(tavoli * 0.4) } : null;
  return <Pannello p={p} locale={dati.locale} citta={dati.citta} verificato base="/ristoratore/demo" demo prenotazioni={prenotazioni} vista={typeof sp.vista === "string" ? sp.vista : undefined} />;
}
