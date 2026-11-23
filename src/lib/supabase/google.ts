import { cookies } from "next/headers";

type Provider = "google" | "apple";

// Quali accessi esterni sono accesi su Supabase (letto dalle impostazioni pubbliche,
// in cache 5 minuti). Un tasto compare solo se il suo provider è acceso: niente
// tasti che finiscono in un errore.
export async function providerAttivi(): Promise<Record<Provider, boolean>> {
  // Solo in sviluppo con E2E_FAKE_USER: il giro automatico sceglie i provider dal cookie "e2e_provider".
  if (process.env.NODE_ENV === "development" && process.env.E2E_FAKE_USER) {
    const finto = (await cookies()).get("e2e_provider")?.value;
    if (finto !== undefined) {
      const lista = finto.split(",");
      return { google: lista.includes("google"), apple: lista.includes("apple") };
    }
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const spenti = { google: false, apple: false };
  if (!url || !key) return spenti;
  try {
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, next: { revalidate: 300 } });
    if (!res.ok) return spenti;
    const d = (await res.json()) as { external?: { google?: boolean; apple?: boolean } };
    return { google: d.external?.google === true, apple: d.external?.apple === true };
  } catch {
    return spenti;
  }
}
