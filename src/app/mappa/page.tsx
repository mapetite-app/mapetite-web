import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import MapView from "./map-view";

export default async function MappaPage() {
  const supabase = await createClient();
  const { data: places, error } = await supabase
    .from("places")
    .select("id, name, category, lat, lng, address")
    .not("lat", "is", null)
    .not("lng", "is", null);

  if (error) {
    console.error("Errore nel caricamento di places:", error);
  }

  const { data: userData } = await supabase.auth.getUser();

  const normalized = (places ?? []).map((p) => ({ ...p, tags: null, note: null, rating: null, priceLevel: null }));

  // Solo in sviluppo locale: utente finto per il test automatico dei salvati
  // (scripts/e2e/giro.mjs). In produzione NODE_ENV è sempre "production".
  // Il cookie "e2e_anonimo" simula chi non ha fatto l'accesso.
  const dev = process.env.NODE_ENV === "development";
  const e2eUser = dev && !(await cookies()).get("e2e_anonimo") ? process.env.E2E_FAKE_USER ?? null : null;

  return <MapView places={normalized} userId={e2eUser ?? userData?.user?.id ?? null} />;
}
