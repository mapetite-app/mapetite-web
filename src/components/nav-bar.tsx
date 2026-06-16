"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/supabase/actions";

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

export default function NavBar({ userId }: { userId: string | null }) {
  const pathname = usePathname();

  const mapActive = pathname === "/mappa" || pathname.startsWith("/mappa/");
  const profileActive = pathname === "/me";

  return (
    <>
      {/* ── Mobile: barra fissa in basso ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 bg-white border-t border-zinc-200 flex items-center justify-around md:hidden">
        <Link
          href="/mappa"
          className={`flex flex-col items-center gap-0.5 text-xs font-medium transition-colors ${
            mapActive ? "text-zinc-900" : "text-zinc-400"
          }`}
        >
          <MapIcon filled={mapActive} />
          Mappa
        </Link>

        <Link
          href="/me"
          className={`flex flex-col items-center gap-0.5 text-xs font-medium transition-colors ${
            profileActive ? "text-zinc-900" : "text-zinc-400"
          }`}
        >
          <ProfileIcon filled={profileActive} />
          Profilo
        </Link>

        {userId ? (
          <form action={logout}>
            <button
              type="submit"
              className="flex flex-col items-center gap-0.5 text-xs font-medium text-zinc-400"
            >
              <AuthIcon />
              Esci
            </button>
          </form>
        ) : (
          <Link
            href="/login"
            className="flex flex-col items-center gap-0.5 text-xs font-medium text-zinc-400"
          >
            <AuthIcon />
            Entra
          </Link>
        )}
      </nav>

      {/* ── Desktop: barra fissa in alto ── */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-white border-b border-zinc-200 hidden md:flex items-center justify-between px-6">
        <Link href="/" className="text-lg font-bold text-zinc-900 shrink-0">
          Mapetite
        </Link>

        <nav className="flex items-center gap-8 text-sm font-medium">
          <Link
            href="/mappa"
            className={`transition-colors hover:text-zinc-900 ${
              mapActive
                ? "text-zinc-900 underline underline-offset-4 decoration-2"
                : "text-zinc-400"
            }`}
          >
            Mappa
          </Link>
          <Link
            href="/me"
            className={`transition-colors hover:text-zinc-900 ${
              profileActive
                ? "text-zinc-900 underline underline-offset-4 decoration-2"
                : "text-zinc-400"
            }`}
          >
            Profilo
          </Link>
        </nav>

        {userId ? (
          <form action={logout}>
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 transition-colors"
            >
              Esci
            </button>
          </form>
        ) : (
          <Link
            href="/login"
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
          >
            Entra
          </Link>
        )}
      </header>
    </>
  );
}
