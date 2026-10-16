import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getUser } from "@/lib/supabase/server";
import AssistenteView from "./assistente-view";

export const metadata: Metadata = {
  title: "Assistente · Mapetite",
  description: "Chiedi come a un amico: trovo i locali giusti per te e ti preparo la prenotazione.",
};

// Assistente Mapetite (piano 1.1 e 1.3): la ricerca diventa una conversazione.
// Tutto avviene nel telefono: la conversazione resta in sessionStorage, le prenotazioni
// richieste in localStorage. Le ricerche usano /api/search come la mappa (una chiamata Google).
// L'utente serve solo per "Salva" sulle card (stesso salvataggio della mappa).
export default async function AssistentePage() {
  const { data } = await getUser();
  // Solo in sviluppo locale: utente finto per il giro automatico, come /mappa
  // (il cookie "e2e_anonimo" simula chi non ha fatto l'accesso).
  const dev = process.env.NODE_ENV === "development";
  const e2eUser = dev && !(await cookies()).get("e2e_anonimo") ? process.env.E2E_FAKE_USER ?? null : null;
  return <AssistenteView userId={e2eUser ?? data?.user?.id ?? null} />;
}
