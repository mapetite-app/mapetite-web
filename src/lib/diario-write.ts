"use client";

import { browserClient } from "@/lib/supabase/client-lazy";
import { isMissingVisitedAt } from "@/lib/diario";

// Scrittura del diario su saved_places (una sola riga, dell'utente). Se la colonna visited_at
// non esiste ancora (migrazione 20261015_diario non applicata) riprova senza la data: voto e
// nota si salvano comunque. Esito: "ok", "senza-data" (salvato tutto tranne la data) o "errore".
export type VisitPatch = { tags?: string[]; note?: string | null; visited_at?: string | null };

export async function saveVisit(userId: string, placeId: string, patch: VisitPatch): Promise<"ok" | "senza-data" | "errore"> {
  const client = await browserClient().catch(() => null);
  if (!client) return "errore";
  const update = (p: VisitPatch) => client.from("saved_places").update(p).eq("user_id", userId).eq("place_id", placeId);
  const { error } = await update(patch);
  if (!error) return "ok";
  if (!("visited_at" in patch) || !isMissingVisitedAt(error)) return "errore";
  const rest = { ...patch };
  delete rest.visited_at;
  if (Object.keys(rest).length === 0) return "senza-data";
  const { error: e2 } = await update(rest);
  return e2 ? "errore" : "senza-data";
}
