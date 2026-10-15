import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// Classifica di una persona con profilo pubblico (vista classifica_pubblica, migrazione
// 20261015_classifica). null = vista non ancora creata o non leggibile: la sezione resta nascosta.
// In sviluppo con E2E_FAKE_USER: i punteggi dai salvati finti del cookie "e2e_social" (rank_score).
export async function loadPublicRanks(profileId: string): Promise<Map<string, number> | null> {
  if (process.env.NODE_ENV === "development" && process.env.E2E_FAKE_USER) {
    const raw = (await cookies()).get("e2e_social")?.value;
    if (!raw) return null;
    try {
      const data = JSON.parse(decodeURIComponent(raw)) as { classifica?: boolean; salvati?: { user_id: string; place_id: string; rank_score?: number | null }[] };
      if (data.classifica === false) return null;
      return new Map((data.salvati ?? []).filter((s) => s.user_id === profileId && s.rank_score != null).map((s) => [s.place_id, Number(s.rank_score)]));
    } catch {
      return null;
    }
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("classifica_pubblica").select("place_id, rank_score").eq("user_id", profileId).limit(500);
  if (error) {
    if (error.code !== "42P01" && error.code !== "PGRST205") console.error("[classifica] lettura classifica_pubblica fallita:", error.message);
    return null;
  }
  return new Map((data ?? []).map((r) => [r.place_id as string, Number(r.rank_score)]));
}
