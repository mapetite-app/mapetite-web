// Proposta 38: i posti delle liste di Google (.csv di Takeout, solo nome e link) si cercano prima nel
// catalogo di Mapetite, gratis, e solo dopo su Google. Funzioni pure, senza dipendenze: provate da
// scripts/e2e/catalogo-liste.mjs. Regola anti-errore: si usa il catalogo SOLO se nella zona c'è un
// locale soltanto con quel nome; nel dubbio (omonimi, nome troppo generico, zona incerta) decide Google.

export type Punto = { lat: number; lng: number };
export type Area =
  | { tipo: "box"; minLat: number; maxLat: number; minLng: number; maxLng: number }
  | { tipo: "citta"; citta: string };
export type Candidato = { id: string; name: string; lat: number; lng: number; google_place_id: string | null; address: string | null };

// Stessi riquadri di zonaOf (src/lib/takeout.ts): Roma e Milano sono le città del lancio.
const BOX: Record<string, Area> = {
  roma: { tipo: "box", minLat: 41.75, maxLat: 42.05, minLng: 12.3, maxLng: 12.7 },
  milano: { tipo: "box", minLat: 45.35, maxLat: 45.58, minLng: 9.03, maxLng: 9.33 },
};
const CITY_ALIAS: Record<string, string> = {
  rome: "roma", roma: "roma", milan: "milano", milano: "milano", florence: "firenze", firenze: "firenze",
  naples: "napoli", napoli: "napoli", turin: "torino", torino: "torino", venice: "venezia", venezia: "venezia",
  bologna: "bologna", genova: "genova", genoa: "genova", palermo: "palermo", bari: "bari", verona: "verona",
};
const CITY_NAME: Record<string, string> = {
  roma: "Roma", milano: "Milano", firenze: "Firenze", napoli: "Napoli", torino: "Torino", venezia: "Venezia",
  bologna: "Bologna", genova: "Genova", palermo: "Palermo", bari: "Bari", verona: "Verona",
};

