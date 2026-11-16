"use client";

import { browserClient } from "@/lib/supabase/client-lazy";
import { cleanReelUrl, reelSourceOf } from "@/lib/reel";

// Scritture della community (piani 5.6c e 5.6d) dal telefono, con la sessione dell'utente: valgono
// le regole RLS (si scrive solo a proprio nome). Mai contenuti Google: solo stelle, commento e link.

export const COMMENT_MAX = 280;

export type EsitoRecensione = "ok" | "serve-visita" | "errore";

/** Pubblica (o aggiorna) la propria recensione. "serve-visita": il database chiede prima "Ci sono stato" (proposta 61). */
export async function saveReview(userId: string, placeId: string, rating: number, comment: string): Promise<EsitoRecensione> {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return "errore";
  const client = await browserClient().catch(() => null);
  if (!client) return "errore";
  const { error } = await client.from("reviews").upsert(
    { place_id: placeId, user_id: userId, rating, comment: comment.trim().slice(0, COMMENT_MAX) || null },
    { onConflict: "user_id,place_id" },
  );
  if (error) console.warn("[community] recensione non salvata:", error.message);
  if (error && /visita_mancante/.test(error.message ?? "")) return "serve-visita";
  return error ? "errore" : "ok";
}

/**
 * "Ci sono stato" dalla sezione recensioni (proposta 61), dove la scheda non ha il suo tasto (pagina del locale,
 * assistente): segna il posto come visitato (salvandolo se serve), togliendo "Da provare". Tag riletti prima.
 */
export async function segnaCiSonoStato(userId: string, placeId: string): Promise<boolean> {
  const client = await browserClient().catch(() => null);
  if (!client) return false;
  const { data, error } = await client.from("saved_places").select("tags").eq("user_id", userId).eq("place_id", placeId).maybeSingle();
  if (error) return false;
  if (data) {
    const tags = ((data.tags as string[] | null) ?? []).filter((t) => t !== "Da provare" && t !== "Già visitato");
    const { error: e2 } = await client.from("saved_places").update({ tags: [...tags, "Già visitato"] }).eq("user_id", userId).eq("place_id", placeId);
    return !e2;
  }
  const { error: e3 } = await client.from("saved_places").insert({ user_id: userId, place_id: placeId, tags: ["Già visitato"] });
  return !e3;
}

/** Tabella o vista non ancora creata (migrazione 20261016_community da applicare). */
export function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /contenuti_locali/.test(error.message ?? "");
}

export type ReelSaved = { esito: "ok"; url: string } | { esito: "doppio" | "non-valido" | "in-arrivo" | "errore" };

/** Collega il link di un reel a un locale salvato (o appena salvato). */
export async function addReel(userId: string, placeId: string, raw: string): Promise<ReelSaved> {
  const url = cleanReelUrl(raw);
  const fonte = url ? reelSourceOf(url) : null;
  if (!url || !fonte) return { esito: "non-valido" };
  const client = await browserClient().catch(() => null);
  if (!client) return { esito: "errore" };
  const { error } = await client.from("contenuti_locali").insert({ user_id: userId, place_id: placeId, url, fonte });
  if (!error) return { esito: "ok", url };
  if (error.code === "23505") return { esito: "doppio" };
  if (isMissingTable(error)) return { esito: "in-arrivo" };
  console.warn("[community] reel non salvato:", error.message);
  return { esito: "errore" };
}
