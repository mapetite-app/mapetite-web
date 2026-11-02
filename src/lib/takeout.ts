import { parseMapsUrl } from "@/lib/maps-link";
import { cityFromAddress } from "@/lib/city";

// Import in blocco da Google Takeout (piano 3.2): il file si legge NEL TELEFONO, non va mai al server.
// Formati: "Saved Places.json" / "Labeled places.json" (GeoJSON, con coordinate), i .csv delle liste
// salvate ("Want to go.csv", "Favourite places.csv"…: solo titolo e link) e i .kml/.kmz di My Maps.
// Con nome e coordinate il locale si salva senza chiamare Google; il Place ID solo se è scritto nel file
// (il "cid" dei link di Takeout NON è un Place ID e non si usa).

export type TakeoutItem = {
  key: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  googlePlaceId: string | null;
  url: string | null; // link di Google Maps del file (serve ai .csv, che non hanno coordinate)
  note: string | null;
  lista: string; // nome della lista di Google ("Want to go", "Favourite places"…)
  zona: string; // "Roma", "Milano", altra città, "Altre zone" o SENZA_POSIZIONE
};
export type TakeoutSkipped = { name: string; motivo: string };
export type TakeoutParse = { items: TakeoutItem[]; scartati: TakeoutSkipped[]; formato: "geojson" | "csv" | "kml" | "sconosciuto" };

export const SENZA_POSIZIONE = "Senza posizione";
export const ALTRE_ZONE = "Altre zone";

const PLACE_ID = /^ChIJ[A-Za-z0-9_-]{10,}$/;

function validCoords(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}

