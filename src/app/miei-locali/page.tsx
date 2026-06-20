import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PlaceCard from "@/components/place-card";

type SavedPlaceRow = {
  created_at: string;
  places: {
    id: string;
    name: string;
    category: string | null;
    address: string | null;
  } | null;
};

export default async function MieiLocaliPage() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData?.user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("saved_places")
    .select("created_at, places (id, name, category, address)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Errore nel caricamento dei locali salvati:", error);
  }

  const savedPlaces = (data ?? []) as unknown as SavedPlaceRow[];

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">
        I tuoi locali salvati
      </h1>

      {!savedPlaces || savedPlaces.length === 0 ? (
        <p className="text-zinc-500">Non hai ancora salvato nessun locale.</p>
      ) : (
        <ul className="space-y-3">
          {savedPlaces.map(({ places: place }) =>
            place ? (
              <li key={place.id}>
                <PlaceCard
                  name={place.name}
                  category={place.category}
                  address={place.address}
                />
              </li>
            ) : null
          )}
        </ul>
      )}
    </div>
  );
}
