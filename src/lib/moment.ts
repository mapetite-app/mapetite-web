// Suggerimento di ricerca adatto al momento: ora e giorno del telefono e, se c'è, il meteo.
// Nessun costo Google: è solo una frase in più tra gli esempi.
export type Weather = { tempC: number; rain: boolean };

export function momentSuggestion(now: Date, weather: Weather | null = null): string {
  const h = now.getHours();
  const day = now.getDay();
  const weekend = day === 0 || day === 6;
  const t = weather ? Math.round(weather.tempC) : null;
  // Meteo prima di tutto: con la pioggia nessuno vuole l'aperto, con il caldo sì.
  if (weather?.rain) {
    if (h >= 6 && h < 11) return "🌧️ Colazione al calduccio qui vicino";
    if (h >= 11 && h < 15) return "🌧️ Pranzo al coperto, accogliente, qui vicino";
    if (h >= 18) return "🌧️ Locale accogliente al coperto per stasera";
  }
  if (t != null && t >= 20 && !weather?.rain) {
    if (h >= 11 && h < 15) return `☀️ Pranzo all'aperto, oggi ${t}°`;
    if (h >= 15 && h < 18) return `🍦 Gelato artigianale, oggi ${t}°`;
    if (h >= 18 && h < 22) return `🍹 Aperitivo all'aperto, stasera ${t}°`;
  }
  if (t != null && t <= 10 && h >= 18) return "🍲 Trattoria calda e accogliente per stasera";
  if (h >= 6 && h < 11) return weekend ? "☕ Brunch buono per stamattina" : "☕ Colazione con cornetti buoni qui vicino";
  if (h >= 11 && h < 15) return weekend ? "🍝 Pranzo della domenica in trattoria" : "🍝 Pranzo buono e non turistico qui vicino";
  if (h >= 15 && h < 18) return "🍦 Gelato artigianale qui vicino";
  if (h >= 18 && h < 21) return day === 5 || day === 6 ? "🍸 Cocktail bar per iniziare la serata" : "🍹 Aperitivo con vista stasera";
  if (h >= 21) return "🍷 Wine bar tranquillo per stasera";
  return "🌙 Locale aperto adesso qui vicino";
}

// Meteo attuale da Open-Meteo (gratuito, senza chiave). Posizione arrotondata a ~10 km per
// non mandare fuori il punto preciso; risposta tenuta 30 minuti nel telefono.
export async function fetchWeather(lat: number, lng: number): Promise<Weather | null> {
  const la = lat.toFixed(1), lo = lng.toFixed(1);
  const key = `mapetite.meteo.${la},${lo}`;
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) {
      const c = JSON.parse(raw) as { at: number; w: Weather };
      if (Date.now() - c.at < 30 * 60 * 1000) return c.w;
    }
  } catch { /* storage non disponibile */ }
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&current=temperature_2m,precipitation,weather_code`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return null;
    const d = (await r.json()) as { current?: { temperature_2m?: number; precipitation?: number; weather_code?: number } };
    const c = d.current;
    if (typeof c?.temperature_2m !== "number") return null;
    // Codici WMO 51-67 e 80-99: pioggia, rovesci, temporali.
    const code = c.weather_code ?? 0;
    const w: Weather = { tempC: c.temperature_2m, rain: (c.precipitation ?? 0) > 0.1 || (code >= 51 && code <= 67) || code >= 80 };
    try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), w })); } catch { /* ignorato */ }
    return w;
  } catch {
    return null;
  }
}
