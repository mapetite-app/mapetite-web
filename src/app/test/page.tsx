import { createClient } from "@/lib/supabase/server";

export default async function TestPage() {
  const supabase = await createClient();
  const { data: places, error } = await supabase.from("places").select("*");

  if (error) {
    console.error("Errore nel caricamento di places:", error);
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">Locali</h1>

      {!places || places.length === 0 ? (
        <p className="text-zinc-500">Nessun locale</p>
      ) : (
        <ul className="space-y-6">
          {places.map((place) => (
            <li key={place.id} className="border-b border-zinc-200 pb-4">
              <p className="text-xl font-semibold text-zinc-900">
                {place.name}
              </p>
              <p className="text-sm text-zinc-500">{place.category}</p>
              <p className="text-sm text-zinc-500">{place.address}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
