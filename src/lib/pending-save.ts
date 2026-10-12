// "Salva" senza aver fatto l'accesso: il locale si ricorda qui (solo su questo telefono)
// e si salva da solo appena la persona entra o si registra, invece di perdersi.
import type { Place } from "@/app/mappa/map-view";

const KEY = "mapetite-salva-dopo-accesso";
const MAX_AGE_MS = 2 * 60 * 60 * 1000; // dopo 2 ore non lo si salva più a sorpresa

export function rememberPendingSave(place: Place) {
  try { localStorage.setItem(KEY, JSON.stringify({ place, at: Date.now() })); } catch { /* navigazione privata */ }
}

// Lo legge e lo cancella: si prova a salvarlo una volta sola.
export function takePendingSave(): Place | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    localStorage.removeItem(KEY);
    const { place, at } = JSON.parse(raw) as { place?: Place; at?: number };
    if (!place?.id || !place.name || typeof place.lat !== "number" || typeof place.lng !== "number") return null;
    if (typeof at !== "number" || Date.now() - at > MAX_AGE_MS) return null;
    return place;
  } catch {
    return null;
  }
}

export function loginToSaveUrl(name: string): string {
  return `/login?message=${encodeURIComponent(`Accedi o registrati per salvare “${name}”: lo aggiungo ai tuoi salvati appena entri.`)}`;
}
