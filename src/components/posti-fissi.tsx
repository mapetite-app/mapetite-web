import Link from "next/link";
import { getCategoryEmoji } from "@/lib/emoji";
import CondividiLink from "@/components/condividi-link";

// "I tuoi posti fissi" (PROPOSTE.md, proposta 8): i locali dove sei tornato almeno 2 volte.
// Compare solo quando ce n'è almeno uno; un solo pulsante per proporli agli amici.
export type PostoFisso = { id: string; name: string; category: string | null; visite: number };

const MAX = 5;

export default function PostiFissi({ posti, handle }: { posti: PostoFisso[]; handle: string | null }) {
  if (posti.length === 0) return null;
  const top = posti.slice(0, MAX);
  const nomi = top.map((p) => p.name).join(", ");
  return (
    <section aria-labelledby="posti-fissi-titolo" data-testid="posti-fissi" className="mb-8">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 id="posti-fissi-titolo" className="text-xs font-display font-semibold uppercase tracking-wider text-text-muted">I tuoi posti fissi</h2>
        <CondividiLink
          path={handle ? `/u/${handle}` : "/"}
          title="I miei posti fissi"
          text={`I miei posti fissi: ${nomi}. Li trovi su Mapetite.`}
          cosa="profilo"
          label="Proponi"
          testId="posti-fissi-condividi"
        />
      </div>
      <ul className="overflow-hidden rounded-card border border-border bg-white">
        {top.map((p, i) => (
          <li key={p.id} className={i > 0 ? "border-t border-border" : ""}>
            <Link href={`/mappa?salvato=${p.id}`} data-testid="posto-fisso" className="flex min-h-14 items-center gap-3 px-4 py-2 active:bg-surface">
              <span aria-hidden className="text-xl">{getCategoryEmoji(p.category, p.name)}</span>
              <span className="min-w-0 flex-1 truncate font-display text-sm font-semibold text-text">{p.name}</span>
              <span className="shrink-0 text-xs font-display font-semibold text-accent">↻ {p.visite} volte</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
