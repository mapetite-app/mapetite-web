import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mapetite",
    short_name: "Mapetite",
    description: "I locali giusti per te, non quelli di tutti. Chiedi all'AI o usa i filtri.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#1a3c40",
    theme_color: "#1a3c40",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Tenendo premuta l'icona dell'app installata (Android): si va dritti dove serve.
    shortcuts: [
      { name: "Cerca un locale", short_name: "Cerca", url: "/mappa", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "I miei salvati", short_name: "Salvati", url: "/mappa?vista=salvati", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Cerca con i filtri", short_name: "Filtri", url: "/mappa?filtri=1", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
