import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/lib/supabase/actions";

export default async function SiteHeader() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user;

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
      <Link href="/" className="text-lg font-bold text-zinc-900">
        Mapetite
      </Link>

      <nav className="flex items-center gap-4 text-sm">
        {user ? (
          <>
            <Link href="/miei-locali" className="text-zinc-700 hover:underline">
              I miei locali
            </Link>
            <Link href="/me" className="text-zinc-700 hover:underline">
              {user.email}
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-md border border-zinc-300 px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-100"
              >
                Logout
              </button>
            </form>
          </>
        ) : (
          <Link
            href="/login"
            className="rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700"
          >
            Accedi
          </Link>
        )}
      </nav>
    </header>
  );
}
