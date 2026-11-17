"use client";

import { browserClient } from "@/lib/supabase/client-lazy";

// Lucchetto "Solo per me" su una raccolta intera (resto della proposta 59, migrazioni 20261116 e 20261116c).
// L'elenco sta su profiles.raccolte_private (leggibile solo dal proprietario); le viste pubbliche escludono ogni
// salvato con almeno un tag di quell'elenco. Rinomina, unisci ed elimina devono tenerlo allineato: altrimenti
// una raccolta rinominata perderebbe il lucchetto in silenzio.
//
// Revisore del 16/11: si lavora sempre su quello che c'è ADESSO nel database (un posto aggiunto da un altro
// telefono mentre la pagina era aperta), mai sull'elenco caricato con la pagina.

/** Accende o spegne il lucchetto di UNA raccolta (funzione atomica nel database). false = non riuscito. */
export async function lucchettoRaccolta(nome: string, on: boolean): Promise<boolean> {
  const supabase = await browserClient().catch(() => null);
  if (!supabase) return false;
  const { error } = await supabase.rpc("raccolta_privata", { p_nome: nome, p_on: on });
  return !error;
}

/** Le raccolte col lucchetto ADESSO (elenco del proprietario), o null se non leggibile (nel dubbio non si cambia niente). */
export async function leggiRaccoltePrivate(userId: string): Promise<string[] | null> {
  const supabase = await browserClient().catch(() => null);
  if (!supabase) return null;
  const { data, error } = await supabase.from("profiles").select("raccolte_private").eq("id", userId).maybeSingle();
  if (error) return null;
  return (data as { raccolte_private?: string[] | null } | null)?.raccolte_private ?? [];
}

async function eraPrivata(userId: string, da: string): Promise<boolean | null> {
  const supabase = await browserClient().catch(() => null);
  if (!supabase) return null;
  const { data, error } = await supabase.from("profiles").select("raccolte_private").eq("id", userId).maybeSingle();
  // Migrazione non applicata (colonna mancante): nessuna raccolta può avere il lucchetto.
  if (error) return error.code === "42703" || /raccolte_private/.test(error.message ?? "") ? false : null;
  return ((data as { raccolte_private?: string[] | null } | null)?.raccolte_private ?? []).includes(da);
}

/**
 * Prima di rinominare, unire o eliminare la raccolta "da": se ha il lucchetto, i suoi posti restano privati.
 * - rinomina in un nome nuovo: il lucchetto passa al nome nuovo (aggiunto PRIMA, così non c'è un attimo in cui si vedono);
 * - unisci in un'altra raccolta o elimina: ogni posto che ha ADESSO il tag "da" prende il lucchetto singolo
 *   ("Solo per me"), senza chiudere l'altra raccolta.
 * Ritorna "privata" se aveva il lucchetto, "visibile" se no, null se non riuscito (l'operazione non va fatta:
 * meglio un errore che un posto privato mostrato agli amici).
 */
export async function proteggiPrima(userId: string, da: string, a: string | null): Promise<"privata" | "visibile" | null> {
  const priv = await eraPrivata(userId, da);
  if (priv === null) return null;
  if (!priv) return "visibile";
  if (a !== null) return (await lucchettoRaccolta(a, true)) ? "privata" : null;
  const supabase = await browserClient().catch(() => null);
  if (!supabase) return null;
  const { error } = await supabase.from("saved_places").update({ solo_per_me: true }).eq("user_id", userId).contains("tags", [da]);
  return error ? null : "privata";
}

/**
 * Dopo rinomina, unisci o elimina: il nome vecchio esce dall'elenco solo se nessun posto ha ancora quel tag.
 * Revisore 16/11 (minore 4): contare e poi togliere erano due richieste; se in mezzo un altro telefono metteva un
 * posto nella raccolta, quel posto restava senza lucchetto. Con la migrazione 20261117c controllo e scrittura sono
 * una sola istruzione nel database (raccolta_privata_se_vuota). Senza la migrazione: si conta, si toglie, si
 * riconta e, se nel frattempo è arrivato un posto con quel tag, il lucchetto torna subito.
 */
export async function pulisciDopo(userId: string, da: string): Promise<void> {
  const supabase = await browserClient().catch(() => null);
  if (!supabase) return;
  const { error: fnErr } = await supabase.rpc("raccolta_privata_se_vuota", { p_nome: da });
  if (!fnErr) return;
  // Funzione assente (migrazione non applicata): PGRST202 da PostgREST, 42883 da Postgres. Altri errori: nel dubbio resta privato.
  if (fnErr.code !== "PGRST202" && fnErr.code !== "42883") return;
  const conta = async () => {
    const { count, error } = await supabase.from("saved_places").select("place_id", { count: "exact", head: true }).eq("user_id", userId).contains("tags", [da]);
    return error ? null : count ?? 0;
  };
  if ((await conta()) !== 0) return; // nel dubbio il nome resta privato
  if (!(await lucchettoRaccolta(da, false))) return;
  if ((await conta()) !== 0) await lucchettoRaccolta(da, true);
}
