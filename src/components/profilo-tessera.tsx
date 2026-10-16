import type { ReactNode } from "react";

// Tessera della griglia "Le mie cose" nel profilo (stile libreria di Albo): icona, numero, nome.
export const TILE_CLASS =
  "flex min-h-[96px] flex-col justify-between rounded-card border border-border bg-surface p-3 active:scale-[0.97] transition-transform duration-150";

export function TileBody({ icon, label, sub, count }: { icon: ReactNode; label: string; sub?: ReactNode; count?: number }) {
  return (
    <>
      <span className="flex items-start justify-between gap-1">
        <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-brand">{icon}</span>
        {count != null && <span className="font-title text-xl font-semibold leading-none text-brand">{count}</span>}
      </span>
      <span className="mt-2 block min-w-0">
        <span className="block font-display text-[13px] font-semibold leading-tight text-text">{label}</span>
        {sub && <span className="mt-0.5 block truncate text-[11px] font-sans leading-tight text-text-muted">{sub}</span>}
      </span>
    </>
  );
}
