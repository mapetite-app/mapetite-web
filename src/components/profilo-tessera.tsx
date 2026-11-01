import type { ReactNode } from "react";

// Tessera della griglia "Le mie cose" nel profilo (stile libreria di Albo): icona, numero, nome.
export const TILE_CLASS =
  "flex min-h-[96px] flex-col justify-between rounded-card border border-[#e8e2d8] bg-white p-3 active:scale-[0.97] transition-transform duration-150";

// Revisore 1/11 (terzo giro): una tessera vuota non mostra "0" o "Nessuna" (numeri morti) ma un invito
// con il gesto da fare ("Segna il primo posto"), in corallo. `invito` vale solo quando count è 0.
export function TileBody({ icon, label, sub, count, invito }: { icon: ReactNode; label: string; sub?: ReactNode; count?: number; invito?: string }) {
  const vuota = invito != null && (count ?? 0) === 0;
  return (
    <>
      <span className="flex items-start justify-between gap-1">
        <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f3efe8] text-brand">{icon}</span>
        {count != null && !vuota && <span className="font-title text-xl font-semibold leading-none text-brand">{count}</span>}
      </span>
      <span className="mt-2 block min-w-0">
        <span className="block font-display text-[13px] font-semibold leading-tight text-text">{label}</span>
        {vuota ? (
          <span data-testid="tessera-invito" className="mt-0.5 block text-[11px] font-sans font-medium leading-tight text-[#b8432a]">{invito} →</span>
        ) : (
          sub && <span className="mt-0.5 block truncate text-[11px] font-sans leading-tight text-text-muted">{sub}</span>
        )}
      </span>
    </>
  );
}
