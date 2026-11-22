// "Salva il primo posto" (proposta 52, ultimo passo del primo accesso): dal testo incollato si tiene
// un solo link utile, un reel (Instagram, TikTok, YouTube Shorts) o un posto di Google Maps.
// Funzione pura: la usano il telefono (per dire subito se il link va) e il server (che la rifà).
import { extractMapsLinks, isMapsListUrl } from "@/lib/maps-link";
import { findReelLink } from "@/lib/reel";

export type PrimoLink = { tipo: "reel" | "maps"; link: string } | { tipo: "lista" } | null;

export function primoLink(testo: string): PrimoLink {
  const t = (testo ?? "").slice(0, 2000);
  const maps = extractMapsLinks(t);
  const posto = maps.find((m) => !isMapsListUrl(m));
  // Il link di Maps prima del reel: chi incolla da Maps ha già il posto preciso.
  if (posto && posto.length <= 512) return { tipo: "maps", link: posto };
  if (maps.length > 0 && !posto) return { tipo: "lista" };
  const reel = findReelLink(t);
  if (reel && reel.length <= 512) return { tipo: "reel", link: reel };
  return null;
}
