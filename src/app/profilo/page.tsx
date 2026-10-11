import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import PlaceCard from "@/components/place-card";
import { cityFromAddress } from "@/lib/city";

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
      <span className="text-star">{"★".repeat(filled)}</span>
      <span className="text-border">{"★".repeat(5 - filled)}</span>
    </span>
  );
}

export default async function ProfiloPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user ?? null;

  if (!user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-display text-xl font-semibold text-brand">Il tuo profilo ti aspetta</p>
        <p className="max-w-xs text-sm text-text-muted">
          Accedi per ritrovare i tuoi locali salvati, le recensioni e i tuoi gusti.
        </p>
        <div className="flex gap-2">
          <a href="/login" className="inline-flex min-h-11 items-center rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white">
            Accedi
          </a>
          <a href="/signup" className="inline-flex min-h-11 items-center rounded-pill border border-border px-5 text-sm font-display font-semibold text-brand">
            Crea un account
          </a>
        </div>
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

  // Salvati raggruppati per città (ricavata dall'indirizzo, come nella mappa).
  const byCity = new Map<string, SavedPlaceRow[]>();
  for (const row of saved) {
    if (!row.places) continue;
    const city = cityFromAddress(row.places.address) ?? "Altre zone";
    byCity.set(city, [...(byCity.get(city) ?? []), row]);
  }
  const cityGroups = [...byCity.entries()].sort((a, b) =>
    a[0] === "Altre zone" ? 1 : b[0] === "Altre zone" ? -1 : b[1].length - a[1].length,
  );
  const initial = (user.email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8 flex items-center gap-4">
        <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand font-title text-2xl font-semibold text-white">
          {initial}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-base font-semibold text-text">{user.email}</p>
          <p className="mt-0.5 text-sm text-text-muted">
            {saved.length} {saved.length === 1 ? "locale salvato" : "locali salvati"} ·{" "}
            {reviews.length} {reviews.length === 1 ? "recensione" : "recensioni"}
          </p>
          <Link href="/me" className="mt-1 inline-block text-sm font-display font-semibold text-accent">
            I tuoi gusti →
          </Link>
        </div>
      </div>

      <section className="mb-10">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-title text-xl font-semibold text-brand">I miei locali salvati</h2>
          {saved.length > 0 && (
            <Link href="/mappa" className="text-sm font-display font-semibold text-accent">Sulla mappa →</Link>
          )}
        </div>
        {saved.length === 0 ? (
          <div className="rounded-card border border-border bg-surface p-5 text-center">
            <p className="text-sm text-text-muted">Non hai ancora salvato nessun locale.</p>
            <Link href="/mappa" className="mt-3 inline-flex min-h-11 items-center rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white">
              Cerca un locale
            </Link>
          </div>
        ) : (
          cityGroups.map(([city, rows]) => (
            <div key={city} className="mb-5">
              <h3 className="mb-2 text-xs font-display font-semibold uppercase tracking-wider text-text-muted">
                📍 {city} · {rows.length}
              </h3>
              <ul className="space-y-2">
                {rows.map(({ places: place, tags, note }, i) =>
                  place ? (
                    <li key={place.id ?? i}>
                      <PlaceCard
                        name={place.name}
                        category={place.category}
                        address={place.address}
                        tags={tags ?? undefined}
                        note={note}
                      />
                    </li>
                  ) : null
                )}
              </ul>
            </div>
          ))
        )}
      </section>

      <section>
        <h2 className="mb-3 font-title text-xl font-semibold text-brand">Le mie recensioni</h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-text-muted">Non hai ancora scritto recensioni.</p>
        ) : (
          <ul className="space-y-2">
            {reviews.map((review) => (
              <li key={review.id} className="rounded-card border border-border bg-white p-4 shadow-card">
                <p className="font-display font-semibold text-text">
                  {review.places?.name ?? "Locale sconosciuto"}
                </p>
                <div className="mt-1">
                  <Stars rating={review.rating} />
                </div>
                {review.comment && (
                  <p className="mt-1.5 text-sm text-text-muted">{review.comment}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
