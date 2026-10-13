import { formatCount, formatRating, type GuideRating } from "@/lib/guide-sources";

// "Cosa dicono le guide": griglia compatta 2 colonne di chip da 44px, sotto il
// verdetto Mapetite (che resta il primo blocco). Voto solo se c'è davvero;
// altrimenti "Cerca ↗", link in uscita alla fonte con nome + città.
export default function GuideRatings({ rows, className = "" }: { rows: GuideRating[]; className?: string }) {
  if (rows.length === 0) return null;
  return (
    <section data-testid="guide" aria-labelledby="guide-titolo" className={className}>
      <div className="flex items-baseline justify-between">
        <h3 id="guide-titolo" className="text-xs font-display font-semibold uppercase tracking-wide text-text-muted">
          Cosa dicono le guide
        </h3>
        <span className="text-[11px] font-sans text-text-muted">Si aprono sul loro sito</span>
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-1.5">
        {rows.map((g) => {
          const hasValue = g.rating != null || g.badge != null;
          const value =
            g.badge ??
            (g.rating != null
              ? `★ ${formatRating(g.rating)}${g.count != null ? ` · ${formatCount(g.count)}` : ""}`
              : null);
          const aria = hasValue
            ? `${g.label}: ${g.badge ?? `${formatRating(g.rating!)} su ${g.scale ?? 5}`}${g.count != null ? `, ${formatCount(g.count)} recensioni` : ""}`
            : `Cerca su ${g.label}`;
          return (
            <li key={g.source}>
              <a
                href={g.url}
                target="_blank"
                rel="noopener noreferrer"
                data-testid={`guida-${g.source}`}
                aria-label={aria}
                className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-white px-2 py-1.5 active:scale-[0.98]"
              >
                <span
                  aria-hidden
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-display font-bold ${hasValue ? "bg-brand text-white" : "bg-brand/10 text-brand"}`}
                >
                  {g.mark}
                </span>
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate text-[13px] font-display font-semibold text-text">{g.label}</span>
                  {value ? (
                    <span className="truncate text-xs font-sans text-text">
                      {value.startsWith("★") ? (
                        <>
                          <span className="text-star">★</span>
                          {value.slice(1)}
                        </>
                      ) : (
                        value
                      )}
                      <span aria-hidden className="text-text-muted"> ↗</span>
                    </span>
                  ) : (
                    <span className="truncate text-xs font-sans text-text-muted">Cerca ↗</span>
                  )}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
