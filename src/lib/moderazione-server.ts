import { createAdminClient } from "@/lib/supabase/admin";

// Proposta 82, minore (24/11): "Persone nascoste" in Impostazioni, con "Mostra di nuovo".
// Il telefono non riceve mai l'id della persona nascosta: ogni riga ha come chiave l'ora in cui è stata
// nascosta (unica per chi guarda), e il nome solo se quella persona ha il profilo pubblico. Chi ha il
// profilo privato resta "Un membro di Mapetite", come nelle recensioni.
export type PersonaNascosta = { chiave: string; nome: string | null; quando: string };

export const MAX_NASCOSTI_LISTA = 200;

export async function personeNascoste(userId: string): Promise<PersonaNascosta[]> {
  if (!process.env.SUPABASE_SECRET_KEY) return [];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("utenti_nascosti")
    .select("nascosto_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(MAX_NASCOSTI_LISTA);
  if (error) {
    // Senza la migrazione 20261123_moderazione la tabella non c'è: nessuna riga.
    if (error.code !== "42P01") console.warn(`[moderazione] persone nascoste ${error.code ?? ""}`);
    return [];
  }
  const righe = (data ?? []) as { nascosto_id: string; created_at: string }[];
  if (righe.length === 0) return [];
  // Solo i profili pubblici hanno un nome (vista profili_pubblici: is_public e handle).
  const { data: prof } = await admin.from("profili_pubblici").select("id, handle, display_name").in("id", righe.map((r) => r.nascosto_id));
  const nomi = new Map(((prof ?? []) as { id: string; handle: string | null; display_name: string | null }[]).map((p) => [p.id, p.display_name?.trim() || (p.handle ? `@${p.handle}` : null)]));
  return righe.map((r) => ({ chiave: r.created_at, nome: nomi.get(r.nascosto_id) ?? null, quando: r.created_at }));
}
