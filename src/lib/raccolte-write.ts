"use client";

import { browserClient } from "@/lib/supabase/client-lazy";

// Scrittura delle raccolte (tag dei salvati) dal browser, con la sessione dell'utente: un update
// per riga su saved_places, come la scheda del locale. Usata dal profilo (rinomina, unisci, elimina,
// nuova, proposte dell'AI) e dalla pagina della raccolta.
//
// Prima di ogni scrittura si rileggono i tag attuali dal database, non quelli caricati con la
// pagina: nel frattempo "Ci sei stato?" (o un altro telefono) può averli cambiati, e riscrivere la
// copia vecchia cancellerebbe la visita.
export async function updateTags(
  userId: string,
  targets: { placeId: string; tags: string[] }[],
  change: (tags: string[]) => string[],
  onRow?: (placeId: string, tags: string[] | null, done: number) => void, // tags null = non riuscito
): Promise<number> {
  const supabase = await browserClient().catch(() => null);
  // Senza rete il codice di Supabase potrebbe non essere ancora scaricato: errore, non attesa infinita.
  if (!supabase) return targets.length;
  let failed = 0;
  for (const [i, row] of targets.entries()) {
    const { data: fresh } = await supabase
      .from("saved_places").select("tags").eq("user_id", userId).eq("place_id", row.placeId).maybeSingle();
    const current = fresh ? ((fresh.tags as string[] | null) ?? []) : row.tags;
    const next = change(current);
    const { error } = await supabase
      .from("saved_places")
      .update({ tags: next.length > 0 ? next : null })
      .eq("user_id", userId)
      .eq("place_id", row.placeId);
    if (error) failed++;
    onRow?.(row.placeId, error ? null : next, i + 1);
  }
  return failed;
}
