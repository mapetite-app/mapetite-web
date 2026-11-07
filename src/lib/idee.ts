// Pannello "Idee" ordinato (Lorenzo, 1/11: "ce ne sono troppe e sono un po' randomiche"; revisore del 2/11:
// di notte tre righe dicevano la stessa cosa). Al massimo 3 righe, ognuna con un significato diverso:
// l'idea del momento (cosa), "Vicino a me, aperto adesso" (dove, subito), una tua idea o Sorprendimi.
// Revisore del 2/11 (r4): con 4 righe il pannello copriva metà schermo; il resto sta nella fila di suggerimenti.
// Nessun costo Google: sono frasi, la ricerca parte solo al tocco.
import type { Weather } from "@/lib/moment";

// Niente import di valori qui: il giro automatico importa questo file direttamente con Node.
/** Ora di Roma (con i minuti: 23,5 = 23:30) e giorno della settimana (0 = domenica). Home, Idee e frase del
 *  momento usano la stessa ora, anche se il telefono è su un altro fuso (revisore 7/11). */
export function oraRoma(now: Date): { h: number; day: number } {
  const parti = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Rome", weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(now);
  const ore = Number(parti.find((p) => p.type === "hour")?.value);
  const min = Number(parti.find((p) => p.type === "minute")?.value);
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parti.find((p) => p.type === "weekday")?.value ?? "");
  return { h: Number.isFinite(ore) ? ore + (Number.isFinite(min) ? min / 60 : 0) : now.getHours(), day: wd < 0 ? now.getDay() : wd };
}

const GIORNI = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

// Righe del pannello: oltre si torna all'elenco lungo che Lorenzo ha bocciato.
export const IDEE_MAX = 3;

// Stesse fasce della home (`momentoDi`, revisore 7/11): "mattina" fino alle 11, poi "a pranzo".
function parteDelGiorno(h: number): string {
  if (h >= 5 && h < 11) return "mattina";
  if (h >= 11 && h < 15) return "a pranzo";
  if (h >= 15 && h < 18) return "pomeriggio";
  if (h >= 18 && h < 23.5) return "sera"; // dalle 23:30 "notte", come la home (`momentoDi`)
  return "notte";
}

// Riga sotto il titolo: "Domenica sera · 12°" (il meteo solo se c'è).
export function contestoIdee(now: Date, weather: Weather | null): string {
  // Designer 7/11: all'una di sabato la home diceva "Venerdì notte" e il pannello "Sabato notte". Stessa regola
  // della home (`momentoDi`): prima delle 5, per chi esce, è ancora la notte del giorno prima.
  // Ora di Roma e "notte" dalle 23:30, come la home (revisore 7/11: tra le 23:30 e mezzanotte la home diceva "notte", il pannello "sera").
  const { h, day } = oraRoma(now);
  const giorno = GIORNI[(day + (h < 5 ? 6 : 0)) % 7];
  const base = `${giorno} ${parteDelGiorno(h)}`;
  if (!weather) return base;
  return `${base} · ${Math.round(weather.tempC)}°${weather.rain ? ", piove" : ""}`;
}

// Il perché dell'idea del momento (momentSuggestion), in 2-4 parole. Mai "qui vicino": lo dice già la riga
// "Vicino a me, aperto adesso". Revisore del 2/11 (r4): "Per le 2:04" suonava meccanico; ora una frase per
// fascia, senza orario (le fasce sono quelle di momentSuggestion). I gradi stanno già nel titolo quando servono.
export function percheMomento(now: Date, weather: Weather | null): string {
  if (weather?.rain) return "Oggi piove";
  const { h, day } = oraRoma(now); // ora di Roma, come momentSuggestion e la home (revisore 7/11)
  // Stesse eccezioni di momentSuggestion: col freddo di sera la trattoria calda, col caldo l'aperitivo fino alle 22.
  if (weather && Math.round(weather.tempC) <= 10 && h >= 18) return "Per scaldarsi";
  if (weather && Math.round(weather.tempC) >= 20 && h >= 18 && h < 22) return "Per l'aperitivo";
  if (h >= 5 && h < 11) return "Per iniziare la giornata"; // dalle 5, come "mattina" nel titolo
  if (h >= 11 && h < 15) return day === 0 || day === 6 ? "Per un pranzo con calma" : "Per la pausa pranzo"; // nel weekend niente "pausa"
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

// Titolo breve di un'idea nel pannello (revisore del 2/11: "Cena romantica, cucina romana, atmosfera intima"
// non stava in una riga a 390 px). Solo il primo pezzo della frase, 1-3 parole; se il primo pezzo è generico
// ("Ristorante", "Locale") si usa il secondo. La ricerca e l'etichetta per chi non vede usano la frase intera.
// "Cena romantica, cucina romana, atmosfera intima" → "Cena romantica"; "Ristorante, cucina giapponese" →
// "Cucina giapponese"; "Bar a Roma, fuori dai soliti giri" → "Bar a Roma".
export function titoloBreve(frase: string): string {
  const pezzi = frase.split(/,\s*/).map((x) => x.trim()).filter(Boolean);
  if (pezzi.length === 0) return frase;
  const primo = /^(ristorante|locale)$/i.test(pezzi[0]) && pezzi[1] ? pezzi[1] : pezzi[0];
  const parole = primo.split(/\s+/);
  let corte = parole.length > 3 ? parole.slice(0, 3) : parole;
  // Mai una preposizione in fondo ("Pizza napoletana a"): si toglie (revisore 2/11).
  while (corte.length > 1 && /^(a|ad|di|da|in|con|su|per|tra|fra|al|allo|alla|ai|agli|alle|del|della|dei|nel|nella|sul|sulla|e|o)$/i.test(corte[corte.length - 1])) corte = corte.slice(0, -1);
  const breve = corte.length === parole.length ? primo : corte.join(" ");
  return breve.charAt(0).toUpperCase() + breve.slice(1);
}
