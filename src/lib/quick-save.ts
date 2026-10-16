"use client";

import { browserClient } from "@/lib/supabase/client-lazy";

// Salvataggio in un tocco di un risultato di ricerca (id = Place ID Google), come il segnalibro
// della mappa: il locale entra nel catalogo con /api/places/add (UUID Supabase) e poi in
// saved_places con lo stato scelto. "Già salvato" (23505) non è un errore.
export type QuickSavePlace = {
  id: string; // Place ID Google
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  category: string | null;
  rating: number | null;
  priceLevel: number | null;
  userRatingCount?: number | null; // solo per "poco conosciuto" (Scopritori), non si salva
};

export async function quickSavePlace(
  userId: string,
  place: QuickSavePlace,
  tags: string[],
): Promise<{ uuid: string; already: boolean }> {
  const addRes = await fetch("/api/places/add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      googlePlaceId: place.id, name: place.name, address: place.address ?? "",
      lat: place.lat, lng: place.lng, category: place.category, rating: place.rating, priceLevel: place.priceLevel,
      userRatingCount: place.userRatingCount ?? null,
    }),
  });
  if (!addRes.ok) throw new Error("add");
  const uuid: string = (await addRes.json()).place.id;
  const { error } = await (await browserClient()).from("saved_places").insert({ user_id: userId, place_id: uuid, tags, note: null });
  if (error && error.code !== "23505") throw new Error("insert");
  return { uuid, already: error?.code === "23505" };
}

// Place ID Google dei locali già salvati (per mostrare "Salvato" sui risultati di ricerca).
export async function savedGoogleIds(userId: string): Promise<Set<string>> {
  const { data, error } = await (await browserClient())
    .from("saved_places")
    .select("place_id, places(google_place_id)")
    .eq("user_id", userId);
  if (error || !Array.isArray(data)) return new Set();
  const ids = new Set<string>();
  for (const row of data as { places?: { google_place_id?: string | null } | null }[]) {
    const g = row.places?.google_place_id;
    if (typeof g === "string" && g) ids.add(g);
  }
  return ids;
}