// Verticale food & beverage: si lasciano fuori solo i posti CHIARAMENTE diversi (nel dubbio restano).
const FOOD = /\b(ristorante|ristoro|trattoria|osteria|pizzeria|pizza|bar|caff[eè]|cafe|café|coffee|bistrot|bistro|enoteca|vineria|wine|pub|birreria|brewery|gelateria|gelato|pasticceria|panificio|forno|bakery|cocktail|sushi|ramen|restaurant|kitchen|cucina|food|tavola|locanda|braceria|steakhouse|burger|poke|kebab|taverna|cantina|lounge|aperitivo|mercato|street food)\b/i;
const NOT_FOOD: [RegExp, string][] = [
  [/\b(hotel|hostel|albergo|ostello|b&b|bed (and|&) breakfast|resort|residence|airbnb)\b/i, "albergo"],
  [/\b(museo|musei|museum|galleria d'arte|pinacoteca|mostra)\b/i, "museo"],
  [/\b(chiesa|basilica|duomo|cattedrale|church|cathedral|santuario|monumento|castello|fontana|colosseo|anfiteatro)\b/i, "monumento"],
  [/\b(stazione|station|aeroporto|airport|metro|fermata|porto di|terminal)\b/i, "trasporti"],
  [/\b(farmacia|pharmacy|ospedale|hospital|clinica|medico|dentista)\b/i, "salute"],
  [/\b(parcheggio|parking|garage|autonoleggio|distributore)\b/i, "parcheggio"],
  [/\b(supermercato|supermarket|esselunga|carrefour|lidl|eurospin|ipermercato)\b/i, "supermercato"],
  [/\b(banca|bank|ufficio postale|poste italiane|comune di|questura|ambasciata)\b/i, "ufficio"],
  [/\b(palestra|gym|piscina|stadio|scuola|universit[aà]|university|liceo|teatro|theatre|theater|cinema)\b/i, "altro"],
];
const ADDRESS_LIKE = /^(via|viale|v\.le|piazza|p\.za|piazzale|largo|corso|c\.so|vicolo|lungotevere|strada|calle|rue|street|\d)/i;

export function notFoodReason(name: string): string | null {
  if (FOOD.test(name)) return null;
  for (const [re, why] of NOT_FOOD) if (re.test(name)) return why;
  if (ADDRESS_LIKE.test(name.trim()) && /\d/.test(name)) return "indirizzo";
  return null;
}

const CITY_ALIASES: Record<string, string> = { rome: "Roma", roma: "Roma", milan: "Milano", milano: "Milano", florence: "Firenze", naples: "Napoli", turin: "Torino", venice: "Venezia" };
function zonaOf(address: string, lat: number | null, lng: number | null): string {
  if (lat != null && lng != null) {
    if (lat > 41.75 && lat < 42.05 && lng > 12.3 && lng < 12.7) return "Roma";
    if (lat > 45.35 && lat < 45.58 && lng > 9.03 && lng < 9.33) return "Milano";
  }
  const c = cityFromAddress(address);
  if (c) {
    const clean = c.replace(/\s+[A-Z]{2}$/, "").trim();
    return CITY_ALIASES[clean.toLowerCase()] ?? clean;
  }
  return lat != null ? ALTRE_ZONE : SENZA_POSIZIONE;
}

// "Want to go.csv" → "Want to go"; "Saved Places.json" → "Luoghi salvati".
export function listNameFromFile(fileName: string): string {
  const base = fileName.replace(/^.*[\\/]/, "").replace(/\.(json|geojson|csv|kml|kmz)$/i, "").trim();
  if (/^saved places$|^luoghi salvati$/i.test(base)) return "Luoghi salvati";
  if (/^labell?ed places$|^luoghi etichettati$/i.test(base)) return "Luoghi etichettati";
  return base.slice(0, 60) || "Google Maps";
}

// Nome della lista di Google → stato e raccolta in Mapetite.
export function listMapping(lista: string): { stato: "Da provare" | null; tag: string | null; label: string } {
  const l = lista.toLowerCase();
  if (/want to go|vorrei andarci|voglio andarci|da visitare|luoghi salvati|saved places|starred|speciali|default list|elenco predefinito/.test(l)) {
    return { stato: "Da provare", tag: null, label: "📌 Da provare" };
  }
  if (/favou?rite|preferit/.test(l)) return { stato: null, tag: "Preferiti", label: "📁 Preferiti" };
  if (/travel plans|piani di viaggio|viagg/.test(l)) return { stato: "Da provare", tag: "Viaggi", label: "📌 Da provare · 📁 Viaggi" };
  const tag = lista.trim().replace(/\s+/g, " ").slice(0, 24);
  const nice = tag.charAt(0).toUpperCase() + tag.slice(1);
  return { stato: "Da provare", tag: nice || null, label: `📌 Da provare${nice ? ` · 📁 ${nice}` : ""}` };
}

// CSV con virgolette ("…, ""…"", …") e a capo dentro i campi.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

type Raw = { name: string; address: string; lat: number | null; lng: number | null; url: string | null; note: string | null; lista: string; placeId?: string | null };

function fromGeoJson(data: unknown, lista: string): Raw[] {
  const features = (data as { features?: unknown[] })?.features;
  if (!Array.isArray(features)) return [];
  return features.map((f) => {
    const feat = f as { geometry?: { coordinates?: number[] }; properties?: Record<string, unknown> };
    const p = feat.properties ?? {};
    const loc = (p.location ?? p.Location ?? {}) as Record<string, unknown>;
    const geo = (loc["Geo Coordinates"] ?? {}) as Record<string, unknown>;
    const [gLng, gLat] = feat.geometry?.coordinates ?? [];
    let lat = Number(geo.Latitude ?? gLat);
    let lng = Number(geo.Longitude ?? gLng);
    if (!validCoords(lat, lng)) { lat = NaN; lng = NaN; }
    const url = String(p.google_maps_url ?? p["Google Maps URL"] ?? "") || null;
    const name = String(loc.name ?? loc["Business Name"] ?? p.name ?? p.Title ?? "").trim();
    const address = String(loc.address ?? loc.Address ?? p.address ?? "").trim();
    return {
      name, address, url, note: null, lista, placeId: url ? parseMapsUrl(url).placeId : null,
      lat: Number.isFinite(lat) ? lat : null, lng: Number.isFinite(lng) ? lng : null,
    };
  });
}

function fromCsv(text: string, lista: string): Raw[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => head.findIndex((h) => names.includes(h));
  const iTitle = col("title", "titolo", "name", "nome");
  const iUrl = col("url", "link");
  const iNote = col("note", "nota", "comment", "commento");
  if (iTitle < 0 && iUrl < 0) return [];
  return rows.slice(1).map((r) => {
    const url = (r[iUrl] ?? "").trim() || null;
    const info = url ? parseMapsUrl(url) : null;
    return {
      name: ((r[iTitle] ?? "").trim() || info?.name || "").slice(0, 200),
      address: "",
      lat: info?.lat ?? null, lng: info?.lng ?? null,
      placeId: info?.placeId ?? null,
      url, note: (r[iNote] ?? "").trim().slice(0, 500) || null, lista,
    };
  });
}

const xmlText = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/\s+/g, " ").trim();

function fromKml(text: string, fallbackList: string): Raw[] {
  const out: Raw[] = [];
  // Ogni <Folder> di My Maps è un livello: diventa la lista. Fuori dai Folder vale il nome del file.
  const folders = [...text.matchAll(/<Folder>([\s\S]*?)<\/Folder>/g)];
  const blocks = folders.length ? folders.map((m) => m[1]) : [text];
  for (const b of blocks) {
    const folderName = folders.length ? xmlText(b.match(/^\s*<name>([\s\S]*?)<\/name>/)?.[1] ?? "") || fallbackList : fallbackList;
    for (const pm of b.matchAll(/<Placemark>([\s\S]*?)<\/Placemark>/g)) {
      const body = pm[1];
      const coords = body.match(/<Point>[\s\S]*?<coordinates>\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)/);
      const lng = coords ? +coords[1] : NaN;
      const lat = coords ? +coords[2] : NaN;
      const ok = validCoords(lat, lng);
      const desc = xmlText(body.match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? "");
      out.push({
        name: xmlText(body.match(/<name>([\s\S]*?)<\/name>/)?.[1] ?? ""),
        address: xmlText(body.match(/<address>([\s\S]*?)<\/address>/)?.[1] ?? ""),
        lat: ok ? lat : null, lng: ok ? lng : null, url: null,
        note: desc ? desc.slice(0, 500) : null, lista: folderName,
      });
    }
  }
  return out;
}

