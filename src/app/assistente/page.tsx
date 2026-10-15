import type { Metadata } from "next";
import AssistenteView from "./assistente-view";

export const metadata: Metadata = {
  title: "Assistente · Mapetite",
  description: "Chiedi come a un amico: trovo i locali giusti per te e ti preparo la prenotazione.",
};

// Assistente Mapetite (piano 1.1 e 1.3): la ricerca diventa una conversazione.
// Tutto avviene nel telefono: la conversazione resta in sessionStorage, le prenotazioni
// richieste in localStorage. Le ricerche usano /api/search come la mappa (una chiamata Google).
export default function AssistentePage() {
  return <AssistenteView />;
}
