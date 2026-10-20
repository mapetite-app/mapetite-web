import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CUISINES, OCCASIONS, ATMOSPHERES, PRICE_RANGES } from "@/lib/preferences";
import { capito, dieteValide, pulisciMappa } from "@/lib/mappa-gusto";

export default async function MePage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    redirect("/login?next=%2Fme");
  }

  const user = data.user;

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed, cuisines, occasions, atmospheres, price_range")
    .eq("id", user.id)
    .single();
  // Mappa del gusto (sprint 25/10): letta a parte, senza la colonna la sezione resta il solo invito.
  const { data: extra } = await supabase.from("profiles").select("gusto, gusti_ricordati, city").eq("id", user.id).maybeSingle();

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

  const mappa = pulisciMappa((extra as { gusto?: unknown } | null)?.gusto, () => true);
  const fatta = mappa.zone.length + mappa.su.length + mappa.giu.length > 0 || mappa.scoperta != null;
  const righe = fatta
    ? capito(mappa, {
        citta: ((extra as { city?: string | null } | null)?.city) ?? null,
        priceRange: profile.price_range ?? null,
        diete: dieteValide((extra as { gusti_ricordati?: unknown } | null)?.gusti_ricordati),
        occasions: OCCASIONS.filter((o) => (profile.occasions ?? []).includes(o.value)),
      })
    : [];

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-2 text-2xl font-display font-bold text-text">
        Il tuo profilo
      </h1>
      <p className="text-text-muted">Sei loggato come:</p>
      <p className="mt-1 text-lg font-sans font-medium text-text">
        {user.email}
      </p>

      <section data-testid="me-mappa-gusto" className="mt-8 rounded-card border border-border bg-white p-4 shadow-card">
        <h2 className="text-xs font-display font-semibold uppercase tracking-widest text-accent">La tua mappa del gusto</h2>
        {fatta ? (
          <ul className="mt-2 space-y-1.5">
            {righe.map((r) => (
              <li key={r.chiave} className="flex gap-2 text-[15px] font-sans text-text"><span aria-hidden>{r.emoji}</span>{r.testo}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm font-sans text-text">Un minuto: zone, tipi di posto che ti piacciono, famosi o chicche. Da lì ricerca e verdetti parlano di te.</p>
        )}
        <Link href="/onboarding" className="mt-3 inline-flex min-h-11 items-center rounded-pill bg-accent px-4 text-sm font-display font-semibold text-white active:scale-95">
          {fatta ? "Rifalla" : "✨ Falla adesso"}
        </Link>
      </section>

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
        <Link href="/profilo#cosa-so-di-te" className="mt-3 flex min-h-10 items-center text-sm font-display font-semibold text-accent">
          Cosa ricorda l’assistente di te →
        </Link>
      </div>
    </div>
  );
}
