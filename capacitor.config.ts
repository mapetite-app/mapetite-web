import type { CapacitorConfig } from "@capacitor/cli";

// App iPhone (DA-FARE 14): la stessa Mapetite del sito, aperta dentro l'app,
// più le funzioni che il sito non può avere (Condividi da Instagram/TikTok).
// Il sito resta l'unica fonte: nessun codice dell'app web è copiato qui.
const config: CapacitorConfig = {
  appId: "app.mapetite",
  appName: "Mapetite",
  // Pagina di riserva se manca la rete (il sito vero arriva da server.url).
  webDir: "app-ios-www",
  server: {
    url: "https://mapetite-web.vercel.app",
    // Solo il nostro sito resta dentro l'app; gli altri link (Google Maps,
    // siti dei locali, Instagram) si aprono fuori, in Safari o nell'app loro.
    allowNavigation: ["mapetite-web.vercel.app"],
  },
  ios: {
    contentInset: "never",
    backgroundColor: "#1a3c40",
  },
};

export default config;
