import type { RistEvento, RistLocale, RistSalvataggio } from "./ristoratore";

// Dati INVENTATI per /ristoratore/demo (presentazione agli investitori, piani Growth/Pro):
// come apparirà il pannello quando Mapetite avrà molti utenti. La pagina li etichetta sempre
// "Esempio dimostrativo"; il locale non esiste. Generati con un seme fisso: stessi numeri a ogni
// apertura, ma con le date sempre recenti. Passano dallo stesso calcolo dei dati veri.

export const DEMO_LOCALE: RistLocale = {
  id: "00000000-0000-4000-8000-0000000de300",
  name: "Osteria del Quartiere",
  address: "Via del Pigneto, 00176 Roma RM",
  category: "restaurant",
  lat: 41.8885,
  lng: 12.5302,
  google_place_id: "DEMO_OSTERIA",
};

// Generatore pseudo-casuale con seme (mulberry32).
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TIPI: [string, number][] = [["ristorante", 5], ["trattoria", 4], ["osteria", 2], ["qualsiasi locale", 1]];
const RICHIESTE: [string, number][] = [
  ["cucina romana", 6], ["non turistico", 5], ["cena tra amici", 4], ["tavoli all'aperto", 3], ["prezzi giusti", 3],
  ["vegetariano", 2], ["romantico", 2], ["pasta fatta in casa", 2], ["vino naturale", 1], ["dehors", 1],
];
const ZONE: [string, number][] = [["Pigneto", 6], ["Roma", 3], ["vicino a me", 4], ["San Lorenzo", 1]];
// Ore della ricerca (ora di Roma) con il loro peso: si cerca soprattutto prima di cena.
const ORE: [number, number][] = [[9, 1], [12, 3], [13, 2], [16, 1], [18, 4], [19, 5], [20, 3], [21, 1], [23, 1]];

function pick<T>(r: () => number, list: [T, number][]): T {
  const tot = list.reduce((s, [, w]) => s + w, 0);
  let x = r() * tot;
  for (const [v, w] of list) { x -= w; if (x <= 0) return v; }
  return list[list.length - 1][0];
}

// Salvataggi d'esempio per "Ti vogliono provare" (domanda latente): raccolte tipiche e qualche visita.
const ATTESA: [string[], number][] = [
  [["Da provare"], 12], [["Da provare", "Con amici"], 9], [["Da provare", "Romantico"], 7],
  [["Da provare", "Cena di lavoro"], 3], [["Già visitato", "Con amici", "Mi è piaciuto"], 6],
  [["Già visitato", "Mi è piaciuto"], 4], [["Già visitato"], 2], [["Già visitato", "Non fa per me"], 1],
];

