import type { Metadata } from "next";
import { annoDa } from "@/lib/anno-tavola";
import { annoLocale } from "@/lib/ristoratore-anno";
import { DEMO_LOCALE, demoAnnoDati } from "@/lib/ristoratore-demo";
import AnnoVista from "../../anno-vista";

// Esempio dimostrativo di "Il vostro anno su Mapetite" (proposta 87): numeri INVENTATI, etichettati in cima.
export const metadata: Metadata = {
  title: "Il vostro anno su Mapetite (esempio) · Mapetite",
  description: "Esempio dimostrativo: il riepilogo dell'anno che un locale riceve a dicembre e pubblica su Instagram.",
  robots: { index: false, follow: true },
};

export default function AnnoLocaleDemoPage() {
  const anno = annoDa();
  const a = annoLocale({ placeId: DEMO_LOCALE.id, ...demoAnnoDati(anno) }, anno);
  return <AnnoVista nome={DEMO_LOCALE.name} a={a} base="/ristoratore/demo" demo />;
}
