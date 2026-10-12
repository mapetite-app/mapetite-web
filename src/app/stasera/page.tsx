import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
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
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    userId = data?.user?.id ?? null;
  }

  if (!userId) {
    return (
      <main className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center gap-4 bg-brand px-6 text-center text-white">
        <span aria-hidden className="text-5xl">🍽️</span>
        <h1 className="font-display text-2xl font-bold">Stasera dove andiamo?</h1>
        <p data-testid="stasera-accedi" className="max-w-xs text-sm text-white/80">
          Accedi per scegliere tra i locali che hai salvato: ti proponiamo tre posti per stasera.
        </p>
        <div className="flex gap-2">
          <Link href="/login" className="inline-flex min-h-11 items-center rounded-pill bg-accent px-5 font-display text-sm font-semibold text-white">
            Accedi
          </Link>
          <Link href="/signup" className="inline-flex min-h-11 items-center rounded-pill border border-white/40 px-5 font-display text-sm font-semibold text-white">
            Crea un account
          </Link>
        </div>
      </main>
    );
  }

  return <StaseraView userId={userId} />;
}
