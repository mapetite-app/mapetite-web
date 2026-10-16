import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { loadDiary } from "@/lib/diario-server";
import DiarioView from "./diario-view";

export const metadata: Metadata = {
  title: "Il mio diario · Mapetite",
  description: "I locali dove sei stato, con la data, il tuo voto, le tue note e le tue foto.",
};

// Solo in sviluppo: utente finto per il test automatico (scripts/e2e/giro.mjs), come in /stasera.
// Il cookie "e2e_anonimo" simula chi non ha fatto l'accesso. In produzione NODE_ENV è "production".
async function e2eUser(): Promise<string | null> {
  if (process.env.NODE_ENV !== "development" || !process.env.E2E_FAKE_USER) return null;
  if ((await cookies()).get("e2e_anonimo")) return "anonimo";
  return process.env.E2E_FAKE_USER;
}

export default async function DiarioPage() {
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
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <span aria-hidden className="text-5xl">📔</span>
        <h1 className="font-title text-2xl font-semibold text-brand">Il tuo diario</h1>
        <p data-testid="diario-accedi" className="max-w-xs text-sm text-text-muted">
          Accedi per ritrovare i posti dove sei stato, con la data, il tuo voto e le tue note.
        </p>
        <div className="flex gap-2">
          <Link href="/login?next=%2Fprofilo%2Fdiario" className="inline-flex min-h-11 items-center rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white">
            Accedi
          </Link>
          <Link href="/signup?next=%2Fprofilo%2Fdiario" className="inline-flex min-h-11 items-center rounded-pill border border-border px-5 text-sm font-display font-semibold text-brand">
            Crea un account
          </Link>
        </div>
      </div>
    );
  }

  const { entries, withDate, fotoPronte } = await loadDiary(userId);
  return <DiarioView userId={userId} initial={entries} withDate={withDate} fotoPronte={fotoPronte} />;
}
