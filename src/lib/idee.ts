// Pannello "Idee" ordinato (Lorenzo, 1/11: "ce ne sono troppe e sono un po' randomiche"; revisore del 2/11:
// di notte tre righe dicevano la stessa cosa). Al massimo 3 righe, ognuna con un significato diverso:
// l'idea del momento (cosa), "Vicino a me, aperto adesso" (dove, subito), una tua idea o Sorprendimi.
// Revisore del 2/11 (r4): con 4 righe il pannello copriva metà schermo; il resto sta nella fila di suggerimenti.
// Nessun costo Google: sono frasi, la ricerca parte solo al tocco.
import type { Weather } from "@/lib/moment";

const GIORNI = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

// Righe del pannello: oltre si torna all'elenco lungo che Lorenzo ha bocciato.
export const IDEE_MAX = 3;

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

// Il perché dell'idea del momento (momentSuggestion), in 2-4 parole. Mai "qui vicino": lo dice già la riga
// "Vicino a me, aperto adesso". Revisore del 2/11 (r4): "Per le 2:04" suonava meccanico; ora una frase per
// fascia, senza orario (le fasce sono quelle di momentSuggestion). I gradi stanno già nel titolo quando servono.
export function percheMomento(now: Date, weather: Weather | null): string {
  if (weather?.rain) return "Oggi piove";
  const h = now.getHours();
  // Stesse eccezioni di momentSuggestion: col freddo di sera la trattoria calda, col caldo l'aperitivo fino alle 22.
  if (weather && Math.round(weather.tempC) <= 10 && h >= 18) return "Per scaldarsi";
  if (weather && Math.round(weather.tempC) >= 20 && h >= 18 && h < 22) return "Per l'aperitivo";
  if (h >= 6 && h < 11) return "Per iniziare la giornata";
  if (h >= 11 && h < 15) return "Per la pausa pranzo";
  if (h >= 15 && h < 18) return "Per una pausa golosa";
  if (h >= 18 && h < 21) return "Per l'aperitivo";
  if (h >= 21) return "Per il dopocena";
  return "Aperti fino a tardi";
}

// Titolo dell'idea del momento nel pannello: senza l'emoji iniziale e senza "qui vicino" in fondo (la ricerca
// usa la frase intera). "🌧️ Pranzo al coperto, accogliente, qui vicino" → "Pranzo al coperto, accogliente".
export function titoloMomento(frase: string): string {
  return frase.replace(/^\S+\s/, "").replace(/,?\s+qui vicino$/, "");
}
