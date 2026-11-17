"use client";

import { browserClient } from "@/lib/supabase/client-lazy";
import { pulisciFascia, pulisciSpesa, type FasciaSpesa, type SpesaVissuta } from "@/lib/spesa-testa";

// Letture e scritture della proposta 64 (spesa-testa.ts). La risposta sta sul proprio salvato (RLS: solo il
// proprietario la legge e la cambia); l'aggregato arriva dalla funzione spesa_testa_fascia (da 5 risposte in su).

const colonnaAssente = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "42703" || e.code === "PGRST204" || /spesa_testa/.test(e.message ?? ""));

// UUID o Place ID Google. Su errore (migrazione non applicata, rete) null: nessuna pillola.
export async function leggiSpesa(place: string): Promise<SpesaVissuta | null> {
  try {
    const s = await browserClient();
    const { data, error } = await s.rpc("spesa_testa_fascia", { p_place: place });
    if (error) return null;
    return pulisciSpesa((Array.isArray(data) ? data[0] : data) as { fascia?: unknown; risposte?: unknown } | undefined);
  } catch {
    return null;
  }
}

// pronta false = colonna non ancora nel database: la riga del foglio non si mostra.
export async function miaSpesa(userId: string, placeId: string): Promise<{ pronta: boolean; fascia: FasciaSpesa | null }> {
  try {
    const s = await browserClient();
    const { data, error } = await s.from("saved_places").select("spesa_testa").eq("user_id", userId).eq("place_id", placeId).maybeSingle<{ spesa_testa: unknown }>();
    if (colonnaAssente(error)) return { pronta: false, fascia: null };
    return { pronta: true, fascia: pulisciFascia(data?.spesa_testa) };
  } catch {
    return { pronta: true, fascia: null };
  }
}

// null = toglie la risposta. true se salvato.
export async function rispondiSpesa(userId: string, placeId: string, fascia: FasciaSpesa | null): Promise<boolean> {
  try {
    const s = await browserClient();
    const { error } = await s.from("saved_places").update({ spesa_testa: fascia }).eq("user_id", userId).eq("place_id", placeId);
    return !error;
  } catch {
    return false;
  }
}
