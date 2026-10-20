// Il provider Google è acceso su Supabase? Lo dice la pagina pubblica delle impostazioni di Auth
// (stessa chiave pubblica dell'app). Riletto ogni 5 minuti; se non risponde, il pulsante non compare.
export async function googleAttivo(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  try {
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, next: { revalidate: 300 } });
    if (!res.ok) return false;
    const d = (await res.json()) as { external?: { google?: boolean } };
    return d.external?.google === true;
  } catch {
    return false;
  }
}
