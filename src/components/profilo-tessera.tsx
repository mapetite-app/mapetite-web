import type { ReactNode } from "react";

// Tessera della griglia "Le mie cose" nel profilo (stile libreria di Albo): icona, nome con il numero, sottotitolo.
// Revisore 2/11 (quarto giro): altezza fissa e titolo su una riga, così le tessere di una fila hanno
// i titoli alla stessa altezza ("Carta del gusto" andava a capo e spostava tutto).
// Revisore 2/11 (quinto giro): 5 tessere in tre colonne lasciavano un buco. Ora due colonne di tessere
// orizzontali (icona a sinistra) e, se sono dispari, l'ultima a tutta larghezza (GRIGLIA_CLASS); il
// numero sta accanto al nome ("Raccolte 2", come le pillole dei Salvati), non piccolo in alto a destra.
export const GRIGLIA_CLASS = "grid grid-cols-2 gap-2 [&>:last-child:nth-child(odd)]:col-span-2";
export const TILE_CLASS =
  "flex h-[68px] min-w-0 items-center gap-2.5 overflow-hidden rounded-card border border-[#e8e2d8] bg-white px-3 active:scale-[0.97] transition-transform duration-150";

// Revisore 1/11 (terzo giro): una tessera vuota non mostra "0" o "Nessuna" (numeri morti) ma un invito
// con il gesto da fare ("Segna il primo posto"). `invito` vale solo quando count è 0.
// Revisore 2/11: l'invito in corallo sembrava un errore → grigio come gli altri sottotitoli; titoli in
// Inter medio (non Poppins grassetto).
export function TileBody({ icon, label, sub, count, invito }: { icon: ReactNode; label: string; sub?: ReactNode; count?: number; invito?: string }) {
  const vuota = invito != null && (count ?? 0) === 0;
  return (
    <>
      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f3efe8] text-brand">{icon}</span>
      <span className="block min-w-0 flex-1">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span data-testid="tessera-titolo" className="block min-w-0 truncate font-sans text-[14px] font-medium leading-tight text-text">{label}</span>
          {count != null && !vuota && <span data-testid="tessera-numero" className="shrink-0 font-sans text-[14px] font-semibold leading-tight text-brand">{count}</span>}
        </span>
        {vuota ? (
          <span data-testid="tessera-invito" className="mt-0.5 line-clamp-2 block text-[12px] font-sans leading-tight text-text-muted">{invito}</span>
        ) : (
          sub && <span className="mt-0.5 block truncate text-[12px] font-sans leading-tight text-text-muted">{sub}</span>
        )}
      </span>
    </>
  );
}
