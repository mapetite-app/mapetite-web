import { browserClient } from "@/lib/supabase/client-lazy";
import { firmaPer } from "@/lib/catalog-firme";

// "Salva da Google Maps" lato telefono: chiede al server di trovare i locali dai link,
// poi li aggiunge ai salvati dell'utente con lo stato "Da provare" ("📌 Voglio andarci"),
// come fa la scheda del locale (saved_places scritto dal browser, con le regole RLS).

export type LinkPlace = { id: string; name: string };
export type LinkOutcome = {
  link: string;
  place?: LinkPlace;
  error?: string;
  alreadySaved?: boolean;
};

export const PENDING_LINK_KEY = "mapetite-link-google-in-attesa";
const WANT_TAG = "Da provare";

export function rememberPendingLink(text: string) {
  try { localStorage.setItem(PENDING_LINK_KEY, text); } catch { /* navigazione privata */ }
}
export function readPendingLink(): string | null {
  try { return localStorage.getItem(PENDING_LINK_KEY); } catch { return null; }
}
export function clearPendingLink() {
  try { localStorage.removeItem(PENDING_LINK_KEY); } catch { /* niente */ }
}

export async function saveFromLinks(text: string, userId: string, title?: string): Promise<LinkOutcome[]> {
  const res = await fetch("/api/places/from-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, title }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "Qualcosa è andato storto, riprova.");

  const supabase = await browserClient();
  const out: LinkOutcome[] = [];
  for (const r of (data.risultati ?? []) as LinkOutcome[]) {
    if (!r.place) { out.push({ link: r.link, error: r.error ?? "Link non valido." }); continue; }
    const place = { id: r.place.id, name: r.place.name };
    const { error } = await supabase
      .from("saved_places")
      .insert({ user_id: userId, place_id: place.id, tags: [WANT_TAG], note: null });
    if (error && error.code === "23505") out.push({ link: r.link, place, alreadySaved: true });
    else if (error) out.push({ link: r.link, place, error: "Non sono riuscito ad aggiungerlo ai tuoi salvati. Riprova." });
    else out.push({ link: r.link, place });
  }
  return out;
}

// Locale scelto tra i risultati di Google (screenshot condiviso da Android): lo crea se serve
// e lo aggiunge ai salvati con lo stato "Da provare", come i link di Google Maps.
export type SearchPlace = {
  id: string; name: string; address: string; lat: number | null; lng: number | null;
  category: string | null; rating: number | null; priceLevel: number | null;
  firma?: string; // firma del server sui dati Google (src/lib/catalog-sig.ts)
};
export async function saveSearchPlace(r: SearchPlace, userId: string): Promise<LinkOutcome> {
  if (r.lat == null || r.lng == null) throw new Error("Questo locale non ha una posizione su Google Maps.");
  const res = await fetch("/api/places/add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      googlePlaceId: r.id, name: r.name, address: r.address, lat: r.lat, lng: r.lng,
      category: r.category, rating: r.rating, priceLevel: r.priceLevel,
      firma: r.firma ?? firmaPer(r.id),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.place?.id) throw new Error(data?.error ?? "Errore nel salvataggio del locale.");
  const place = { id: data.place.id as string, name: r.name };
  const { error } = await (await browserClient())
    .from("saved_places")
    .insert({ user_id: userId, place_id: place.id, tags: [WANT_TAG], note: null });
  if (error && error.code === "23505") return { link: "", place, alreadySaved: true };
  if (error) throw new Error("Non sono riuscito ad aggiungerlo ai tuoi salvati. Riprova.");
  return { link: "", place };
}

export async function saveNote(userId: string, placeId: string, note: string) {
  const { error } = await (await browserClient())
    .from("saved_places")
    .update({ note: note.trim() || null })
    .eq("user_id", userId)
    .eq("place_id", placeId);
  if (error) throw new Error("Nota non salvata. Riprova.");
}
