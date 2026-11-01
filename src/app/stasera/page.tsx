import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import StaseraView from "./stasera-view";

export const metadata: Metadata = {
  title: "Stasera dove andiamo? · Mapetite",
  description: "Scegli tra i locali che hai salvato: tre proposte per stasera.",
};

// Solo in sviluppo: utente finto per il test automatico (scripts/e2e/giro.mjs), come in /mappa.
// Il cookie "e2e_anonimo" simula chi non ha fatto l'accesso. In produzione NODE_ENV è "production".
async function e2eUser(): Promise<string | null> {
  if (process.env.NODE_ENV !== "development" || !process.env.E2E_FAKE_USER) return null;
  if ((await cookies()).get("e2e_anonimo")) return "anonimo";
  return process.env.E2E_FAKE_USER;
}

export default async function StaseraPage() {
  const fake = await e2eUser();
  let userId: string | null = null;
  if (fake) {
    userId = fake === "anonimo" ? null : fake;
  } else {
    const { data } = await getUser();
    userId = data?.user?.id ?? null;
  }

  if (!userId) {
    return (
      <main className="-mb-[calc(var(--nav-height-mobile)+var(--nav-sporgenza))] flex min-h-dvh flex-col items-center justify-center gap-4 bg-brand px-6 pb-[var(--nav-height-mobile)] text-center text-white md:mb-0 md:min-h-[calc(100dvh-3.5rem)] md:pb-0">
        <span aria-hidden className="text-5xl">🍽️</span>
        <h1 className="font-title text-[28px] leading-tight">Stasera dove andiamo?</h1>
        <p data-testid="stasera-accedi" className="max-w-xs text-sm text-white/80">
          Accedi per scegliere tra i locali che hai salvato: ti proponiamo tre posti per stasera.
        </p>
        <div className="flex gap-2">
          <Link href="/login?next=%2Fstasera" className="inline-flex min-h-11 items-center rounded-pill bg-accent px-5 font-display text-sm font-semibold text-white">
            Accedi
          </Link>
          <Link href="/signup?next=%2Fstasera" className="inline-flex min-h-11 items-center rounded-pill border border-white/40 px-5 font-display text-sm font-semibold text-white">
            Crea un account
          </Link>
        </div>
      </main>
    );
  }

  return <StaseraView userId={userId} />;
}
