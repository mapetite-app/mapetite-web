import Link from "next/link";
import { getCategoryEmoji } from "@/lib/emoji";
import { categoryLabel } from "@/lib/category-label";
import { cityFromAddress } from "@/lib/city";
import { isStateTag } from "@/lib/tags";
import { quartiereDi } from "@/lib/scaffali-salvati";

// Un posto di un'altra persona (profilo pubblico, feed degli amici). Solo dati pubblici:
// nome, tipo, città, stato e raccolte. Mai la nota privata (non arriva nemmeno dal database).
type Spot = {
  place_id: string;
  name: string;
  category: string | null;
  address: string | null;
  tags: string[] | null;
  lat?: number | null;
  lng?: number | null;
};

// Revisore 14/11: come nei Salvati, il quartiere (Roma e Milano) prima della città.
function meta(s: Spot): string {
  const q = s.lat != null && s.lng != null ? quartiereDi({ lat: Number(s.lat), lng: Number(s.lng) }) : null;
  return [categoryLabel(s.category), q ?? cityFromAddress(s.address)].filter(Boolean).join(" · ");
}

// Revisore 14/11 (secondo giro): lo stato era detto in tre modi (testo "· Provato", pillola corallo, pillola teal
// dei Salvati). Ora una sola forma, quella dei Salvati: teal per chi c'è stato, grigio per da provare.
const STATO = "inline-flex h-[22px] shrink-0 items-center gap-1 whitespace-nowrap rounded-pill px-2 text-[11.5px] font-semibold";
export function StatoPillola({ provato }: { provato: boolean }) {
  return (
    <span data-testid="posto-persona-stato" className={`${STATO} ${provato ? "bg-[#e3eded] text-brand" : "bg-[#f0f2f2] font-medium text-[#6b7075]"}`}>
      <span aria-hidden className="text-[10px] leading-none">{provato ? "✓" : "📌"}</span>
      {provato ? "Provato" : "Da provare"}
    </span>
  );
}

/** Riga compatta per le liste del profilo. */
// showState=false: sotto un titolo che dice già lo stato ("Di recente", "Da provare") la pillola è un doppione.
export function PostoRiga({ spot, verdict = null, showState = true }: { spot: Spot; verdict?: string | null; showState?: boolean }) {
  const visited = !!spot.tags?.includes("Già visitato");
  const raccolte = (spot.tags ?? []).filter((t) => !isStateTag(t)).slice(0, 2);
  return (
    <Link
      href={`/locali/${spot.place_id}`}
      data-testid="posto-persona"
      className="flex items-center gap-3 rounded-card border border-[#e3e7e7] bg-white p-3 shadow-card active:scale-[0.99] transition-transform duration-150"
    >
      {/* Revisore 14/11: stesso linguaggio dei Salvati e del profilo (riquadro grigio, nome in serif, verdetto in corsivo). */}
      <span aria-hidden className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px] bg-[#f6f7f7] text-[26px] leading-none">
        {getCategoryEmoji(spot.category, spot.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-[family-name:var(--font-newsreader)] text-[19px] font-medium leading-tight tracking-[-0.01em] text-text">{spot.name}</span>
        {meta(spot) && <span className="mt-0.5 block truncate text-[13px] font-sans text-text-muted">{meta(spot)}</span>}
        {verdict && <span data-testid="posto-persona-verdetto" className="mt-1 line-clamp-2 font-[family-name:var(--font-newsreader)] text-[15px] italic leading-snug text-[#4a4f55]">{verdict}</span>}
        {(showState || raccolte.length > 0) && (
          <span className="mt-1 flex flex-wrap gap-1.5">
            {showState && <StatoPillola provato={visited} />}
            {raccolte.map((t) => (
              <span key={t} className="inline-flex h-[22px] max-w-full items-center truncate rounded-pill bg-surface px-2 text-[11.5px] font-medium text-brand">
                {t}
              </span>
            ))}
          </span>
        )}
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
