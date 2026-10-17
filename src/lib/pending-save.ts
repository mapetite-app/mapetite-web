// "Salva" senza aver fatto l'accesso: il locale si ricorda qui (solo su questo telefono)
// e si salva da solo appena la persona entra o si registra, invece di perdersi.
import type { Place } from "@/app/mappa/map-view";
import { firmaPer, rememberFirme } from "@/lib/catalog-firme";

const KEY = "mapetite-salva-dopo-accesso";
const MAX_AGE_MS = 2 * 60 * 60 * 1000; // dopo 2 ore non lo si salva più a sorpresa

export function rememberPendingSave(place: Place, tags: string[]) {
  // Con la firma del server sui dati Google (src/lib/catalog-sig.ts): il login può aprire un'altra scheda.
  try { localStorage.setItem(KEY, JSON.stringify({ place, tags, at: Date.now(), firma: firmaPer(place.id) })); } catch { /* navigazione privata */ }
}

// Lo legge e lo cancella: si prova a salvarlo una volta sola.
export function takePendingSave(): { place: Place; tags: string[] } | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    localStorage.removeItem(KEY);
    const { place, tags, at, firma } = JSON.parse(raw) as { place?: Place; tags?: unknown; at?: number; firma?: unknown };
    if (!place?.id || !place.name || typeof place.lat !== "number" || typeof place.lng !== "number") return null;
    if (typeof at !== "number" || Date.now() - at > MAX_AGE_MS) return null;
    rememberFirme([{ id: place.id, firma }]);
    // Solo i due stati possibili ("Da provare" / "Già visitato"): mai tag arbitrari dal telefono.
    const ok = Array.isArray(tags) ? tags.filter((t): t is string => t === "Da provare" || t === "Già visitato").slice(0, 1) : [];
    return { place, tags: ok.length > 0 ? ok : ["Da provare"] };
  } catch {
    return null;
  }
}

// Solo lettura (per dirlo nella pagina di registrazione), senza cancellarlo.
export function peekPendingSaveName(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { place, at } = JSON.parse(raw) as { place?: { name?: string }; at?: number };
    if (typeof at !== "number" || Date.now() - at > MAX_AGE_MS) return null;
    return place?.name ?? null;
  } catch {
    return null;
  }
}

export function loginToSaveUrl(name: string): string {
  return `/login?message=${encodeURIComponent(`Accedi o registrati per salvare “${name}”: lo aggiungo ai tuoi salvati appena entri.`)}`;
}