export function demoDati(now: number = Date.now()): { locale: RistLocale; citta: string; simili: RistLocale[]; eventi: RistEvento[]; salvati: RistSalvataggio[]; attesa: RistSalvataggio[] } {
  const r = rng(20261025);
  const eventi: RistEvento[] = [];
  const simili: RistLocale[] = Array.from({ length: 11 }, (_, i) => ({
    id: `00000000-0000-4000-8000-0000000de3${String(i + 10).padStart(2, "0")}`,
    name: `Locale simile ${i + 1}`,
    address: "00100 Roma RM",
    category: "restaurant",
    lat: 41.89 + (r() - 0.5) * 0.05,
    lng: 12.5 + (r() - 0.5) * 0.05,
    google_place_id: null,
  }));
  // Ora di Roma ≈ UTC+2 in ottobre: basta per distribuire le ricerche nelle fasce giuste.
  const at = (daysAgo: number, hour: number, min: number) => {
    const d = new Date(now - daysAgo * 86_400_000);
    d.setUTCHours(hour - 2, min, Math.floor(r() * 60), 0);
    return Math.min(d.getTime(), now - 60_000);
  };
  let n = 0;
  const base = { user_id: null, place_id: null, google_place_id: null, lat: null, lng: null };
  for (let ago = 59; ago >= 0; ago--) {
    const weekday = new Date(now - ago * 86_400_000).getUTCDay();
    const weekend = weekday === 5 || weekday === 6 ? 1.6 : 1;
    const crescita = 1 + (59 - ago) / 45; // il locale cresce nel tempo: domanda in aumento
    const visite = Math.round((14 + r() * 10) * weekend * crescita);
    for (let v = 0; v < visite; v++) {
      const anon = `demo-${++n}`;
      const sess = `s-${n}`;
      const t = at(ago, pick(r, ORE), Math.floor(r() * 50));
      const daRicerca = r() < 0.68;
      if (daRicerca) {
        const zona = pick(r, ZONE);
        const richieste = [pick(r, RICHIESTE), ...(r() < 0.5 ? [pick(r, RICHIESTE)] : [])];
        eventi.push({ ...base, anon_id: anon, session_id: sess, created_at: new Date(t).toISOString(), type: "ricerca", lat: 41.89, lng: 12.53,
          props: { modo: "ai", tipo: pick(r, TIPI), requisiti: [...new Set(richieste)], zona: zona === "vicino a me" ? null : zona, vicino_a_me: zona === "vicino a me" } });
      }
      const tv = t + 40_000;
      const ev = (type: string, dt: number, props: Record<string, unknown> = {}) =>
        eventi.push({ ...base, anon_id: anon, session_id: sess, google_place_id: DEMO_LOCALE.google_place_id, lat: 41.89, lng: 12.53, created_at: new Date(Math.min(tv + dt, now - 1000)).toISOString(), type, props });
      ev("apri_scheda", 0, { fonte: daRicerca ? "ricerca" : r() < 0.5 ? "mappa" : "salvati" });
      if (r() < 0.16) ev("salva", 20_000, { fonte: "segnalibro" });
      if (r() < 0.11) ev("percorso", 60_000);
      if (r() < 0.03) ev("chiama", 70_000);
      if (r() < 0.06) ev("sito", 80_000);
      if (r() < 0.05) ev("ci_sono_stato", 90_000);
    }
    // Altre ricerche in zona che non hanno aperto questo locale (domanda che si può ancora prendere).
    const altre = Math.round((10 + r() * 8) * weekend * crescita);
    for (let q = 0; q < altre; q++) {
      const anon = `demo-z${++n}`;
      eventi.push({ ...base, anon_id: anon, session_id: `s-${n}`, created_at: new Date(at(ago, pick(r, ORE), Math.floor(r() * 59))).toISOString(), type: "ricerca", lat: 41.89, lng: 12.53,
        props: { modo: "ai", tipo: pick(r, TIPI), requisiti: [pick(r, RICHIESTE)], zona: r() < 0.6 ? "Pigneto" : "Roma", vicino_a_me: false } });
    }
    // Locali simili: meno visti (media della zona).
    for (const s of simili) {
      const vs = Math.round((5 + r() * 6) * weekend);
      for (let v = 0; v < vs; v++) {
        const anon = `demo-p${++n}`;
        const t = new Date(at(ago, pick(r, ORE), Math.floor(r() * 59))).toISOString();
        eventi.push({ ...base, anon_id: anon, place_id: s.id, created_at: t, type: "apri_scheda", props: { fonte: "mappa" } });
        if (r() < 0.1) eventi.push({ ...base, anon_id: anon, place_id: s.id, created_at: t, type: "salva", props: {} });
      }
    }
  }
  // Tavoli liberati per tempo ("Non vado più" da Mapetite): generatore a parte, così gli altri numeri
  // della dimostrazione restano gli stessi di prima.
  const r2 = rng(20261020);
  for (let ago = 59; ago >= 0; ago--) {
    if (r2() >= 0.3) continue;
    eventi.push({ ...base, anon_id: `demo-d${ago}`, session_id: `s-d${ago}`, google_place_id: DEMO_LOCALE.google_place_id, created_at: new Date(at(ago, 17, 30)).toISOString(), type: "funzione",
      props: { nome: "prenotazione_disdetta", contesto: r2() < 0.7 ? "whatsapp" : "telefono", ore: 2 + Math.floor(r2() * 26) } });
  }
  let u = 0;
  const attesa: RistSalvataggio[] = ATTESA.flatMap(([tags, k]) => Array.from({ length: k }, () => ({ place_id: DEMO_LOCALE.id, user_id: `demo-${++u}`, created_at: new Date(now - u * 86_400_000).toISOString(), tags, visited_at: tags.includes("Già visitato") ? new Date(now - (u % 25) * 86_400_000).toISOString() : null, visite: tags.includes("Già visitato") && u % 2 === 0 ? 2 + (u % 3) : 0 })));
  return { locale: DEMO_LOCALE, citta: "Roma", simili: [DEMO_LOCALE, ...simili], eventi, salvati: [], attesa };
}
