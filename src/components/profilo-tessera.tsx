import type { ReactNode } from "react";

// Tessera della griglia "Le mie cose" nel profilo (stile libreria di Albo): icona, numero, nome.
// Revisore 2/11 (quarto giro): altezza fissa e titolo su una riga, così le tessere di una fila hanno
// i titoli alla stessa altezza ("Carta del gusto" andava a capo e spostava tutto).
export const TILE_CLASS =
  "flex h-[108px] flex-col overflow-hidden rounded-card border border-[#e8e2d8] bg-white p-3 active:scale-[0.97] transition-transform duration-150";

// Revisore 1/11 (terzo giro): una tessera vuota non mostra "0" o "Nessuna" (numeri morti) ma un invito
// con il gesto da fare ("Segna il primo posto"). `invito` vale solo quando count è 0.
// Revisore 2/11: l'invito in corallo sembrava un errore → grigio come gli altri sottotitoli; titoli in
// Inter medio (non Poppins grassetto accanto al serif dei numeri).
export function TileBody({ icon, label, sub, count, invito }: { icon: ReactNode; label: string; sub?: ReactNode; count?: number; invito?: string }) {
  const vuota = invito != null && (count ?? 0) === 0;
  return (
    <>
      <span className="flex items-start justify-between gap-1">
        <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f3efe8] text-brand">{icon}</span>
        {count != null && !vuota && <span className="font-title text-xl font-semibold leading-none text-brand">{count}</span>}
      </span>
      {/* Titolo sempre alla stessa altezza (subito sotto l'icona), sottotitolo al massimo su 2 righe. */}
      <span className="mt-2.5 block min-w-0">
        <span data-testid="tessera-titolo" className="block truncate font-sans text-[14px] font-medium leading-tight text-text">{label}</span>
        {vuota ? (
          <span data-testid="tessera-invito" className="mt-0.5 line-clamp-2 block text-[11px] font-sans leading-tight text-text-muted">{invito}</span>
        ) : (
          sub && <span className="mt-0.5 block truncate text-[11px] font-sans leading-tight text-text-muted">{sub}</span>
        )}
      </span>
    </>
  );
}
