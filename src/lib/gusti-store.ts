"use client";

import { browserClient } from "@/lib/supabase/client-lazy";
import { aggiungiGusti, gustiValidi, zonaAbituale, type Zona } from "@/lib/gusti";

// Dove stanno i gusti ricordati (piano 1.4): per chi ha fatto l'accesso nella colonna
// profiles.gusti_ricordati, accanto ai gusti dell'onboarding; finché la migrazione
// 20261016_gusti_ricordati non è applicata (o senza accesso) solo nel telefono (localStorage).
// Copia nel telefono sempre: se il database non risponde l'assistente li usa comunque.

const LOCAL = (userId: string | null) => `mapetite.gusti.${userId ?? "ospite"}`;

let current: string[] = [];
let loadedFor: string | null | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function readLocal(userId: string | null): string[] {
  try { return gustiValidi(JSON.parse(window.localStorage.getItem(LOCAL(userId)) ?? "[]")); } catch { return []; }
}
function writeLocal(userId: string | null, ids: string[]) {
  try { window.localStorage.setItem(LOCAL(userId), JSON.stringify(ids)); } catch { /* storage non disponibile */ }
}
function set(ids: string[]) { current = ids; emit(); }

export const gustiRicordati = (): string[] => current;
export function subscribeGusti(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }

async function writeServer(userId: string, ids: string[]): Promise<boolean> {
  try {
    const { error } = await (await browserClient()).from("profiles").update({ gusti_ricordati: ids }).eq("id", userId);
    return !error;
  } catch {
    return false;
  }
}

export async function caricaGusti(userId: string | null): Promise<string[]> {
  const local = readLocal(userId);
  if (loadedFor !== userId) { loadedFor = userId; set(local); }
  if (!userId) return local;
  try {
    const { data, error } = await (await browserClient()).from("profiles").select("gusti_ricordati").eq("id", userId);
    if (error) return local; // colonna non ancora creata: restano quelli del telefono
    const row = (Array.isArray(data) ? data[0] : data) as { gusti_ricordati?: unknown } | undefined;
    if (!row || !Array.isArray(row.gusti_ricordati)) return local;
    let ids = gustiValidi(row.gusti_ricordati);
    // Ricordati prima dell'accesso (o prima della migrazione): passano al profilo una volta.
    const ospite = readLocal(null);
    if (ids.length === 0 && (local.length > 0 || ospite.length > 0)) {
      ids = aggiungiGusti(local, ospite);
      void writeServer(userId, ids);
    }
    writeLocal(userId, ids);
    set(ids);
    return ids;
  } catch {
    return local;
  }
}

export async function salvaGusti(userId: string | null, ids: string[]): Promise<void> {
  const clean = gustiValidi(ids);
  writeLocal(userId, clean);
  set(clean);
  if (userId) await writeServer(userId, clean);
}

export const ricordaGusti = (userId: string | null, nuovi: string[]) => salvaGusti(userId, aggiungiGusti(current, nuovi));
export const dimenticaGusto = (userId: string | null, id: string) => salvaGusti(userId, current.filter((x) => x !== id));

// Zona dove si salva più spesso (comportamento, non dichiarato): lat/lng dei salvati, nessuna chiamata Google.
export async function caricaZonaAbituale(userId: string | null): Promise<Zona | null> {
  if (!userId) return null;
  try {
    const { data, error } = await (await browserClient()).from("saved_places").select("places(lat, lng)").eq("user_id", userId);
    if (error || !Array.isArray(data)) return null;
    const points = (data as { places?: { lat?: number | null; lng?: number | null } | null }[])
      .flatMap((r) => (typeof r.places?.lat === "number" && typeof r.places?.lng === "number" ? [{ lat: r.places.lat, lng: r.places.lng }] : []));
    return zonaAbituale(points);
  } catch {
    return null;
  }
}
