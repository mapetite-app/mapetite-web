"use client";

import Link from "next/link";
import { useOptIn } from "@/lib/beta";

// ?beta=home-salvati: chi ha già dei salvati li ritrova subito in home ("Ritrova", VISIONE.md),
// invece di uno spazio vuoto sotto il marchio. Numeri letti dal server, nessuna chiamata in più.
export default function HomeSaved({ total, want }: { total: number; want: number }) {
  const on = useOptIn("home-salvati");
  if (!on || total === 0) return null;
  return (
    <section data-testid="home-salvati" className="mb-4 rounded-card bg-brand p-4 text-white shadow-card">
      <p className="text-xs font-display font-semibold uppercase tracking-wide text-white/70">La tua mappa</p>
      <p className="mt-1 font-title text-lg font-semibold leading-tight">
        {want > 0
          ? `${want} ${want === 1 ? "posto" : "posti"} da provare`
          : `${total} ${total === 1 ? "posto salvato" : "posti salvati"}`}
      </p>
      <div className="mt-3 flex gap-2">
        <Link
          href="/stasera"
          data-testid="home-salvati-stasera"
          className="flex min-h-11 flex-1 items-center justify-center rounded-pill bg-accent px-3 text-sm font-display font-semibold text-white active:scale-[0.98]"
        >
          Stasera dove andiamo?
        </Link>
        <Link
          href="/mappa?vista=salvati"
          data-testid="home-salvati-tutti"
          className="flex min-h-11 shrink-0 items-center justify-center rounded-pill border border-white/30 px-4 text-sm font-display font-semibold text-white active:scale-[0.98]"
        >
          Salvati · {total}
        </Link>
      </div>
    </section>
  );
}
