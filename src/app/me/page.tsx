import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CUISINES, OCCASIONS, ATMOSPHERES, PRICE_RANGES } from "@/lib/preferences";

export default async function MePage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    redirect("/login");
  }

  const user = data.user;

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed, cuisines, occasions, atmospheres, price_range")
    .eq("id", user.id)
    .single();

  if (!profile?.onboarding_completed) {
    redirect("/onboarding");
  }

  const savedCuisines: string[] = profile.cuisines ?? [];
  const savedOccasions: string[] = profile.occasions ?? [];
  const savedAtmospheres: string[] = profile.atmospheres ?? [];
  const savedPriceRange: string | null = profile.price_range ?? null;

  const cuisineLabels = CUISINES.filter((c) => savedCuisines.includes(c.value));
  const occasionLabels = OCCASIONS.filter((o) => savedOccasions.includes(o.value));
  const atmosphereLabels = ATMOSPHERES.filter((a) => savedAtmospheres.includes(a.value));
  const priceLabel = PRICE_RANGES.find((p) => p.value === savedPriceRange) ?? null;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-2 text-2xl font-display font-bold text-text">
        Il tuo profilo
      </h1>
      <p className="text-text-muted">Sei loggato come:</p>
      <p className="mt-1 text-lg font-sans font-medium text-text">
        {user.email}
      </p>

      <section className="mt-10">
        <h2 className="mb-6 text-lg font-display font-semibold text-text">
          Le tue preferenze
        </h2>

        <div className="space-y-5">
          <div>
            <p className="mb-2 text-xs font-display font-semibold tracking-widest text-accent">
              CUCINE
            </p>
            {cuisineLabels.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {cuisineLabels.map((c) => (
                  <span
                    key={c.value}
                    className="inline-flex items-center gap-1 rounded-pill bg-accent-light px-3 py-1 text-sm font-display font-semibold text-accent"
                  >
                    {c.emoji} {c.label}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm font-sans text-text-muted">Nessuna selezione</p>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-display font-semibold tracking-widest text-accent">
              OCCASIONI
            </p>
            {occasionLabels.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {occasionLabels.map((o) => (
                  <span
                    key={o.value}
                    className="inline-flex items-center gap-1 rounded-pill bg-accent-light px-3 py-1 text-sm font-display font-semibold text-accent"
                  >
                    {o.emoji} {o.label}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm font-sans text-text-muted">Nessuna selezione</p>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-display font-semibold tracking-widest text-accent">
              ATMOSFERE
            </p>
            {atmosphereLabels.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {atmosphereLabels.map((a) => (
                  <span
                    key={a.value}
                    className="inline-flex items-center gap-1 rounded-pill bg-accent-light px-3 py-1 text-sm font-display font-semibold text-accent"
                  >
                    {a.emoji} {a.label}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm font-sans text-text-muted">Nessuna selezione</p>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-display font-semibold tracking-widest text-accent">
              PREZZO
            </p>
            {priceLabel ? (
              <span className="inline-flex items-center gap-1 rounded-pill bg-accent-light px-3 py-1 text-sm font-display font-semibold text-accent">
                {priceLabel.value} — {priceLabel.description}
              </span>
            ) : (
              <p className="text-sm font-sans text-text-muted">Nessuna selezione</p>
            )}
          </div>
        </div>
      </section>

      <div className="mt-10">
        <Link
          href="/me/preferenze"
          className="inline-block rounded-btn bg-brand px-5 py-2.5 text-sm font-display font-semibold text-white hover:opacity-90 active:scale-95"
        >
          Modifica preferenze
        </Link>
      </div>
    </div>
  );
}
