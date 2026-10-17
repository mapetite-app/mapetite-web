// Città nominata nella frase ("cocktail bar a Milano"), riconosciuta senza AI.
// Serve quando Haiku non risponde (errore, tempo scaduto, tetto AI): senza, la ricerca restava
// legata alla posizione della mappa e con la mappa su Roma "a Milano" mescolava bar di Roma
// ai risultati (visto il 14/10 con Google vero). Solo ordine e modo di cercare: nessuna chiamata in più.

// Nome come compare nella frase → nome nell'indirizzo Google in italiano ("20123 Milano MI").
// Coordinate del centro: servono a dire in che città è la mappa (cityNear), senza chiamate.
// radius: mezza larghezza (metri) dell'area abitata, per cercare in TUTTA la città (cityArea).
const CITIES: { name: string; re: RegExp; lat: number; lng: number; radius: number }[] = [
  { name: "Roma", re: /\broma\b/i, lat: 41.893, lng: 12.483, radius: 11000 },
  { name: "Milano", re: /\bmilano\b/i, lat: 45.464, lng: 9.19, radius: 8000 },
  { name: "Torino", re: /\btorino\b/i, lat: 45.07, lng: 7.686, radius: 7000 },
  { name: "Napoli", re: /\bnapoli\b/i, lat: 40.852, lng: 14.268, radius: 7000 },
  { name: "Firenze", re: /\bfirenze\b/i, lat: 43.769, lng: 11.256, radius: 5000 },
  { name: "Bologna", re: /\bbologna\b/i, lat: 44.494, lng: 11.343, radius: 5000 },
  { name: "Venezia", re: /\bvenezia\b/i, lat: 45.438, lng: 12.327, radius: 4000 },
  { name: "Genova", re: /\bgenova\b/i, lat: 44.407, lng: 8.934, radius: 7000 },
  { name: "Palermo", re: /\bpalermo\b/i, lat: 38.116, lng: 13.361, radius: 6000 },
  { name: "Bari", re: /\bbari\b/i, lat: 41.117, lng: 16.872, radius: 6000 },
  { name: "Verona", re: /\bverona\b/i, lat: 45.438, lng: 10.992, radius: 5000 },
];

