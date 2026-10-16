"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Bookmark, Earth, LogIn, Sparkles, UserRound, UsersRound, type LucideIcon } from "lucide-react";
import { logout } from "@/lib/supabase/actions";
import { withNext } from "@/lib/next-path";

// Barra principale (piano 6.4): Assistente, Salvati, Mappa (al centro, tonda e più grande), Amici, Profilo.
// Lorenzo 16/10: la mappa al centro, come un mappamondo, così si capisce subito che è la mappa.
// "Dai un feedback" ed "Esci" stanno nel profilo (sezione "Account"). Da non registrati
// l'ultima voce è "Entra": porta all'accesso e poi riporta alla pagina dov'eri.

// "Entra" riporta alla pagina dov'eri (es. un locale condiviso, Stasera, Importa).
// Dalla mappa e dalla home no: dopo l'accesso si va comunque alla mappa.
// Da /login o /signup si conserva il `next` già presente.
function entraHref(pathname: string, search: string | null): string {
  if (pathname === "/login" || pathname === "/signup") {
    return withNext("/login", new URLSearchParams(search ?? "").get("next"));
  }
  if (pathname === "/" || pathname === "/mappa" || pathname.startsWith("/mappa/") || pathname.startsWith("/onboarding") || pathname.startsWith("/invito/")) return "/login";
  return withNext("/login", `${pathname}${search ? `?${search}` : ""}`);
}

// Link della voce "Salvati": la mappa aperta su "I miei salvati" (letto da map-view).
const SAVED_HREF = "/mappa?vista=salvati";

type Voce = {
  id: "esplora" | "assistente" | "salvati" | "amici" | "profilo" | "entra";
  label: string;
  href: string;
  Icon: LucideIcon;
  active: boolean;
};

const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

function voci(pathname: string, vista: string | null, search: string | null, loggedIn: boolean): Voce[] {
  const onMap = under(pathname, "/mappa");
  // Salvati: la mappa sui salvati e le pagine che nascono dai salvati (raccolte, "Stasera").
  const savedActive = (onMap && vista === "salvati") || under(pathname, "/raccolte") || under(pathname, "/stasera");
  return [
    { id: "assistente", label: "Assistente", href: "/assistente", Icon: Sparkles, active: under(pathname, "/assistente") },
    { id: "salvati", label: "Salvati", href: SAVED_HREF, Icon: Bookmark, active: savedActive },
    // Mappa (id "esplora"): la mappa e la home di ricerca. Al centro della barra.
    { id: "esplora", label: "Mappa", href: "/mappa", Icon: Earth, active: (onMap && !savedActive) || pathname === "/" },
    // Amici: il feed, i profili delle persone (/u/<nome>) e le liste di gruppo (/gruppi).
    { id: "amici", label: "Amici", href: "/amici", Icon: UsersRound, active: under(pathname, "/amici") || under(pathname, "/u") || under(pathname, "/gruppi") },
    loggedIn
      ? { id: "profilo", label: "Profilo", href: "/profilo", Icon: UserRound, active: under(pathname, "/profilo") || under(pathname, "/me") }
      : { id: "entra", label: "Entra", href: entraHref(pathname, search), Icon: LogIn, active: under(pathname, "/login") || under(pathname, "/signup") || under(pathname, "/profilo") },
  ];
}

export default function NavBar({ userId }: { userId: string | null }) {
  // useSearchParams va dentro Suspense; il fallback è la stessa barra senza i parametri.
  return (
    <Suspense fallback={<NavBarInner userId={userId} vista={null} search={null} />}>
      <NavBarWithParams userId={userId} />
    </Suspense>
  );
}

function NavBarWithParams({ userId }: { userId: string | null }) {
  const params = useSearchParams();
  return <NavBarInner userId={userId} vista={params.get("vista")} search={params.toString()} />;
}

