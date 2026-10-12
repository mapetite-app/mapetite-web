"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Bookmark } from "lucide-react";
import { logout } from "@/lib/supabase/actions";
import { FEEDBACK_EMAIL, feedbackMailto } from "@/lib/feedback";

function MapIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.5}
      className="w-6 h-6"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z"
      />
    </svg>
  );
}

function ProfileIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.5}
      className="w-6 h-6"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
      />
    </svg>
  );
}

function AuthIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="w-6 h-6"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75"
      />
    </svg>
  );
}

function FeedbackIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="w-6 h-6"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
      />
    </svg>
  );
}

// Link della voce "Salvati": la mappa aperta su "I miei salvati" (letto da map-view).
const SAVED_HREF = "/mappa?vista=salvati";

export default function NavBar({ userId }: { userId: string | null }) {
  // useSearchParams va dentro Suspense; il fallback è la stessa barra senza i parametri.
  return (
    <Suspense fallback={<NavBarInner userId={userId} vista={null} />}>
      <NavBarWithParams userId={userId} />
    </Suspense>
  );
}

function NavBarWithParams({ userId }: { userId: string | null }) {
  const vista = useSearchParams().get("vista");
  return <NavBarInner userId={userId} vista={vista} />;
}

function NavBarInner({ userId, vista }: { userId: string | null; vista: string | null }) {
  const pathname = usePathname();

  const onMap = pathname === "/mappa" || pathname.startsWith("/mappa/");
  const savedActive = onMap && vista === "salvati";
  const mapActive = onMap && !savedActive;
  const profileActive = pathname === "/profilo" || pathname.startsWith("/profilo/");

  return (
    <>
      {/* ── Mobile: barra fissa in basso ──
          Altezza effettiva = min-h-14 (56px, sui Link) + pb env(safe-area-inset-bottom).
          VALORE GEMELLO: --nav-height-mobile in globals.css deve restare sincronizzato
          con questi due (3.5rem + safe area). Se cambi min-h-14 qui, aggiorna anche la var. */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center bg-surface border-t border-border shadow-float pb-[env(safe-area-inset-bottom)] md:hidden">
        <Link
          href="/mappa"
          aria-current={mapActive ? "page" : undefined}
          className={`flex flex-col items-center justify-center flex-1 min-h-14 gap-0.5 active:scale-95 transition-all duration-150 ${
            mapActive ? "text-brand" : "text-text-muted"
          }`}
        >
          <MapIcon filled={false} />
          <span className="text-[11px] font-display">Mappa</span>
        </Link>

        <Link
          href={SAVED_HREF}
          aria-current={savedActive ? "page" : undefined}
          className={`flex flex-col items-center justify-center flex-1 min-h-14 gap-0.5 active:scale-95 transition-all duration-150 ${
            savedActive ? "text-brand" : "text-text-muted"
          }`}
        >
          <Bookmark aria-hidden className="w-6 h-6" strokeWidth={1.5} fill={savedActive ? "currentColor" : "none"} />
          <span className="text-[11px] font-display">Salvati</span>
        </Link>

        <Link
          href="/profilo"
          className={`flex flex-col items-center justify-center flex-1 min-h-14 gap-0.5 active:scale-95 transition-all duration-150 ${
            profileActive ? "text-brand" : "text-text-muted"
          }`}
        >
          <ProfileIcon filled={false} />
          <span className="text-[11px] font-display">Profilo</span>
        </Link>

        <a
          href={`mailto:${FEEDBACK_EMAIL}`}
          onClick={(e) => { e.currentTarget.href = feedbackMailto(); }}
          className="flex flex-col items-center justify-center flex-1 min-h-14 gap-0.5 text-text-muted active:scale-95 transition-all duration-150"
        >
          <FeedbackIcon />
          <span className="text-[11px] font-display">Feedback</span>
        </a>

        {userId ? (
          <form action={logout} className="flex-1 flex">
            <button
              type="submit"
              className="flex flex-col items-center justify-center flex-1 min-h-14 gap-0.5 text-text-muted active:scale-95 transition-all duration-150"
            >
              <AuthIcon />
              <span className="text-[11px] font-display">Esci</span>
            </button>
          </form>
        ) : (
          <Link
            href="/login"
            className="flex flex-col items-center justify-center flex-1 min-h-14 gap-0.5 text-text-muted active:scale-95 transition-all duration-150"
          >
            <AuthIcon />
            <span className="text-[11px] font-display">Entra</span>
          </Link>
        )}
      </nav>

      {/* ── Desktop: barra fissa in alto ── */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-surface border-b border-border shadow-card hidden md:flex items-center justify-between px-6">
        <Link href="/" className="text-lg font-display font-semibold text-brand shrink-0">
          Mapetite
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            href="/mappa"
            aria-current={mapActive ? "page" : undefined}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-sm font-display transition-colors duration-150 ${
              mapActive
                ? "text-white bg-brand"
                : "text-text-muted hover:text-text hover:bg-brand-light"
            }`}
          >
            <MapIcon filled={false} />
            Mappa
          </Link>
          <Link
            href={SAVED_HREF}
            aria-current={savedActive ? "page" : undefined}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-sm font-display transition-colors duration-150 ${
              savedActive
                ? "text-white bg-brand"
                : "text-text-muted hover:text-text hover:bg-brand-light"
            }`}
          >
            <Bookmark aria-hidden className="w-6 h-6" strokeWidth={1.5} />
            Salvati
          </Link>
          <Link
            href="/profilo"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-sm font-display transition-colors duration-150 ${
              profileActive
                ? "text-white bg-brand"
                : "text-text-muted hover:text-text hover:bg-brand-light"
            }`}
          >
            <ProfileIcon filled={false} />
            Profilo
          </Link>
          <a
            href={`mailto:${FEEDBACK_EMAIL}`}
            onClick={(e) => { e.currentTarget.href = feedbackMailto(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-sm font-display text-text-muted hover:text-text hover:bg-brand-light transition-colors duration-150"
          >
            <FeedbackIcon />
            Dai un feedback
          </a>
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
            href="/login"
            className="rounded-btn bg-brand text-white px-4 py-2 text-sm font-display font-semibold hover:opacity-90 transition-opacity duration-150"
          >
            Entra
          </Link>
        )}
      </header>
    </>
  );
}