// Altre città (capoluoghi e mete note) che non hanno un'area in CITIES. Servono a distinguere una
// città da un quartiere: "trattoria a Parma" con la mappa su Roma non deve diventare
// "trattoria quartiere Parma Roma" (decisione 13a del backlog, 16/10).
// Tolte apposta Trieste e Lodi: sono anche zone di Roma (quartiere Trieste) e di Milano (zona Lodi),
// e lì vale la città della mappa.
const ALTRE_CITTA = [
  "Agrigento", "Alessandria", "Amalfi", "Ancona", "Andria", "Aosta", "Arezzo", "Ascoli Piceno", "Asti", "Avellino",
  "Barletta", "Bellagio", "Belluno", "Benevento", "Bergamo", "Biella", "Bolzano", "Brescia", "Brindisi", "Cagliari",
  "Caltanissetta", "Campobasso", "Capri", "Carrara", "Caserta", "Catania", "Catanzaro", "Cesena", "Chieti", "Como",
  "Cortina", "Cortina d'Ampezzo", "Cosenza", "Cremona", "Crotone", "Cuneo", "Enna", "Fermo", "Ferrara", "Foggia",
  "Forlì", "Frosinone", "Gorizia", "Grosseto", "Imperia", "Isernia", "L'Aquila", "La Spezia", "Latina", "Lecce",
  "Lecco", "Livorno", "Lucca", "Macerata", "Mantova", "Massa", "Matera", "Messina", "Modena", "Monza", "Novara",
  "Nuoro", "Oristano", "Padova", "Parma", "Pavia", "Perugia", "Pesaro", "Pescara", "Piacenza", "Pisa", "Pistoia",
  "Pordenone", "Portofino", "Positano", "Potenza", "Prato", "Ragusa", "Ravenna", "Reggio Calabria", "Reggio Emilia",
  "Rieti", "Rimini", "Rovigo", "Salerno", "Sassari", "Savona", "Siena", "Siracusa", "Sondrio", "Sorrento", "Taormina",
  "Taranto", "Teramo", "Terni", "Trani", "Trapani", "Trento", "Treviso", "Udine", "Urbino", "Varese", "Verbania",
  "Vercelli", "Viareggio", "Vibo Valentia", "Vicenza", "Viterbo",
];
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’`]/g, "'").toLowerCase().trim();
const ALTRE_SET = new Set(ALTRE_CITTA.map(norm));
const ALTRE_RE = new RegExp(`(?:^|\\s)(?:a|ad|in|di|da)\\s+(${ALTRE_CITTA.map(norm).join("|")})(?=$|[\\s,.;!?])`, "i");

// La zona capita da Haiku è una città fuori da CITIES? ("Parma", "a Parma", "città di Parma")
export function isOtherCity(zona: string): boolean {
  const bare = norm(zona).replace(/^(a|ad|in|di|da|zona|citta di)\s+/, "").replace(/\s*\(.*\)$/, "").trim();
  return ALTRE_SET.has(bare);
}

// Senza Haiku: "trattoria a Parma" nomina una città fuori da CITIES (serve "a"/"in" davanti:
// "prato" o "fermo" da soli sono parole comuni).
export function namedOtherCity(query: string): string | null {
  const m = norm(query).match(ALTRE_RE);
  return m ? ALTRE_CITTA.find((c) => norm(c) === m[1]) ?? null : null;
}

// Quartieri noti delle due città di partenza (VISIONE: Roma e Milano). Un quartiere dice già la città:
// "bar cozy a Moscova" con la mappa su Roma cercava "quartiere Moscova Roma" e dava 4 bar di Roma
// (visto negli eventi del 16/10 sera). Solo nomi che esistono in una città sola: niente "Centro",
// "Duomo", "Centrale", e "Trieste"/"Lodi" restano alla città della mappa (sono anche città).
const QUARTIERI: Record<string, string[]> = {
  Roma: [
    "Trastevere", "Monti", "Rione Monti", "Testaccio", "Prati", "Pigneto", "San Lorenzo", "Ostiense", "Garbatella",
    "Parioli", "Flaminio", "Esquilino", "Centocelle", "Quadraro", "Monteverde", "Campo de' Fiori", "Campo de Fiori",
    "Trevi", "Celio", "Aventino", "Ponte Milvio", "Coppedè", "Torpignattara", "Tor Pignattara", "Eur",
    "Ghetto ebraico", "Pantheon", "Piazza Navona", "Balduina", "Montesacro", "San Saba", "Monteverde Vecchio",
  ],
  Milano: [
    "Brera", "Navigli", "Isola", "Moscova", "Porta Venezia", "Porta Romana", "Porta Garibaldi", "Garibaldi", "NoLo",
    "Città Studi", "Zona Tortona", "Tortona", "Sempione", "Paolo Sarpi", "Chinatown", "Corso Como", "Lambrate",
    "Bicocca", "CityLife", "Porta Nuova", "Ticinese", "Corso Garibaldi", "Darsena", "Bovisa", "Loreto",
    "Corso Buenos Aires", "Sant'Ambrogio", "Magenta", "Porta Ticinese", "Colonne di San Lorenzo", "Arco della Pace",
  ],
};
const QUARTIERI_IDX = Object.entries(QUARTIERI).flatMap(([city, list]) => list.map((q) => ({ city, q: norm(q) })))
  // I nomi più lunghi prima: "Porta Ticinese" vince su "Ticinese", "Colonne di San Lorenzo" su "San Lorenzo".
  .sort((a, b) => b.q.length - a.q.length);

// La città di un quartiere noto nominato nella zona (o, se manca, nella frase), altrimenti null.
export function districtCity(zona: string | null | undefined, query = ""): string | null {
  for (const text of [zona ?? "", query]) {
    const t = ` ${norm(text).replace(/[^a-z0-9' ]+/g, " ")} `;
    const hit = QUARTIERI_IDX.find(({ q }) => t.includes(` ${q} `));
    if (hit) return hit.city;
  }
  return null;
}

// Zona ambigua = un quartiere senza città: nessuna città nominata nella frase né nella zona.
// Solo qui la città della mappa fa da contesto (testo per Google e preferenza larga di 25 km).
export function ambiguousDistrict(query: string, zona: string | null | undefined): boolean {
  if (!zona || !zona.trim()) return false;
  return !namedCity(query) && !namedCity(zona) && !isOtherCity(zona) && !namedOtherCity(query);
}

// Centri approssimativi dei quartieri noti (stessi nomi di QUARTIERI). Con un quartiere nella frase si
// cerca dentro un riquadro intorno al centro invece di scriverne il nome a Google: "bar cozy quartiere
// Moscova Milano" dava 4 risultati, quasi tutti con "Moscova" nel nome (Lorenzo, 17/10 mattina).
const CENTRI: Record<string, [number, number]> = {
  // Roma
  "Trastevere": [41.8885, 12.4695], "Monti": [41.8945, 12.4930], "Rione Monti": [41.8945, 12.4930],
  "Testaccio": [41.8775, 12.4760], "Prati": [41.9080, 12.4600], "Pigneto": [41.8890, 12.5290],
  "San Lorenzo": [41.8985, 12.5150], "Ostiense": [41.8680, 12.4790], "Garbatella": [41.8600, 12.4880],
  "Parioli": [41.9250, 12.4950], "Flaminio": [41.9230, 12.4700], "Esquilino": [41.8955, 12.5050],
  "Centocelle": [41.8780, 12.5590], "Quadraro": [41.8560, 12.5450], "Monteverde": [41.8760, 12.4560],
  "Monteverde Vecchio": [41.8820, 12.4600], "Campo de' Fiori": [41.8956, 12.4722], "Campo de Fiori": [41.8956, 12.4722],
  "Trevi": [41.9009, 12.4833], "Celio": [41.8855, 12.4950], "Aventino": [41.8830, 12.4800],
  "Ponte Milvio": [41.9360, 12.4670], "Coppedè": [41.9180, 12.5030], "Torpignattara": [41.8740, 12.5380],
  "Tor Pignattara": [41.8740, 12.5380], "Eur": [41.8300, 12.4700], "Ghetto ebraico": [41.8925, 12.4780],
  "Pantheon": [41.8986, 12.4769], "Piazza Navona": [41.8992, 12.4731], "Balduina": [41.9180, 12.4370],
  "Montesacro": [41.9420, 12.5300], "San Saba": [41.8800, 12.4850],
  // Milano
  "Brera": [45.4720, 9.1870], "Navigli": [45.4520, 9.1750], "Isola": [45.4880, 9.1890],
  "Moscova": [45.4790, 9.1860], "Porta Venezia": [45.4750, 9.2050], "Porta Romana": [45.4520, 9.2030],
  "Porta Garibaldi": [45.4840, 9.1870], "Garibaldi": [45.4840, 9.1870], "NoLo": [45.4970, 9.2190],
  "Città Studi": [45.4780, 9.2270], "Zona Tortona": [45.4520, 9.1640], "Tortona": [45.4520, 9.1640],
  "Sempione": [45.4780, 9.1700], "Paolo Sarpi": [45.4800, 9.1750], "Chinatown": [45.4800, 9.1750],
  "Corso Como": [45.4820, 9.1880], "Lambrate": [45.4840, 9.2380], "Bicocca": [45.5150, 9.2110],
  "CityLife": [45.4780, 9.1560], "Porta Nuova": [45.4830, 9.1900], "Ticinese": [45.4560, 9.1810],
  "Corso Garibaldi": [45.4770, 9.1840], "Darsena": [45.4530, 9.1780], "Bovisa": [45.5030, 9.1600],
  "Loreto": [45.4860, 9.2160], "Corso Buenos Aires": [45.4800, 9.2100], "Sant'Ambrogio": [45.4620, 9.1760],
  "Magenta": [45.4660, 9.1730], "Porta Ticinese": [45.4560, 9.1810], "Colonne di San Lorenzo": [45.4580, 9.1810],
  "Arco della Pace": [45.4760, 9.1720],
};

// Il quartiere noto nominato nella zona capita dall'AI ("Moscova", "quartiere Monti"), con città e centro.
// Se la frase nomina una città diversa da quella del quartiere, null: non si indovina.
export function districtCenter(zona: string | null | undefined, query = ""): { nome: string; citta: string; lat: number; lng: number } | null {
  if (!zona || isStreet(zona)) return null;
  const t = ` ${norm(zona).replace(/[^a-z0-9' ]+/g, " ")} `;
  const hit = QUARTIERI_IDX.find(({ q }) => t.includes(` ${q} `));
  if (!hit) return null;
  const said = namedCity(query) ?? namedCity(zona);
  if (said && said !== hit.city) return null;
  const nome = QUARTIERI[hit.city].find((q) => norm(q) === hit.q)!;
  const c = CENTRI[nome];
  return c ? { nome, citta: hit.city, lat: c[0], lng: c[1] } : null;
}

// Toglie dalla frase per Google il quartiere (con "a", "in", "quartiere", "zona"…) e la città: la zona
// la dice il riquadro. Se resta troppo poco, la frase resta com'è.
export function stripDistrict(query: string, nome: string, citta: string): string {
  const esc = nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/'/g, "['’]?");
  const re = new RegExp(`\\s*\\b(?:a|al|ai|in|nel|nei|dalle parti di|vicino a|zona|quartiere|rione)?\\s*(?:(?:quartiere|rione|zona)\\s+)?${esc}(?![a-zà-ÿ])`, "gi");
  const out = stripCity(query.replace(re, " "), citta).replace(/\s{2,}/g, " ").trim();
  return out.length >= 3 ? out : query;
}

