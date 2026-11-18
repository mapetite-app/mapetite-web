// Proposta 48 "Perché ti piacerà": il motivo personale scritto in parole, mai un punteggio.
// "Come Roscioli e Armando, che ti sono piaciuti: trattoria, prezzi simili".
// Solo dati già salvati dall'utente (tipo, fascia di prezzo e posizione dei suoi 👍): zero chiamate.
// Mai inventato: senza un legame vero (stesso tipo, non generico) la riga non c'è.
// Non premia la popolarità: il legame è con i TUOI posti, non con quanti ne parlano.
// Senza import (il giro automatico lo carica da solo con Node): etichetta del tipo e nome leggibile
// arrivano da chi chiama (categoryLabel e nomeLeggibile), così la frase usa le stesse parole della card.
export type Etichetta = (category: string | null, name: string) => string | null;

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const rad = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const MI_E_PIACIUTO = "Mi è piaciuto"; // = OPINION_LIKE in tags.ts
const NON_FA_PER_ME = "Non fa per me";

export type PostoSimile = {
  id: string;
  name: string;
  category: string | null;
  priceLevel: number | null;
  lat: number;
  lng: number;
  tags?: string[] | null;
  // Proposta 45: i posti chiusi per sempre non si citano come esempio.
  businessStatus?: string | null;
};

// Etichette che non dicono niente sul gusto ("Ristorante" come un altro "Ristorante"): nessun legame.
const GENERICHE = new Set(["ristorante", "ristorante italiano", "ristorante mediterraneo", "da asporto", "alimentari", "area food", "negozio", "buffet", "fast food"]);
// Oltre questa distanza "stessa zona" non vale (circa 15 minuti a piedi).
const ZONA_M = 1500;
// Un esempio a centinaia di km (un viaggio) resta valido per il tipo, ma non per la zona.

function tipo(p: { category: string | null; name: string }, etichetta: Etichetta): string | null {
  const l = etichetta(p.category, p.name);
  if (!l) return null;
  const k = l.trim().toLowerCase();
  return k && !GENERICHE.has(k) ? k : null;
}

// "Pesce" o "Giapponese" da soli non sono un tipo di posto: nella frase diventano "cucina di pesce", "cucina giapponese".
const CUCINE = new Set(["giapponese", "cinese", "indiano", "thailandese", "messicano", "greco", "spagnolo", "francese", "americano", "mediorientale", "vegano", "vegetariano", "coreano", "vietnamita", "turco", "libanese", "brasiliano", "peruviano", "africano", "asiatico"]);
function inFrase(t: string): string {
  if (t === "pesce") return "cucina di pesce";
  if (CUCINE.has(t)) return `cucina ${t.replace(/o$/, "a")}`;
  return t;
}

// Nome corto per la frase: "L'Elementare - Trastevere" → "L'Elementare"; mai più di 26 caratteri.
export function nomeCorto(name: string, leggibile: (n: string) => string = (n) => n): string {
  const base = leggibile(name).split(/\s+[-–—|·]\s+/)[0].trim();
  if (base.length <= 26) return base;
  const cut = base.slice(0, 26).replace(/\s+\S*$/, "");
  return `${cut || base.slice(0, 25)}…`;
}

/**
 * La riga "Per te" dai salvati che ti sono piaciuti, o null se non c'è un legame vero.
 * - Solo i salvati con "Mi è piaciuto" (mai con "Non fa per me"), diversi dal locale aperto.
 * - Legame obbligatorio: stesso tipo, non generico. Prezzo e zona si aggiungono solo se valgono per tutti gli esempi.
 * - Al massimo 2 nomi: prima quelli con lo stesso prezzo, poi i più vicini.
 * - Nessuna riga se il locale aperto ti è già piaciuto o non fa per te (la sai già).
 */
export function percheTiPiacera(target: PostoSimile, salvati: PostoSimile[], etichetta: Etichetta, leggibile?: (n: string) => string): string | null {
  if (target.tags?.includes(MI_E_PIACIUTO) || target.tags?.includes(NON_FA_PER_ME)) return null;
  const t = tipo(target, etichetta);
  if (!t) return null;
  const nomeTarget = target.name.trim().toLowerCase();
  const vicino = (p: PostoSimile) => distanceMeters(p, target);
  const candidati = salvati.filter((p) =>
    p.id !== target.id
    && p.name.trim().toLowerCase() !== nomeTarget
    && p.tags?.includes(MI_E_PIACIUTO) && !p.tags?.includes(NON_FA_PER_ME)
    && p.businessStatus !== "CLOSED_PERMANENTLY"
    && tipo(p, etichetta) === t);
  if (candidati.length === 0) return null;
  const prezzoUguale = (p: PostoSimile) => target.priceLevel != null && target.priceLevel > 0 && p.priceLevel === target.priceLevel;
  const scelti = [...candidati]
    .sort((a, b) => Number(prezzoUguale(b)) - Number(prezzoUguale(a)) || vicino(a) - vicino(b) || a.name.localeCompare(b.name, "it"))
    .slice(0, 2);
  const nomi = scelti.map((p) => nomeCorto(p.name, leggibile));
  if (nomi.length === 2 && nomi[0].toLowerCase() === nomi[1].toLowerCase()) nomi.pop();
  const chi = nomi.length === 2 ? `${nomi[0]} e ${nomi[1]}, che ti sono piaciuti` : `${nomi[0]}, che ti è piaciuto`;
  const pezzi = [inFrase(t)];
  if (scelti.slice(0, nomi.length).every(prezzoUguale)) pezzi.push("prezzi simili");
  if (scelti.slice(0, nomi.length).every((p) => vicino(p) <= ZONA_M)) pezzi.push("stessa zona");
  return `Come ${chi}: ${pezzi.join(", ")}`;
}
