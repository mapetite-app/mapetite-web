import { createClient } from "@/lib/supabase/server";
import MapView from "./map-view";

export default async function MappaPage() {
  const supabase = await createClient();
  const { data: places, error } = await supabase
    .from("places")
    .select("id, name, category, lat, lng")
    .not("lat", "is", null)
    .not("lng", "is", null);

  if (error) {
    console.error("Errore nel caricamento di places:", error);
  }

  const { data: userData } = await supabase.auth.getUser();

  const normalized = (places ?? []).map((p) => ({ ...p, tags: null, note: null }));

  return <MapView places={normalized} userId={userData?.user?.id ?? null} />;
}
