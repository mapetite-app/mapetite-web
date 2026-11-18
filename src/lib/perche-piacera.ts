// Proposta 48 "Perché ti piacerà": il motivo personale scritto in parole, mai un punteggio.
// "Come Roscioli, tra i posti che ti sono piaciuti: prezzi simili, stessa zona".
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
const GENERICHE = new Set(["ristorante", "ristorante italiano", "ristorante mediterraneo", "da asporto", "alimentari", "area food", "negozio", "buffet", "fast food", "bar", "caffè", "caffetteria", "tavola calda", "discoteca", "bar e griglia"]);
// Oltre questa distanza "stessa zona" non vale (circa 12 minuti a piedi; in centro a Roma 1,5 km univa Trastevere e Monti, revisore 18/11).
const ZONA_M = 1000;
// Un esempio a centinaia di km (un viaggio) resta valido per il tipo, ma non per la zona.

function tipo(p: { category: string | null; name: string }, etichetta: Etichetta): string | null {
  const l = etichetta(p.category, p.name);
  if (!l) return null;
  const k = l.trim().toLowerCase();
  return k && !GENERICHE.has(k) ? k : null;
}


// Nome corto per la frase: "L'Elementare - Trastevere" → "L'Elementare", "Bar del Fico, Piazza del Fico" → "Bar del Fico";
// mai più di 24 caratteri, tagliato a parola e mai su una parola vuota ("Bar Amari e…", "Guerra dal…": revisori 18/11).
const VUOTE_FINE = new Set(["e", "ed", "&", "di", "da", "dal", "dallo", "dalla", "dai", "dagli", "dalle", "del", "dello", "della", "dei", "degli", "delle", "al", "allo", "alla", "ai", "agli", "alle", "a", "in", "nel", "nello", "nella", "nei", "su", "sul", "sullo", "sulla", "con", "per", "la", "il", "lo", "le", "i", "gli", "the", "of", "and"]);
export function nomeCorto(name: string, leggibile: (n: string) => string = (n) => n): string {
  const base = leggibile(name).split(/\s+[-–—|·]\s+|,|\s+\(/)[0].trim();
  if (base.length <= 24) return base;
  const parole = base.slice(0, 24).replace(/\s+\S*$/, "").split(/\s+/);
  while (parole.length > 1 && VUOTE_FINE.has(parole[parole.length - 1].toLowerCase())) parole.pop();
  const cut = parole.join(" ").replace(/[,;:]+$/, "");
  return `${cut || base.slice(0, 23)}…`;
}

// L'insegna, per riconoscere lo stesso posto scritto in modi diversi (revisore 18/11): senza parentesi, senza il pezzo
// dopo la virgola o il trattino, senza "Roma"/"Milano" in fondo, senza la parola del tipo in testa
// ("Trattoria Da Enzo" = "Da Enzo", "Zen-Prati" = "Zen", "Panificio Bonci Roma" = "Panificio Bonci").
const TIPO_IN_TESTA = /^(?:trattoria|osteria|hostaria|pizzeria|ristorante|bar|caff[eè]|enoteca|forno|panificio|pasticceria|gelateria|braceria|taverna|bistrot|sushi)\s+/;
function insegna(n: string): string {
  let k = n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/\([^)]*\)/g, " ").split(/,|\s[-–—|·]\s|(?<=\S)-(?=\S)/)[0]
    .replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim()
    .replace(/\s+(?:roma|milano)$/, "");
  const senzaTipo = k.replace(TIPO_IN_TESTA, "");
  if (senzaTipo.length >= 3) k = senzaTipo;
  return k;
}
function stessaInsegna(a: string, b: string): boolean {
  const x = insegna(a), y = insegna(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [corto, lungo] = x.length <= y.length ? [x, y] : [y, x];
  return corto.length >= 3 && lungo.startsWith(`${corto} `);
}

// Oltre questa distanza un esempio dello stesso tipo e basta non dice niente (altra città, un viaggio).
const CITTA_M = 30000;

/**
 * La riga "Per te" dai salvati che ti sono piaciuti, o null se non c'è un legame vero.
 * - Solo i salvati con "Mi è piaciuto" (mai con "Non fa per me"), diversi dal locale aperto e da un'altra sede della stessa insegna.
 * - Legame obbligatorio: stesso tipo, non generico. Prezzo e zona si scrivono solo se veri per ogni nome citato.
 * - Il secondo nome solo se ha gli stessi legami del primo e se nessuno dei due nomi è tagliato (riga corta).
 * - Solo il tipo: la riga c'è solo nella stessa città, e senza ripetere il tipo (è già sopra il nome).
 * - Nessuna riga se il locale aperto ti è già piaciuto o non fa per te (la sai già).
 */
export function percheTiPiacera(target: PostoSimile, salvati: PostoSimile[], etichetta: Etichetta, leggibile?: (n: string) => string): string | null {
  if (target.tags?.includes(MI_E_PIACIUTO) || target.tags?.includes(NON_FA_PER_ME)) return null;
  const t = tipo(target, etichetta);
  if (!t) return null;
  const vicino = (p: PostoSimile) => distanceMeters(p, target);
  // Un salvato senza nome (dato incompleto) non si cita mai: niente errori, niente riga.
  if (typeof target.name !== "string") return null;
  const candidati = salvati.filter((p) =>
    typeof p.name === "string" && p.name.trim() !== ""
    && p.id !== target.id
    && !stessaInsegna(p.name, target.name)
    && p.tags?.includes(MI_E_PIACIUTO) && !p.tags?.includes(NON_FA_PER_ME)
    && p.businessStatus !== "CLOSED_PERMANENTLY"
    && tipo(p, etichetta) === t);
  if (candidati.length === 0) return null;
  const prezzoUguale = (p: PostoSimile) => target.priceLevel != null && target.priceLevel > 0 && p.priceLevel === target.priceLevel;
  const inZona = (p: PostoSimile) => vicino(p) <= ZONA_M;
  const forza = (p: PostoSimile) => Number(prezzoUguale(p)) + Number(inZona(p));
  const ordinati = [...candidati].sort((a, b) => forza(b) - forza(a) || Number(prezzoUguale(b)) - Number(prezzoUguale(a)) || vicino(a) - vicino(b) || a.name.localeCompare(b.name, "it"));
  const primo = ordinati[0];
  if (forza(primo) === 0 && vicino(primo) > CITTA_M) return null;
  const scelti = [primo];
  const secondo = ordinati[1];
  if (secondo && prezzoUguale(secondo) === prezzoUguale(primo) && inZona(secondo) === inZona(primo) && !stessaInsegna(secondo.name, primo.name)) scelti.push(secondo);
  let nomi = scelti.map((p) => nomeCorto(p.name, leggibile));
  if (nomi.length === 2 && (nomi.some((n) => n.endsWith("…")) || `${nomi[0]} e ${nomi[1]}`.length > 34)) nomi = nomi.slice(0, 1);
  // Forma neutra (revisore 18/11: "La Gatta Mangiona, che ti è piaciuto" era sgrammaticato).
  const chi = nomi.length === 2 ? `${nomi[0]} e ${nomi[1]}` : nomi[0];
  const pezzi: string[] = [];
  if (prezzoUguale(primo)) pezzi.push("prezzi simili");
  if (inZona(primo)) pezzi.push("stessa zona");
  // Il tipo è già scritto sopra il nome (revisori 18/11: "trattoria" ripetuta, ": colazione" poco italiano):
  // con il solo tipo la frase finisce col nome.
  return pezzi.length > 0 ? `Come ${chi}, tra i posti che ti sono piaciuti: ${pezzi.join(", ")}` : `Come ${chi}, tra i posti che ti sono piaciuti`;
}