// KMZ = zip con dentro doc.kml: si estrae il primo .kml con DecompressionStream (niente librerie).
export async function kmzToKml(buf: ArrayBuffer): Promise<string | null> {
  const v = new DataView(buf);
  const bytes = new Uint8Array(buf);
  let i = 0;
  while (i + 30 <= bytes.length && v.getUint32(i, true) === 0x04034b50) {
    const method = v.getUint16(i + 8, true);
    const flags = v.getUint16(i + 6, true);
    let size = v.getUint32(i + 18, true);
    const nameLen = v.getUint16(i + 26, true);
    const extraLen = v.getUint16(i + 28, true);
    const name = new TextDecoder().decode(bytes.subarray(i + 30, i + 30 + nameLen));
    const start = i + 30 + nameLen + extraLen;
    if ((flags & 8) && size === 0) {
      // Dimensione scritta dopo i dati: si cerca la firma del record successivo.
      let j = start;
      while (j + 4 <= bytes.length && v.getUint32(j, true) !== 0x08074b50 && v.getUint32(j, true) !== 0x04034b50 && v.getUint32(j, true) !== 0x02014b50) j++;
      size = j - start;
    }
    if (/\.kml$/i.test(name)) {
      const data = bytes.slice(start, start + size);
      if (method === 0) return new TextDecoder().decode(data);
      if (method === 8 && typeof DecompressionStream !== "undefined") {
        const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        return await new Response(stream).text();
      }
      return null;
    }
    i = start + size + ((flags & 8) ? 16 : 0);
  }
  return null;
}

export function parseTakeout(fileName: string, text: string, seen = new Set<string>()): TakeoutParse {
  const lista = listNameFromFile(fileName);
  let raws: Raw[] = [];
  let formato: TakeoutParse["formato"] = "sconosciuto";
  const t = text.trimStart();
  if (/\.(json|geojson)$/i.test(fileName) || t.startsWith("{")) {
    try { raws = fromGeoJson(JSON.parse(t), lista); formato = "geojson"; } catch { raws = []; }
  } else if (/\.kml$/i.test(fileName) || t.startsWith("<")) {
    raws = fromKml(text, lista); formato = "kml";
  } else if (/\.csv$/i.test(fileName) || /^(﻿)?"?(title|titolo|name|nome)/i.test(t)) {
    raws = fromCsv(text, lista); formato = "csv";
  }
  const items: TakeoutItem[] = [];
  const scartati: TakeoutSkipped[] = [];
  for (const r of raws) {
    if (!r.name) { scartati.push({ name: r.address || "Punto sulla mappa", motivo: "senza nome" }); continue; }
    const why = notFoodReason(r.name);
    if (why) { scartati.push({ name: r.name, motivo: why }); continue; }
    const key = r.lat != null ? `${r.name.toLowerCase()}|${r.lat.toFixed(4)}|${r.lng!.toFixed(4)}` : `${r.name.toLowerCase()}|${r.url ?? ""}`;
    if (seen.has(key)) continue; // stesso posto in due liste o due file: una volta sola
    seen.add(key);
    if (r.lat == null && !r.url) { scartati.push({ name: r.name, motivo: "senza posizione" }); continue; }
    items.push({
      key, name: r.name.slice(0, 200), address: r.address.slice(0, 300), lat: r.lat, lng: r.lng,
      googlePlaceId: r.placeId && PLACE_ID.test(r.placeId) ? r.placeId : null,
      url: r.url, note: r.note, lista: r.lista, zona: zonaOf(r.address, r.lat, r.lng),
    });
  }
  return { items, scartati, formato };
}

// "Trovati 143 posti: 37 a Roma, 12 a Milano…": zone in ordine di numero, Roma e Milano prima a parità.
export function zoneCounts(items: TakeoutItem[]): [string, number][] {
  const m = new Map<string, number>();
  for (const it of items) m.set(it.zona, (m.get(it.zona) ?? 0) + 1);
  const rank = (z: string) => (z === SENZA_POSIZIONE ? 2 : z === ALTRE_ZONE ? 1 : 0);
  return [...m.entries()].sort((a, b) => rank(a[0]) - rank(b[0]) || b[1] - a[1] || a[0].localeCompare(b[0], "it"));
}
