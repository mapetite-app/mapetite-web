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

function ImportIcon({ filled }: { filled: boolean }) {
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
        d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z"
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
  const importActive = pathname === "/importa" || pathname.startsWith("/importa/");
  const profileActive = pathname === "/profilo" || pathname.startsWith("/profilo/");

  return (
    <>
      {/* ── Mobile: barra fissa in basso ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center bg-surface border-t border-border shadow-float pb-[env(safe-area-inset-bottom)] md:hidden">
        <Link
          href="/mappa"
          className={`flex flex-col items-center justify-center flex-1 min-h-14 gap-0.5 active:scale-95 transition-all duration-150 ${
            mapActive ? "text-brand" : "text-text-muted"
          }`}
        >
          <MapIcon filled={false} />
          <span className="text-[11px] font-display">Mappa</span>
        </Link>

        <Link
          href="/importa"
          className={`flex flex-col items-center justify-center flex-1 min-h-14 gap-0.5 active:scale-95 transition-all duration-150 ${
            importActive ? "text-brand" : "text-text-muted"
          }`}
        >
          <ImportIcon filled={false} />
          <span className="text-[11px] font-display">Importa</span>
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
            href="/importa"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-sm font-display transition-colors duration-150 ${
              importActive
                ? "text-white bg-brand"
                : "text-text-muted hover:text-text hover:bg-brand-light"
            }`}
          >
            <ImportIcon filled={false} />
            Importa
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