// "e a Milano?" capito come sola zona, senza tipo di locale: Google cercava "Milano" e non trovava
// nessun locale (0 risultati nell'assistente, Lorenzo 16/10 sera). Allora si cercano ristoranti.
export function withDefaultType(queryGoogle: string, zona: string | null | undefined, tipo: string | null | undefined): string {
  if (tipo || !zona) return queryGoogle;
  const n = (x: string) => norm(x).replace(/[^a-z0-9' ]+/g, " ").replace(/\b(quartiere|rione|zona|a|in)\b/g, " ").replace(/\s+/g, " ").trim();
  return n(queryGoogle) === n(zona) || n(queryGoogle) === "" ? `ristorante ${zona}` : queryGoogle;
}

// Città della mappa: la più vicina entro 25 km dal centro, altrimenti null.
export function cityNear(lat: number, lng: number): string | null {
  let best: string | null = null;
  let bestKm = 25;
  for (const c of CITIES) {
    const dy = (c.lat - lat) * 111.32;
    const dx = (c.lng - lng) * 111.32 * Math.cos((lat * Math.PI) / 180);
    const km = Math.hypot(dx, dy);
    if (km < bestKm) { bestKm = km; best = c.name; }
  }
  return best;
}

// "trattoria Monti" → "trattoria quartiere Monti": da solo il nome del quartiere viene preso per il
// nome di un locale (1 risultato invece di 20). "centro" diventa "zona centro". Se la parola
// davanti è già quartiere/rione/zona, o il quartiere non compare nella query, non cambia nulla.
// Una via o una piazza ("via del Corso", "piazza Bologna") è già un indirizzo: resta com'è.
export function isStreet(zona: string): boolean {
  return /^(via|viale|vicolo|piazza|piazzale|piazzetta|corso|largo|lungotevere|lungarno|borgo|ponte|porta|stazione)\b/i.test(zona.trim());
}

export function withDistrict(query: string, zona: string): string {
  if (isStreet(zona)) return query;
  const i = query.toLowerCase().indexOf(zona.toLowerCase());
  if (i === -1) return query;
  const before = query.slice(0, i);
  if (/(quartiere|rione|zona)\s*$/i.test(before)) return query;
  const prefix = /^centro\b/i.test(zona) ? "zona" : "quartiere";
  return `${before}${prefix} ${query.slice(i)}`;
}

// Una sola città nominata: con due ("tra Roma e Milano") non si sceglie.
// "Cucina romana", "alla milanese" non contano: servono le parole intere.
export function namedCity(query: string): string | null {
  const found = CITIES.filter((c) => c.re.test(query));
  return found.length === 1 ? found[0].name : null;
}

// I locali con un indirizzo fuori dalla città nominata vanno in fondo, mai esclusi.
// Se sono la maggioranza forse l'indirizzo non dice la città (frazioni, comuni vicini): non si tocca nulla.
export function demoteOtherCity<T extends { name: string; address: string | null }>(
  city: string,
  places: T[],
): { places: T[]; demoted: string[] } {
  const re = CITIES.find((c) => c.name === city)?.re;
  if (!re) return { places, demoted: [] };
  const isOther = (p: T) => p.address != null && p.address !== "" && !re.test(p.address);
  const kept = places.filter((p) => !isOther(p));
  if (kept.length === places.length || kept.length < places.length / 2) return { places, demoted: [] };
  const other = places.filter(isOther);
  return { places: [...kept, ...other], demoted: other.map((p) => p.name) };
}

// "a Roma", "Roma", "di Milano": la zona è la città intera (non un quartiere o una via della città).
export function wholeCity(zona: string): string | null {
  const c = namedCity(zona);
  if (!c) return null;
  const bare = zona.trim().replace(/^(a|in|di|da|zona|città di)\s+/i, "").trim().toLowerCase();
  return bare === c.toLowerCase() ? c : null;
}

// Area di tutta la città: centro e mezza larghezza. Senza, Google con "ristorante Roma" rispondeva
// con 18 locali su 20 entro 2 km da Piazza Venezia, quasi tutti con 5.000-27.000 recensioni
// (provato il 15/10). Con l'area della città e "Roma" tolto dal testo: locali in tutti i quartieri.
export function cityArea(name: string): { lat: number; lng: number; radius: number } | null {
  const c = CITIES.find((x) => x.name === name);
  return c ? { lat: c.lat, lng: c.lng, radius: c.radius } : null;
}

// Toglie la città dal testo per Google ("trattoria romana a Roma" → "trattoria romana"): l'area basta.
// Se resterebbe vuoto, il testo resta com'è.
export function stripCity(query: string, name: string): string {
  const c = CITIES.find((x) => x.name === name);
  if (!c) return query;
  const re = new RegExp(`\\s*\\b(?:a|in|di|da|zona)?\\s*${c.re.source}`, "gi");
  const out = query.replace(re, "").replace(/\s{2,}/g, " ").trim();
  return out.length >= 3 ? out : query;
}

// Quartiere nominato ("enoteca a Monti"): i locali a più di maxM metri dal centro del quartiere vanno
// in fondo, mai esclusi (visto il 17/10 con Google vero: 3 enoteche su 4 in cima erano a Ostiense,
// Talenti e Monteverde). Se nel quartiere ne restano meno di 3 non si tocca nulla.
export function demoteFarFrom<T extends { name: string; lat: number | null; lng: number | null }>(
  center: { lat: number; lng: number },
  places: T[],
  maxM = 2000,
): { places: T[]; demoted: string[] } {
  const far = (p: T) => {
    if (p.lat == null || p.lng == null) return false;
    const dy = (p.lat - center.lat) * 111320;
    const dx = (p.lng - center.lng) * 111320 * Math.cos((center.lat * Math.PI) / 180);
    return Math.hypot(dx, dy) > maxM;
  };
  const kept = places.filter((p) => !far(p));
  if (kept.length === places.length || kept.length < 3) return { places, demoted: [] };
  const lontani = places.filter(far);
  return { places: [...kept, ...lontani], demoted: lontani.map((p) => p.name) };
}