function NavBarInner({ userId, vista, search }: { userId: string | null; vista: string | null; search: string | null }) {
  const pathname = usePathname();
  const items = voci(pathname, vista, search, !!userId);

  return (
    <>
      {/* ── Mobile: barra fissa in basso, da app ──
          Altezza = h-16 (64px, comoda per il pollice) + pb env(safe-area-inset-bottom).
          VALORE GEMELLO: --nav-height-mobile in globals.css (4rem + safe area) deve restare
          sincronizzato con h-16. Se cambi l'altezza qui, aggiorna anche la variabile. */}
      <nav
        aria-label="Navigazione principale"
        data-testid="barra"
        className="fixed bottom-0 left-0 right-0 z-50 transform-gpu border-t border-border/70 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="mx-auto grid h-16 max-w-lg grid-cols-5">
          {items.map(({ id, label, href, Icon, active }) => {
            const ai = id === "assistente";
            if (id === "esplora") {
              // Mappa: cerchio più grande che sporge sopra la barra, con il mappamondo.
              return (
                <li key={id} className="flex">
                  <Link
                    href={href}
                    data-testid={`barra-${id}`}
                    aria-current={active ? "page" : undefined}
                    className={`group flex flex-1 flex-col items-center justify-end gap-1 pb-2 select-none outline-none [-webkit-tap-highlight-color:transparent] ${active ? "text-brand" : "text-text-muted"}`}
                  >
                    <span
                      aria-hidden
                      className={`-mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-float ring-4 transition-transform duration-200 group-active:scale-90 ${active ? "ring-accent/30" : "ring-white"}`}
                    >
                      <Icon className="h-7 w-7" strokeWidth={active ? 2.25 : 1.9} />
                    </span>
                    <span className={`text-[11px] leading-none font-display tracking-[0.01em] ${active ? "font-semibold" : "font-medium"}`}>
                      {label}
                    </span>
                  </Link>
                </li>
              );
            }
            return (
              <li key={id} className="flex">
                <Link
                  href={href}
                  data-testid={`barra-${id}`}
                  aria-current={active ? "page" : undefined}
                  className={`group flex flex-1 flex-col items-center justify-center gap-1 select-none outline-none [-webkit-tap-highlight-color:transparent] transition-colors duration-150 ${
                    active ? "text-brand" : "text-text-muted"
                  }`}
                >
                  {/* Indicatore della voce attiva: pillola teal chiara dietro l'icona (dimensioni fisse: nessun salto). */}
                  <span
                    aria-hidden
                    className={`relative flex h-8 w-14 items-center justify-center rounded-pill transition-[background-color,transform] duration-200 group-active:scale-90 ${
                      active ? "bg-brand/10" : "bg-transparent"
                    }`}
                  >
                    <Icon
                      className={`h-[22px] w-[22px] ${ai && !active ? "text-accent" : ""}`}
                      strokeWidth={active ? 2.25 : 1.75}
                      fill={active && id === "salvati" ? "currentColor" : "none"}
                    />
                  </span>
                  <span className={`text-[11px] leading-none font-display tracking-[0.01em] ${active ? "font-semibold" : "font-medium"}`}>
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── Desktop: barra fissa in alto ── */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-surface border-b border-border shadow-card hidden md:flex items-center justify-between px-6">
        <Link href="/" className="text-lg font-display font-semibold text-brand shrink-0">
          Mapetite
        </Link>

        <nav aria-label="Navigazione principale" className="flex items-center gap-1">
          {items
            .filter((v) => v.id !== "entra")
            .map(({ id, label, href, Icon, active }) => (
              <Link
                key={id}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-sm font-display transition-colors duration-150 ${
                  active ? "text-white bg-brand" : "text-text-muted hover:text-text hover:bg-brand/10"
                }`}
              >
                <Icon aria-hidden className={`h-5 w-5 ${id === "assistente" && !active ? "text-accent" : ""}`} strokeWidth={1.75} />
                {label}
              </Link>
            ))}
        </nav>

        {userId ? (
          <form action={logout}>
            <button
              type="submit"
              className="rounded-btn bg-brand text-white px-4 py-2 text-sm font-display font-semibold hover:opacity-90 transition-opacity duration-150"
            >
              Esci
            </button>
          </form>
        ) : (
          <Link
            href={entraHref(pathname, search)}
            className="rounded-btn bg-brand text-white px-4 py-2 text-sm font-display font-semibold hover:opacity-90 transition-opacity duration-150"
          >
            Entra
          </Link>
        )}
      </header>
    </>
  );
}
