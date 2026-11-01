"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

// Riga richiudibile del profilo: le cose secondarie restano a un tocco ma non riempiono lo
// schermo. Si apre da sola se l'indirizzo punta a lei o a qualcosa che contiene
// (es. /profilo#cosa-so-di-te dall'assistente, /profilo#profilo-pubblico da Amici), anche dentro
// "Impostazioni" (si aprono tutte e due), e quando si tocca un link "#id" che porta a lei.
// pannello: chiusa non si vede per niente; la apre solo il suo ingresso (es. la tessera "Raccolte"),
// così nella pagina non c'è un doppione della tessera. Aperta, la riga in cima la richiude.
export default function ProfiloSezione({
  id,
  testId,
  icon,
  title,
  hint,
  aperta = false,
  pannello = false,
  children,
}: {
  id: string;
  testId?: string;
  icon: ReactNode;
  title: string;
  hint?: string;
  aperta?: boolean;
  pannello?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const apri = (hash: string) => {
      const el = ref.current;
      if (!el || !hash) return;
      const target = document.getElementById(hash);
      if (!target || !(target === el || el.contains(target))) return;
      el.open = true;
      requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
    };
    const sync = () => apri(decodeURIComponent(window.location.hash.slice(1)));
    // Un secondo tocco sulla stessa tessera non cambia l'indirizzo (niente hashchange): si guarda il link.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href^='#']");
      const hash = a?.getAttribute("href")?.slice(1);
      if (hash && decodeURIComponent(hash) === decodeURIComponent(window.location.hash.slice(1))) apri(decodeURIComponent(hash));
    };
    sync();
    window.addEventListener("hashchange", sync);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", sync);
      document.removeEventListener("click", onClick);
    };
  }, []);

  // Niente "group" sulla riga: dentro "Impostazioni" le righe sono annidate e group-open
  // farebbe girare le frecce di tutte quando se ne apre una.
  const box = pannello
    ? "mb-6 overflow-hidden rounded-card border border-border bg-white [&:not([open])]:hidden"
    : "border-t border-border first:border-t-0";
  return (
    <details ref={ref} id={id} data-testid={testId} open={aperta || undefined} suppressHydrationWarning className={`scroll-mt-4 [&[open]>summary>svg]:rotate-180 ${box}`}>
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2 active:bg-surface [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center text-brand">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className={pannello ? "block font-title text-xl text-brand" : "block font-display text-sm font-semibold text-text"}>{title}</span>
          {hint && <span className="block truncate text-xs font-sans font-normal text-text-muted">{hint}</span>}
        </span>
        <ChevronDown aria-hidden className="h-4 w-4 shrink-0 text-text-muted transition-transform duration-150" />
      </summary>
      {/* Il titolo interno del componente è già nella riga: resta solo per i lettori di schermo. */}
      <div className="px-4 pb-4 [&_h2]:sr-only [&>section]:mb-0">{children}</div>
    </details>
  );
}
