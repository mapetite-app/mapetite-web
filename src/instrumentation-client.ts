import { startAutoTracking, trackPage } from "@/lib/track-auto";

// Gira una volta all'apertura, prima che l'app diventi interattiva (Next.js 16,
// instrumentation-client): visite, pagine viste ed errori del telefono, vedi src/lib/track-auto.ts.
startAutoTracking();

// Cambio di pagina dentro l'app (link, avanti/indietro).
export function onRouterTransitionStart(url: string) {
  trackPage(url);
}
