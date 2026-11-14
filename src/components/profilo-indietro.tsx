"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

// Freccia Indietro sul profilo di un amico (revisore 14/11): chi arriva da Amici (o da un'altra pagina
// dell'app) torna dove era; chi apre il link da fuori va ad Amici.
export default function ProfiloIndietro() {
  return (
    <Link
      href="/amici"
      data-testid="profilo-indietro"
      aria-label="Indietro"
      onClick={(e) => {
        let interno = false;
        try { interno = !!document.referrer && new URL(document.referrer).origin === window.location.origin; } catch {}
        if (interno && window.history.length > 1) { e.preventDefault(); window.history.back(); }
      }}
      className="-ml-2 inline-flex min-h-11 items-center gap-0.5 px-2 text-[15px] font-display font-semibold text-brand active:opacity-60"
    >
      <ChevronLeft size={22} strokeWidth={2.25} aria-hidden /> Amici
    </Link>
  );
}
