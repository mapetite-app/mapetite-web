import Link from "next/link";
import { getCategoryEmoji } from "@/lib/emoji";
import { categoryLabel } from "@/lib/category-label";

// Elenco numerato di una classifica per città (profilo e pagina pubblica). Primi tre in corallo.
export type ClassificaVoce = { id: string; name: string; category: string | null; href: string };

export default function ClassificaLista({ voci, testId = "classifica-voce" }: { voci: ClassificaVoce[]; testId?: string }) {
  return (
    <ol className="space-y-1.5">
      {voci.map((v, i) => (
        <li key={v.id}>
          <Link
            href={v.href}
            data-testid={testId}
            className="flex min-h-14 items-center gap-3 rounded-card border border-border bg-white px-3 py-2 active:scale-[0.99] transition-transform duration-150"
          >
            <span className={`w-6 shrink-0 text-center font-title text-xl font-semibold ${i < 3 ? "text-accent" : "text-text-muted"}`}>{i + 1}</span>
            <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-btn bg-accent-light text-xl">{getCategoryEmoji(v.category, v.name)}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-[15px] font-semibold text-text">{v.name}</span>
              {categoryLabel(v.category) && <span className="block truncate text-xs text-text-muted">{categoryLabel(v.category)}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
