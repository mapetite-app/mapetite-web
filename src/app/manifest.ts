import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mapetite",
    short_name: "Mapetite",
    description: "La mappa social personale e intelligente del food & beverage",
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
  };
}
