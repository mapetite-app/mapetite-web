import { createClient } from "@/lib/supabase/server";

type SavedPlaceRow = {
  created_at: string;
  tags: string[] | null;
  note: string | null;
  places: {
    id: string;
    name: string;
    category: string | null;
    address: string | null;
  } | null;
};

type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  places: {
    name: string;
  } | null;
};

function Stars({ rating }: { rating: number }) {
  const filled = Math.round(Math.max(0, Math.min(5, rating)));
  return (
    <span aria-label={`${filled} stelle su 5`}>
      <span className="text-amber-400">{"★".repeat(filled)}</span>
      <span className="text-zinc-300">{"★".repeat(5 - filled)}</span>
    </span>
  );
}

export default async function ProfiloPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user ?? null;

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <p className="text-zinc-500">Accedi per vedere il tuo profilo.</p>
      </div>
    );
  }

  const [{ data: savedRaw }, { data: reviewsRaw }] = await Promise.all([
    supabase
      .from("saved_places")
      .select("created_at, tags, note, places (id, name, category, address)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("reviews")
      .select("id, rating, comment, created_at, places (name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const saved = (savedRaw ?? []) as unknown as SavedPlaceRow[];
  const reviews = (reviewsRaw ?? []) as unknown as ReviewRow[];

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-10">
        <p className="text-lg font-semibold text-zinc-900">{user.email}</p>
        <p className="mt-1 text-sm text-zinc-500">
          {saved.length} {saved.length === 1 ? "locale salvato" : "locali salvati"} ·{" "}
          {reviews.length} {reviews.length === 1 ? "recensione" : "recensioni"}
        </p>
      </div>

      <section className="mb-12">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">
          I miei locali salvati
        </h2>
        {saved.length === 0 ? (
          <p className="text-sm text-zinc-400">
            Non hai ancora salvato nessun locale.
          </p>
        ) : (
          <ul className="space-y-5">
            {saved.map(({ places: place, tags, note }, i) =>
              place ? (
                <li key={place.id ?? i} className="border-b border-zinc-100 pb-5 last:border-0">
                  <p className="font-semibold text-zinc-900">{place.name}</p>
                  {place.category && (
                    <p className="text-sm text-zinc-500">{place.category}</p>
                  )}
                  {tags && tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {note && (
                    <p className="mt-1.5 text-sm text-zinc-500 italic">{note}</p>
                  )}
                </li>
              ) : null
            )}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">
          Le mie recensioni
        </h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-zinc-400">
            Non hai ancora scritto recensioni.
          </p>
        ) : (
          <ul className="space-y-5">
            {reviews.map((review) => (
              <li key={review.id} className="border-b border-zinc-100 pb-5 last:border-0">
                <p className="font-semibold text-zinc-900">
                  {review.places?.name ?? "Locale sconosciuto"}
                </p>
                <div className="mt-1">
                  <Stars rating={review.rating} />
                </div>
                {review.comment && (
                  <p className="mt-1.5 text-sm text-zinc-600">{review.comment}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
