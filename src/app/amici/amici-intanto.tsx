import Link from "next/link";
import { ChevronRight } from "lucide-react";
import InvitaAmico from "@/components/invita-amico";
import CondividiLink from "@/components/condividi-link";
import { getCategoryEmoji } from "@/lib/emoji";
import { categoryLabel } from "@/lib/category-label";
import { cityFromAddress } from "@/lib/city";
import { OPINION_DISLIKE, OPINION_LIKE, STATE_TAGS } from "@/lib/tags";
import type { MySavedRow } from "@/lib/raccolte-server";

// Amici quando la parte social non c'è ancora (revisore 2/11: "Gli amici arrivano presto" era un vicolo
// cieco in una demo). Solo cose vere che funzionano già: il proprio link d'invito, i posti dove sei stato
// da mandare a un amico (pagina pubblica /locali/<UUID>, si apre anche senza account) e un link piccolo alla carta del gusto.
// Revisore 2/11 (quarto giro): niente più la riga "Seguire gli amici: in arrivo" (una promessa in una demo).
const DONE = STATE_TAGS[1];
const MAX_CONSIGLI = 5;

export default function AmiciIntanto({ userId, saved }: { userId: string; saved: MySavedRow[] }) {
  // Prima i posti che ti sono piaciuti, poi gli altri dove sei stato; mai quelli che "non fanno per te".
  const consigli = saved
    .filter((r) => r.tags.includes(DONE) && !r.tags.includes(OPINION_DISLIKE))
    .sort((a, b) => Number(b.tags.includes(OPINION_LIKE)) - Number(a.tags.includes(OPINION_LIKE)) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_CONSIGLI);

  return (
    <div data-testid="amici-intanto" className="mt-5">
      <InvitaAmico userId={userId} handle={null} vuoto />

      {consigli.length > 0 && (
        <section aria-labelledby="consigli-titolo" className="-mt-3">
          <h2 id="consigli-titolo" className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">Da consigliare</h2>
          <p className="mt-0.5 text-sm text-text-muted">Posti dove sei stato: mandane uno a chi esce con te.</p>
          <ul data-testid="amici-consigli" className="mt-2 divide-y divide-[#e8e2d8] overflow-hidden rounded-card border border-[#e8e2d8] bg-white">
            {consigli.map((r) => {
              const meta = [categoryLabel(r.category, r.name), cityFromAddress(r.address)].filter(Boolean).join(" · ");
              const piaciuto = r.tags.includes(OPINION_LIKE);
              return (
                <li key={r.placeId} data-testid="amici-consiglio" className="flex items-center gap-3 px-3 py-2.5">
                  <Link href={`/locali/${r.placeId}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-[#e6dfd3] bg-[linear-gradient(160deg,#f6f1e8,#ebe3d6)] text-[22px]">
                      {getCategoryEmoji(r.category, r.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 font-title text-[17px] font-medium leading-tight text-text">{r.name}</span>
                      <span className="block truncate text-[13px] text-text-muted">{[meta, piaciuto ? "👍 ti è piaciuto" : null].filter(Boolean).join(" · ")}</span>
                    </span>
                  </Link>
                  <CondividiLink
                    path={`/locali/${r.placeId}`}
                    title={r.name}
                    text={`Ci sono stato e te lo consiglio: ${r.name}${cityFromAddress(r.address) ? `, ${cityFromAddress(r.address)}` : ""}.`}
                    cosa="locale"
                    label="Manda"
                    testId="amici-consiglio-manda"
                    className="shrink-0"
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Il gusto sta nel Profilo (revisore 2/11, terzo giro: era in due posti): qui solo un link piccolo alla carta. */}
      <Link href="/profilo/gusto" data-testid="amici-carta-gusto" className="mt-3 inline-flex min-h-11 items-center gap-1 text-[13px] font-medium text-brand">
        Manda agli amici la tua carta del gusto <ChevronRight aria-hidden size={14} />
      </Link>

    </div>
  );
}
