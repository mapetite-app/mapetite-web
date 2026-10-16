"use client";

import { browserClient } from "@/lib/supabase/client-lazy";

// Liste di gruppo (piano 5.5): scritture dal browser con la sessione dell'utente.
// La RLS e le funzioni della migrazione 20261016_liste_gruppo.sql controllano che chi scrive sia
// membro della lista: qui si chiama e basta. Ogni funzione restituisce un messaggio in italiano
// se non è andata (mai errori tecnici a schermo).

type Esito<T = null> = { ok: true; data: T } | { ok: false; errore: string };

const OFFLINE = "Sei offline: riprova.";
const GENERICO = "Non è andata. Riprova tra poco.";

async function client() {
  return browserClient().catch(() => null);
}

// Codici delle funzioni SQL: "troppe liste" / "lista piena" (P0001), "invito non valido" (P0002).
function messaggio(err: { code?: string; message?: string }): string {
  if (err.code === "P0002") return "Questo invito non è più valido.";
  if (err.code === "P0001") return err.message?.includes("piena") ? "Questa lista è piena." : "Hai già creato tante liste: eliminane una.";
  if (err.code === "PGRST202" || err.code === "42P01" || err.code === "42883") return "Le liste di gruppo arrivano presto.";
  return GENERICO;
}

export async function creaGruppo(nome: string, emoji: string, mioNome: string): Promise<Esito<{ id: string; codice: string }>> {
  const s = await client();
  if (!s) return { ok: false, errore: OFFLINE };
  const { data, error } = await s.rpc("crea_gruppo", { p_nome: nome, p_emoji: emoji, p_mio_nome: mioNome });
  const row = (Array.isArray(data) ? data[0] : data) as { id: string; codice: string } | null;
  if (error || !row?.id) return { ok: false, errore: error ? messaggio(error) : GENERICO };
  return { ok: true, data: row };
}

export async function entraGruppo(codice: string, mioNome: string): Promise<Esito<string>> {
  const s = await client();
  if (!s) return { ok: false, errore: OFFLINE };
  const { data, error } = await s.rpc("entra_gruppo", { p_codice: codice, p_mio_nome: mioNome });
  if (error || typeof data !== "string") return { ok: false, errore: error ? messaggio(error) : GENERICO };
  return { ok: true, data };
}

/** Propone un locale (UUID di places) nella lista. Già presente = va bene lo stesso. */
export async function aggiungiPosto(gruppoId: string, placeId: string, userId: string): Promise<Esito<string | null>> {
  const s = await client();
  if (!s) return { ok: false, errore: OFFLINE };
  const { data, error } = await s
    .from("gruppi_posti")
    .insert({ gruppo_id: gruppoId, place_id: placeId, aggiunto_da: userId })
    .select("id")
    .maybeSingle();
  if (error?.code === "23505") return { ok: true, data: null }; // già nella lista
  if (error) return { ok: false, errore: messaggio(error) };
  return { ok: true, data: (data?.id as string | undefined) ?? null };
}

export async function togliPosto(postoId: string): Promise<Esito> {
  const s = await client();
  if (!s) return { ok: false, errore: OFFLINE };
  const { error } = await s.from("gruppi_posti").delete().eq("id", postoId);
  return error ? { ok: false, errore: messaggio(error) } : { ok: true, data: null };
}

export async function vota(postoId: string, userId: string, si: boolean): Promise<Esito> {
  const s = await client();
  if (!s) return { ok: false, errore: OFFLINE };
  const { error } = si
    ? await s.from("gruppi_voti").insert({ posto_id: postoId, user_id: userId })
    : await s.from("gruppi_voti").delete().eq("posto_id", postoId).eq("user_id", userId);
  // 23505 = voto già dato (doppio tocco o altro telefono): lo stato giusto è "votato".
  if (error && !(si && error.code === "23505")) return { ok: false, errore: messaggio(error) };
  return { ok: true, data: null };
}

export async function esciDalGruppo(gruppoId: string, userId: string): Promise<Esito> {
  const s = await client();
  if (!s) return { ok: false, errore: OFFLINE };
  const { error } = await s.from("gruppi_membri").delete().eq("gruppo_id", gruppoId).eq("user_id", userId);
  return error ? { ok: false, errore: messaggio(error) } : { ok: true, data: null };
}
