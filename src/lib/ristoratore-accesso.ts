import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";

// Chi può vedere e modificare il pannello del ristoratore di un locale (UUID in places):
// gli admin (src/lib/admin.ts) e il titolare con una richiesta verificata (tabella claims,
// migrazione 20261015_ristoratori.sql). Senza tabella claims resta solo l'admin. Solo server.
export async function puoGestireLocale(placeId: string): Promise<boolean> {
  const { data } = await getUser();
  const user = data?.user;
  if (!user) return false;
  if (isAdminEmail(user.email)) return true;
  const { data: claim, error } = await createAdminClient()
    .from("claims")
    .select("id")
    .eq("place_id", placeId)
    .eq("user_id", user.id)
    .eq("stato", "verificata")
    .limit(1)
    .maybeSingle();
  if (error && error.code !== "PGRST205" && error.code !== "42P01") console.error("[ristoratore] lettura claims:", error.code, error.message);
  return !!claim;
}
