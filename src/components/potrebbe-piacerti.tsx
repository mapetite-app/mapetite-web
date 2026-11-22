"use client";

import PlacePhoto from "@/components/place-photo";
import { getCategoryEmoji } from "@/lib/emoji";
import { nomeLeggibile } from "@/lib/nome-leggibile";

// Proposta 78 "Potrebbe piacerti anche" (Lorenzo, 22/11 sera): in fondo alla scheda, 2–4 posti simili che
// scorrono di lato. Foto solo se è già arrivata con la ricerca (stessa foto della card: niente quota in più),
// altrimenti l'emoji del tipo. Un tocco apre la scheda di quel posto.
export type PostoPiacerti = {
  id: string;
  name: string;
  category: string | null;
  types?: string[] | null;
  photoRef?: string | null;
  perche: string;
};

export default function PotrebbePiacerti({ posti, onOpen }: { posti: PostoPiacerti[]; onOpen: (id: string) => void }) {
  if (posti.length < 2) return null;
  return (
    <section data-testid="potrebbe-piacerti" aria-labelledby="potrebbe-piacerti-titolo" className="mt-7">
      <h3 id="potrebbe-piacerti-titolo" className="mx-[22px] font-display text-base font-semibold text-brand">Potrebbe piacerti anche</h3>
      <ul style={{ scrollSnapType: "x mandatory", scrollPaddingInline: 22 }} className="mt-2.5 flex gap-3 overflow-x-auto px-[22px] pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {posti.map((p) => {
          const emoji = getCategoryEmoji(p.category, p.name, p.types);
          return (
            <li key={p.id} className="w-[148px] shrink-0 snap-start">
              <button
                type="button"
                data-testid="simile"
                onClick={() => onOpen(p.id)}
                className="block w-full text-left active:scale-[0.98] transition-transform"
              >
                <span className="relative flex h-[100px] w-full items-center justify-center overflow-hidden rounded-[16px] bg-brand/[0.07] text-4xl ring-1 ring-inset ring-border">
                  {p.photoRef
                    ? <PlacePhoto photoRef={p.photoRef} alt="" className="h-full w-full object-cover" fallback={<span aria-hidden>{emoji}</span>} />
                    : <span aria-hidden>{emoji}</span>}
                </span>
                <span className="mt-1.5 line-clamp-2 min-h-[2.6em] font-display text-[14px] font-semibold leading-snug text-text">{nomeLeggibile(p.name)}</span>
                <span data-testid="simile-perche" className="mt-0.5 block truncate text-xs font-sans text-text-muted">{p.perche}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
