"use client";

import { browserClient } from "@/lib/supabase/client-lazy";

// "Buoni pasto: qui li accettano?" (PROPOSTE.md 19/10, migrazione 20261019_buoni_pasto.sql).
// Lo dice chi c'è stato (sì/no). La scheda lo mostra solo quando almeno 2 persone concordano
// e sono più di quelle che dicono il contrario: mai da una sola risposta, mai inventato.
export type ConteggioBuoni = { si: number; no: number };

export const MIN_RISPOSTE = 2;

export function fraseBuoni(c: ConteggioBuoni | null): { accetta: boolean; testo: string } | null {
  if (!c) return null;
  if (c.si >= MIN_RISPOSTE && c.si > c.no) return { accetta: true, testo: `Buoni pasto: sì · ${c.si} persone` };
  if (c.no >= MIN_RISPOSTE && c.no > c.si) return { accetta: false, testo: `Buoni pasto: no · ${c.no} persone` };
  return null;
}

// UUID o Place ID Google: la funzione del database accetta entrambi. Su errore (migrazione
// non applicata, rete) null: nessuna riga.
export async function leggiBuoni(place: string): Promise<ConteggioBuoni | null> {
  try {
    const s = await browserClient();
    const { data, error } = await s.rpc("buoni_pasto_conteggio", { p_place: place });
    if (error) return null;
    const row = (Array.isArray(data) ? data[0] : data) as ConteggioBuoni | undefined;
    return row ? { si: Number(row.si) || 0, no: Number(row.no) || 0 } : null;
  } catch {
    return null;
  }
}

export async function miaRispostaBuoni(userId: string, placeId: string): Promise<boolean | null> {
  try {
    const s = await browserClient();
    const { data } = await s.from("buoni_pasto").select("accetta").eq("user_id", userId).eq("place_id", placeId).maybeSingle<{ accetta: boolean }>();
    return data?.accetta ?? null;
  } catch {
    return null;
  }
}

// null = toglie la risposta. true se salvato.
export async function rispondiBuoni(userId: string, placeId: string, accetta: boolean | null): Promise<boolean> {
  try {
    const s = await browserClient();
    const { error } = accetta === null
      ? await s.from("buoni_pasto").delete().eq("user_id", userId).eq("place_id", placeId)
      : await s.from("buoni_pasto").upsert({ user_id: userId, place_id: placeId, accetta }, { onConflict: "user_id,place_id" });
    return !error;
  } catch {
    return false;
  }
}
