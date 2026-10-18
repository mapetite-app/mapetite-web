import Link from "next/link";
import { getCategoryEmoji } from "@/lib/emoji";
import { categoryLabel } from "@/lib/category-label";
import { cityFromAddress } from "@/lib/city";
import { isStateTag } from "@/lib/tags";

// Un posto di un'altra persona (profilo pubblico, feed degli amici). Solo dati pubblici:
// nome, tipo, città, stato e raccolte. Mai la nota privata (non arriva nemmeno dal database).
type Spot = {
  place_id: string;
  name: string;
  category: string | null;
  address: string | null;
  tags: string[] | null;
};

function meta(s: Spot): string {
  return [categoryLabel(s.category), cityFromAddress(s.address)].filter(Boolean).join(" · ");
}

/** Riga compatta per le liste del profilo. */
export function PostoRiga({ spot }: { spot: Spot }) {
  const visited = !!spot.tags?.includes("Già visitato");
  const raccolte = (spot.tags ?? []).filter((t) => !isStateTag(t)).slice(0, 2);
  return (
    <Link
      href={`/locali/${spot.place_id}`}
      data-testid="posto-persona"
      className="flex items-center gap-3 rounded-card border border-border bg-white p-3 shadow-card active:scale-[0.99] transition-transform duration-150"
    >
      <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn bg-accent-light text-xl">
        {getCategoryEmoji(spot.category, spot.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-[15px] font-semibold text-text">{spot.name}</span>
        {meta(spot) && <span className="mt-0.5 block truncate text-xs font-sans text-text-muted">{meta(spot)}</span>}
        {raccolte.length > 0 && (
          <span className="mt-1 flex flex-wrap gap-1">
            {raccolte.map((t) => (
              <span key={t} className="max-w-full truncate rounded-pill bg-surface px-2 py-0.5 text-[11px] font-display font-medium text-brand">
                {t}
              </span>
            ))}
          </span>
        )}
      </span>
      <span className={`shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-display font-semibold ${visited ? "bg-accent-light text-accent" : "bg-brand/10 text-brand"}`}>
        {visited ? "✓ Visitato" : "📌 Da provare"}
      </span>
    </Link>
  );
}

/** Card a tutta altezza per il feed (stile Places: fondo scuro, nome grande, tipo in maiuscoletto). */
export function PostoCard({ spot, verdict = null }: { spot: Spot; verdict?: string | null }) {
  const visited = !!spot.tags?.includes("Già visitato");
  const city = cityFromAddress(spot.address);
  const kind = categoryLabel(spot.category);
  return (
    <Link
      href={`/locali/${spot.place_id}`}
      data-testid="card-attivita"
      className="relative flex min-h-40 w-[78%] max-w-[280px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-card bg-brand p-4 text-white shadow-card active:scale-[0.99] transition-transform duration-150"
    >
      <span aria-hidden className="pointer-events-none absolute -right-3 -bottom-4 text-[88px] leading-none opacity-25">
        {getCategoryEmoji(spot.category, spot.name)}
      </span>
      <span className="relative min-w-0">
        <span className="line-clamp-2 font-title text-xl font-semibold leading-tight">{spot.name}</span>
        {kind && <span className="mt-1 block truncate text-[11px] font-display font-semibold uppercase tracking-wider text-white/70">{kind}</span>}
        {/* Come la riga di descrizione di Places: il verdetto Mapetite, se c'è già. */}
        {verdict && <span data-testid="card-attivita-verdetto" className="mt-1.5 line-clamp-2 text-[13px] font-sans leading-snug text-white/90">{verdict}</span>}
      </span>
      <span className="relative flex items-center gap-2">
        <span className={`rounded-pill px-2.5 py-1 text-[11px] font-display font-semibold ${visited ? "bg-accent text-white" : "bg-white/15 text-white"}`}>
          {visited ? "✓ Provato" : "📌 Vuole provarlo"}
        </span>
        {city && <span className="truncate text-xs font-sans text-white/75">{city}</span>}
      </span>
    </Link>
  );
}
