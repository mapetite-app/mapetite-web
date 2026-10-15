import type { Metadata } from "next";
import PrenotazioniView from "./prenotazioni-view";

export const metadata: Metadata = {
  title: "Le mie prenotazioni · Mapetite",
  description: "Le richieste di prenotazione che hai mandato ai locali: in arrivo, confermate e passate.",
};

// Le prenotazioni sono salvate nel telefono (src/lib/booking.ts): la pagina le legge lì, lato client.
export default function PrenotazioniPage() {
  return <PrenotazioniView />;
}
