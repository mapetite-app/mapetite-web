"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

// Riga richiudibile del profilo ("Altro"): le cose secondarie restano a un tocco ma non
// riempiono lo schermo. Si apre da sola se l'indirizzo punta a lei o a qualcosa che contiene
// (es. /profilo#cosa-so-di-te dall'assistente, /profilo#profilo-pubblico da Amici).
export default function ProfiloSezione({
  id,
  testId,
  icon,
  title,
  hint,
  children,
}: {
  id: string;
  testId?: string;
  icon: ReactNode;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const sync = () => {
      const el = ref.current;
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (!el || !hash) return;
      const target = document.getElementById(hash);
      if (!target || !(target === el || el.contains(target))) return;
      el.open = true;
      requestAnimationFrame(() => el.scrollIntoView({ block: "start" }));
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  return (
    <details ref={ref} id={id} data-testid={testId} className="group scroll-mt-4 border-t border-border first:border-t-0">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2 active:bg-surface [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center text-brand">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-sm font-semibold text-text">{title}</span>
          {hint && <span className="block truncate text-xs font-sans font-normal text-text-muted">{hint}</span>}
        </span>
        <ChevronDown aria-hidden className="h-4 w-4 shrink-0 text-text-muted transition-transform duration-150 group-open:rotate-180" />
      </summary>
      {/* Il titolo interno del componente è già nella riga: resta solo per i lettori di schermo. */}
      <div className="px-4 pb-4 [&_h2]:sr-only [&>section]:mb-0">{children}</div>
    </details>
  );
}