function words(s: string): string[] {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function cityKey(c: string | null | undefined): string | null {
  if (!c) return null;
  const k = words(c.replace(/\s+[A-Z]{2}$/, "")).join(" ");
  return k ? CITY_ALIAS[k] ?? k : null;
}

// Tipo di locale: si toglie dal nome ("Trattoria Da Enzo" ≈ "Da Enzo"), ma due tipi diversi
// ("Bar Rossi" e "Pasticceria Rossi") non sono lo stesso posto. Sinonimi nella stessa classe.
const KIND: Record<string, string> = {
  ristorante: "ristorante", restaurant: "ristorante", trattoria: "trattoria", osteria: "osteria",
  pizzeria: "pizzeria", pizza: "pizzeria", bar: "bar", caffe: "bar", cafe: "bar", caffetteria: "bar", coffee: "bar",
  enoteca: "vino", vineria: "vino", wine: "vino", pub: "birra", birreria: "birra", brewery: "birra",
  bistrot: "bistrot", bistro: "bistrot", gelateria: "gelateria", gelato: "gelateria", pasticceria: "pasticceria",
  forno: "forno", panificio: "forno", bakery: "forno", locanda: "locanda", taverna: "taverna", sushi: "sushi", cocktail: "cocktail",
};
const ARTICLES = new Set(["il", "la", "lo", "l", "i", "gli", "le", "the"]);
const CITY_WORDS = new Set(["roma", "rome", "milano", "milan"]);

export type ChiaveNome = { key: string; parole: string[]; tipi: string[] };

/** Nome normalizzato per il catalogo, o null se è troppo generico per decidere da soli. */
export function catalogKey(name: string): ChiaveNome | null {
  const all = words(name);
  const tipi = [...new Set(all.filter((w) => KIND[w]).map((w) => KIND[w]))];
  const parole = all.filter((w) => !KIND[w]);
  while (parole.length > 1 && ARTICLES.has(parole[0])) parole.shift();
  while (parole.length > 1 && (CITY_WORDS.has(parole[parole.length - 1]) || ARTICLES.has(parole[parole.length - 1]))) parole.pop();
  const key = parole.join(" ");
  // "Bar", "Da Mario"? Sì. "Re", "1", "La"? No: troppo poco per essere sicuri.
  if (key.replace(/ /g, "").length < 4 || parole.every((w) => /^\d+$/.test(w)) || (parole.length === 1 && ARTICLES.has(parole[0]))) return null;
  return { key, parole, tipi };
}

/** Stesso locale per nome: stesse parole (tolto il tipo) e tipi compatibili. */
export function sameCatalogName(a: string, b: string): boolean {
  const x = catalogKey(a);
  const y = catalogKey(b);
  if (!x || !y || x.key !== y.key) return false;
  if (x.tipi.length && y.tipi.length) return x.tipi.some((t) => y.tipi.includes(t));
  // Tipo scritto da una parte sola: va bene solo se il resto del nome non è una parola sola
  // ("Da Enzo" ≈ "Trattoria Da Enzo" sì; "Rossi" ≈ "Pasticceria Rossi" no).
  if (x.tipi.length || y.tipi.length) return x.parole.length >= 2;
  return true;
}

/** Città scritta nel nome della lista ("Roma da provare", "Cene a Milano") o null. */
export function cityOfList(lista: string): string | null {
  const found = new Set(words(lista).map((w) => CITY_ALIAS[w]).filter(Boolean));
  if (found.size !== 1) return null; // nessuna città, o più di una ("Roma e Milano"): zona incerta
  return CITY_NAME[[...found][0]] ?? null;
}

// Zona in cui cercare: la città della riga o della lista (Roma e Milano col loro riquadro, le altre
// dall'indirizzo), altrimenti i posti della stessa lista già con la posizione, se stanno vicini (≤ ~30 km).
export function areaFor(q: { citta?: string | null; punti?: Punto[] | null }): Area | null {
  const c = cityKey(q.citta);
  if (c && BOX[c]) return BOX[c];
  const pts = (q.punti ?? []).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (pts.length > 0) {
    const lats = pts.map((p) => p.lat);
    const lngs = pts.map((p) => p.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    if (maxLat - minLat <= 0.27 && maxLng - minLng <= 0.36) {
      const padLat = pts.length === 1 ? 0.08 : 0.03; // ~9 km attorno a un punto solo, ~3 km attorno al gruppo
      const padLng = padLat * 1.35;
      return { tipo: "box", minLat: minLat - padLat, maxLat: maxLat + padLat, minLng: minLng - padLng, maxLng: maxLng + padLng };
    }
  }
  if (c) return { tipo: "citta", citta: CITY_NAME[c] ?? q.citta!.trim() };
  return null;
}

/** Parola più lunga del nome per la ricerca nel database, con le vocali jolly ("caffè" ≈ "caffe"). */
export function ilikePattern(name: string): string | null {
  const k = catalogKey(name);
  if (!k) return null;
  const longest = [...k.parole].sort((a, b) => b.length - a.length)[0];
  if (!longest || longest.length < 3) return null;
  return longest.replace(/[aeiou]/g, "_");
}

function inArea(p: Candidato, area: Area, cityOf: (address: string | null) => string | null): boolean {
  if (area.tipo === "box") return p.lat >= area.minLat && p.lat <= area.maxLat && p.lng >= area.minLng && p.lng <= area.maxLng;
  return cityKey(cityOf(p.address)) === cityKey(area.citta);
}

const near = (a: Punto, b: Punto) => Math.abs(a.lat - b.lat) < 0.0015 && Math.abs(a.lng - b.lng) < 0.002; // ~150 m

/**
 * Il locale del catalogo per questo nome in questa zona, solo se è uno solo e ha un Place ID Google.
 * `tutti` = false se la lettura dal database si è fermata al limite (potrebbero esserci altri omonimi).
 */
export function pickUnique(
  name: string,
  candidati: Candidato[],
  area: Area | null,
  cityOf: (address: string | null) => string | null,
  tutti = true,
): Candidato | null {
  if (!area || !tutti || !catalogKey(name)) return null;
  const same = candidati.filter((p) => inArea(p, area, cityOf) && sameCatalogName(name, p.name));
  if (same.length === 0) return null;
  // Lo stesso locale può comparire due volte (con e senza Place ID, entro ~150 m): conta una volta.
  // Due punti lontani con lo stesso nome sono due locali: omonimi, decide Google.
  if (!same.every((p) => near(p, same[0]))) return null;
  const ids = [...new Set(same.map((p) => p.google_place_id).filter((x): x is string => Boolean(x)))];
  if (ids.length !== 1) return null; // nessun Place ID verificato da Google, o due diversi
  return same.find((p) => p.google_place_id === ids[0]) ?? null;
}
