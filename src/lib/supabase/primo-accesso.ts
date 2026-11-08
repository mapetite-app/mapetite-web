import type { createClient } from "@/lib/supabase/server";

// D2 (prova dell'8/11): chi ha già usato l'app non torna al primo accesso. Basta una delle due:
// il primo accesso finito (o saltato) oppure almeno un posto salvato (account vecchi, salvati
// importati, telefono nuovo). Se la lettura dei salvati non riesce si guarda solo il profilo.
export async function haGiaIniziato(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<boolean> {
  const [{ data: profile }, { count }] = await Promise.all([
    supabase.from("profiles").select("onboarding_completed").eq("id", userId).maybeSingle(),
    supabase.from("saved_places").select("place_id", { count: "exact", head: true }).eq("user_id", userId),
  ]);
  return Boolean(profile?.onboarding_completed) || (count ?? 0) > 0;
}
