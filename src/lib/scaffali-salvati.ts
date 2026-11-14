import { metri, ZONE } from "@/lib/gusti";

// Scaffali dei salvati (Lorenzo 8/11: "500 salvati su Google Maps e devo cercarli uno per uno"): i salvati
// divisi per quartiere, per tipo e per raccolta, come la libreria di Places e Albo. Solo funzioni pure sui
// dati già caricati (coordinate, tipo, tag): nessuna chiamata Google o AI, nessuna migrazione.

// Un salvato è "di" un quartiere noto (Roma e Milano, gli stessi centri della zona abituale in gusti.ts) se
// è entro 1 km dal suo centro, il più vicino vince. Fuori da tutti: nessun quartiere (meglio niente che a caso).
const RAGGIO_QUARTIERE = 1_000;

export function quartiereDi(p: { lat: number; lng: number }): string | null {
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return null;
  let best: string | null = null;
  let bestM = RAGGIO_QUARTIERE;
  for (const z of ZONE) {
    const m = metri(z, p);
    if (m < bestM) { bestM = m; best = z.nome; }
  }
  return best;
}

// "Vicino a te": il raggio più stretto che tiene almeno 3 salvati (1, 2 o 5 km); null se entro 5 km non c'è niente.
export const RAGGI_VICINO = [1_000, 2_000, 5_000] as const;
export function raggioVicino(origin: { lat: number; lng: number }, posti: readonly { lat: number; lng: number }[]): number | null {
  const dist = posti.map((p) => metri(origin, p));
  for (const r of RAGGI_VICINO) if (dist.filter((d) => d <= r).length >= 3) return r;
  return dist.some((d) => d <= RAGGI_VICINO[2]) ? RAGGI_VICINO[2] : null;
}

// Etichetta di uno scaffale per tipo al plurale ("Pizzerie 23"): solo i tipi che si leggono meglio al plurale;
// gli altri restano come sono ("Sushi", "Giapponese", "Bar", "Wine bar").
const PLURALI: Record<string, string> = {
  Ristorante: "Ristoranti", "Ristorante italiano": "Ristoranti italiani", "Ristorante mediterraneo": "Ristoranti mediterranei",
  Pizzeria: "Pizzerie", Trattoria: "Trattorie", Osteria: "Osterie", Taverna: "Taverne", Braceria: "Bracerie",
  Hamburgeria: "Hamburgerie", Pasticceria: "Pasticcerie", Gelateria: "Gelaterie", Caffetteria: "Caffetterie",
  Cioccolateria: "Cioccolaterie", Birreria: "Birrerie", Birrificio: "Birrifici", Cantina: "Cantine", Enoteca: "Enoteche",
  Forno: "Forni", Gastronomia: "Gastronomie", Discoteca: "Discoteche", Steakhouse: "Steakhouse",
  // Revisore 8/11: plurali coerenti anche per le cucine ("Giapponesi" accanto a "Pizzerie", non "Giapponese").
  Giapponese: "Giapponesi", Cinese: "Cinesi", Indiano: "Indiani", Thailandese: "Thailandesi", Messicano: "Messicani",
  Greco: "Greci", Spagnolo: "Spagnoli", Francese: "Francesi", Americano: "Americani", Mediorientale: "Mediorientali",
  Vegano: "Vegani", Vegetariano: "Vegetariani", Coreano: "Coreani", Vietnamita: "Vietnamiti", Turco: "Turchi",
  Libanese: "Libanesi", Brasiliano: "Brasiliani", Peruviano: "Peruviani", Africano: "Africani", Asiatico: "Asiatici",
  "Tavola calda": "Tavole calde", "Sala da tè": "Sale da tè", Negozio: "Negozi", Alimentari: "Alimentari",
};
// Invariati al plurale e quindi già coerenti: Bar, Caffè, Cocktail bar, Wine bar, Pub, Sushi, Ramen, Bistrot, Brunch.
export const tipoPlurale = (label: string) => PLURALI[label] ?? label;
