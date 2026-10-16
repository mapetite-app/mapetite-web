import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getUser } from "@/lib/supabase/server";
import SorprendimiView from "./sorprendimi-view";

export const metadata: Metadata = {
  title: "Sorprendimi · Mapetite",
  description: "Un posto mai provato che probabilmente ti piace, con il perché.",
};

// Solo in sviluppo: utente finto per il test automatico (scripts/e2e/giro.mjs), come in /stasera.
// Il cookie "e2e_anonimo" simula chi non ha fatto l'accesso. In produzione NODE_ENV è "production".
async function e2eUser(): Promise<string | null> {
  if (process.env.NODE_ENV !== "development" || !process.env.E2E_FAKE_USER) return null;
  if ((await cookies()).get("e2e_anonimo")) return "anonimo";
  return process.env.E2E_FAKE_USER;
}

// Funziona anche senza accesso: allora valgono solo la zona e il momento della giornata.
export default async function SorprendimiPage() {
  const fake = await e2eUser();
  let userId: string | null = null;
  if (fake) {
    userId = fake === "anonimo" ? null : fake;
  } else {
    const { data } = await getUser();
    userId = data?.user?.id ?? null;
  }
  return <SorprendimiView userId={userId} />;
}
