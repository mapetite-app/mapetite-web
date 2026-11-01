// Pannello "Ti suggeriamo" ordinato (Lorenzo, 1/11: "ce ne sono troppe e sono un po' randomiche"):
// le idee di "Adesso" seguono tutte lo stesso momento (ora, giorno, meteo) e ognuna dice perché.
// Nessun costo Google: sono frasi, la ricerca parte solo al tocco.
import type { Weather } from "@/lib/moment";

const GIORNI = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

function parteDelGiorno(h: number): string {
  if (h >= 5 && h < 12) return "mattina";
  if (h >= 12 && h < 15) return "pranzo";
  if (h >= 15 && h < 18) return "pomeriggio";
  if (h >= 18 && h < 24) return "sera";
  return "notte";
}

// Riga sotto il titolo: "Domenica sera · 12°" (il meteo solo se c'è).
export function contestoIdee(now: Date, weather: Weather | null): string {
  const base = `${GIORNI[now.getDay()]} ${parteDelGiorno(now.getHours())}`;
  if (!weather) return base;
  return `${base} · ${Math.round(weather.tempC)}°${weather.rain ? ", piove" : ""}`;
}

// Il perché dell'idea del momento (momentSuggestion), in 2-3 parole.
export function percheMomento(now: Date, weather: Weather | null): string {
  const h = now.getHours();
  if (weather?.rain) return "Oggi piove";
  if (weather && weather.tempC >= 20) return `Oggi ${Math.round(weather.tempC)}°`;
  // Senza meteo il titolo dice già il momento ("Aperitivo… stasera"): qui solo dove e quando.
  return `Qui vicino, alle ${h}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export type IdeaMomento = { emoji: string; title: string; sub: string; query: string };

// Seconda idea dello stesso momento, diversa dalla prima (momentSuggestion): stessa fascia oraria,
// un altro tipo di posto. Così "Adesso" ha due proposte coerenti invece di frasi sparse.
export function secondaIdea(now: Date, weather: Weather | null): IdeaMomento {
  const h = now.getHours();
  const day = now.getDay();
  const weekend = day === 0 || day === 6;
  const coperto = weather?.rain === true;
  if (h >= 6 && h < 11) return { emoji: "🥐", title: "Pasticceria artigianale", sub: "Dolci della casa", query: "Pasticceria artigianale con dolci della casa qui vicino" };
  if (h >= 11 && h < 15) {
    return weekend
      ? { emoji: "🍕", title: "Pizza al taglio buona", sub: "Per un pranzo informale", query: "Pizza al taglio buona qui vicino" }
      : { emoji: "🥗", title: "Pranzo veloce e buono", sub: "Per la pausa pranzo", query: "Pranzo veloce e buono qui vicino" };
  }
  if (h >= 15 && h < 18) return { emoji: "🍰", title: "Merenda in pasticceria", sub: "Per una pausa dolce", query: "Pasticceria per la merenda qui vicino" };
  if (h >= 18 && h < 21) {
    return coperto
      ? { emoji: "🍷", title: "Enoteca con cucina", sub: "Al coperto, per la cena", query: "Enoteca con cucina al coperto per stasera" }
      : { emoji: "🍝", title: "Trattoria di quartiere", sub: "Per la cena, non turistica", query: "Trattoria di quartiere non turistica per stasera" };
  }
  if (h >= 21) return { emoji: "🍸", title: "Cocktail bar tranquillo", sub: "Per il dopocena", query: "Cocktail bar tranquillo per il dopocena" };
  return { emoji: "🍸", title: "Cocktail bar aperto", sub: "A quest'ora", query: "Cocktail bar aperto adesso qui vicino" };
}
