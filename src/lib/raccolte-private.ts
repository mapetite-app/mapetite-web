"use client";

import { browserClient } from "@/lib/supabase/client-lazy";

// Lucchetto "Solo per me" su una raccolta intera (resto della proposta 59, migrazione 20261116_raccolte_private).
// L'elenco sta su profiles.raccolte_private (leggibile solo dal proprietario); le viste pubbliche escludono ogni
// salvato con almeno un tag di quell'elenco. Rinomina, unisci ed elimina devono tenerlo allineato: altrimenti
// una raccolta rinominata perderebbe il lucchetto in silenzio.

/** Cambia l'elenco delle raccolte private (riletto dal database prima di scrivere). false = non riuscito. */
export async function cambiaRaccoltePrivate(userId: string, change: (nomi: string[]) => string[]): Promise<boolean> {
  const supabase = await browserClient().catch(() => null);
  if (!supabase) return false;
  const { data, error } = await supabase.from("profiles").select("raccolte_private").eq("id", userId).maybeSingle();
  if (error) return false;
  const attuali = ((data as { raccolte_private?: string[] | null } | null)?.raccolte_private ?? []).filter(Boolean);
  const nuovi = [...new Set(change(attuali).filter(Boolean))];
  if (nuovi.length === attuali.length && nuovi.every((n) => attuali.includes(n))) return true;
  const { error: e2 } = await supabase.from("profiles").update({ raccolte_private: nuovi }).eq("id", userId);
  return !e2;
}

/**
 * Prima di rinominare, unire o eliminare la raccolta "da": se ha il lucchetto, i suoi posti restano privati.
 * - rinomina in un nome nuovo: il lucchetto passa al nome nuovo (aggiunto PRIMA, così non c'è un attimo in cui si vedono);
 * - unisci in un'altra raccolta o elimina: ogni suo posto prende il lucchetto singolo ("Solo per me"), senza
 *   chiudere l'altra raccolta.
 * false = non riuscito: l'operazione non va fatta (meglio un errore che un posto privato mostrato agli amici).
 */
export async function proteggiPrima(userId: string, da: string, a: string | null, placeIds: string[]): Promise<boolean> {
  const supabase = await browserClient().catch(() => null);
  if (!supabase) return false;
  const { data, error } = await supabase.from("profiles").select("raccolte_private").eq("id", userId).maybeSingle();
  // Migrazione non applicata (colonna mancante): nessuna raccolta può avere il lucchetto, si procede.
  if (error) return /raccolte_private/.test(error.message ?? "") || error.code === "42703";
  const nomi = ((data as { raccolte_private?: string[] | null } | null)?.raccolte_private ?? []);
  if (!nomi.includes(da)) return true;
  if (a !== null) return cambiaRaccoltePrivate(userId, (n) => [...n, a]);
  if (placeIds.length === 0) return true;
  const { error: e2 } = await supabase.from("saved_places").update({ solo_per_me: true }).eq("user_id", userId).in("place_id", placeIds);
  return !e2;
}

/** Dopo rinomina, unisci o elimina riusciti: il nome vecchio esce dall'elenco. */
export async function pulisciDopo(userId: string, da: string): Promise<void> {
  await cambiaRaccoltePrivate(userId, (nomi) => nomi.filter((n) => n !== da));
}
