import { distanceMeters } from "@/lib/distance";

// "Ci sono stato" che vale come prova (PROPOSTE.md 28, risposta alla Legge 34/2026 sulle recensioni):
// nel momento del tocco, SOLO se il permesso di posizione è già stato dato (mai chiesto da qui),
// il telefono guarda una volta dove si trova. Se è entro VISTA_METRI dal locale, con una posizione
// abbastanza precisa e presa in quel momento (mai una posizione vecchia in memoria), la visita è "vista dal telefono". La posizione non esce mai dal
// telefono: sul server va solo l'ora (saved_places.visita_vista_al).

export const VISTA_METRI = 150;
const PRECISIONE_MAX = 150; // metri: una posizione più vaga non prova niente

type Punto = { lat: number; lng: number };
export type Fix = Punto & { accuracy: number };

/** Pura (la usa anche il giro automatico): la posizione prova la visita? */
export function provaVisita(fix: Fix | null, locale: Punto | null | undefined): boolean {
  if (!fix || !locale || !Number.isFinite(locale.lat) || !Number.isFinite(locale.lng)) return false;
  if (!(fix.accuracy >= 0) || fix.accuracy > PRECISIONE_MAX) return false;
  return distanceMeters(fix, locale) <= VISTA_METRI;
}

async function posizioneSePermessa(timeoutMs = 4000, chiedi = false): Promise<Fix | null> {
  try {
    if (typeof navigator === "undefined" || !navigator.geolocation) return null;
    if (!chiedi) {
      if (!navigator.permissions) return null;
      const status = await navigator.permissions.query({ name: "geolocation" });
      if (status.state !== "granted") return null;
    }
    return await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), timeoutMs);
      navigator.geolocation.getCurrentPosition(
        (pos) => { clearTimeout(timer); resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }); },
        () => { clearTimeout(timer); resolve(null); },
        { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
      );
    });
  } catch {
    return null;
  }
}

/** Nel momento del tocco: true se il telefono vede la persona al locale. Mai una richiesta di permesso. */
export async function visitaVistaQui(locale: Punto | null | undefined): Promise<boolean> {
  if (!locale) return false;
  return provaVisita(await posizioneSePermessa(), locale);
}

/** Come visitaVistaQui, ma dopo un tocco esplicito ("Mostralo al tavolo"): il telefono può chiedere il permesso.
 *  "lontano" = posizione avuta ma non al locale; "senza" = permesso negato o posizione non disponibile. */
export async function seiAlLocale(locale: Punto | null | undefined): Promise<"si" | "lontano" | "senza"> {
  if (!locale) return "senza";
  const fix = await posizioneSePermessa(10_000, true);
  if (!fix) return "senza";
  return provaVisita(fix, locale) ? "si" : "lontano";
}
