// Etichette dei pin dopo una ricerca: se il nome di un risultato finirebbe sopra quello di
// un risultato più in alto in lista (o sopra il suo pin), si nasconde il nome meno importante.
// Il pin resta, toccabile; il nome torna quando si avvicina la mappa.
// Calcolo puro, senza la mappa: proiezione di Mercatore come Mapbox (riquadri da 512 px).

export type LabelPin = { id: string; lat: number; lng: number; name: string; big?: boolean };

export type Rect = { x1: number; y1: number; x2: number; y2: number };

const LABEL_H = 22; // altezza della pillola col nome (text-[11px] + padding)
const LABEL_MAX_W = 110; // max-w-[110px] (bordo compreso)
const GAP = 2;
const SLACK = 4; // pochi pixel di bordo che si toccano non danno fastidio

export function project(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const scale = 512 * 2 ** zoom;
  const s = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale,
  };
}

function labelWidth(name: string): number {
  return Math.min(LABEL_MAX_W, pinName(name).length * 6.4 + 16);
}

// Nome corto sul pin: l'insegna senza la descrizione che Google aggiunge dopo un trattino o una barra
// ("La Sora Cencia – Trattoria tipica romana a Trastevere" → "La Sora Cencia"), così non si legge
// "La Sora Cencia …". Il nome intero resta nella card e nella scheda.
export function pinName(name: string): string {
  const head = name.split(/\s+[–—|-]\s+|\s*\(|,\s+/)[0].trim();
  return head.length >= 3 ? head : name;
}

// pins in ordine di importanza (il primo vince sempre). Restituisce gli id da mostrare senza nome.
// Versione semplice usata dal test delle etichette: per la mappa vedi posizionaEtichette.
export function labelsToHide(pins: LabelPin[], zoom: number): Set<string> {
  const res = posizionaEtichette(
    pins.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, size: p.big ? 53 : 36, label: p.name })),
    zoom,
  );
  return new Set(pins.filter((p) => res[p.id] == null).map((p) => p.id));
}

// Etichette sulla mappa (revisore del 1/11: "Kiko Sushi Tras…" e "Santa Cocktail…" coprivano i
// segnalini vicini, il segnalibro dei salvati copriva "Rooftop Tre"). Ogni segnalino è un ostacolo;
// ogni nome prova sotto il suo segnalino, poi a destra, poi a sinistra; se tocca un altro segnalino o
// un nome già messo si nasconde (il segnalino resta, toccabile, e il nome torna avvicinando la mappa).
// I nomi "fissi" (selezionato, prime card) non si nascondono mai: prendono il posto più libero.
export type MapItem = {
  id: string;
  lat: number;
  lng: number;
  size: number; // diametro del segnalino a schermo (px)
  anchor?: "bottom" | "center"; // bottom: il segnalino sta sopra il punto (pin); center: gruppi
  label?: string | null; // nome da mostrare; null o assente = nessun nome
  extraW?: number; // larghezza in più del nome (es. "📌 ")
  fixed?: boolean; // nome sempre in vista
  dx?: number; // spostamento a schermo del segnalino (vedi separaSegnalini)
  dy?: number;
  // Un lato solo (mappa dei salvati, revisore del 2/11: nomi a volte sotto, a volte sopra o di lato
  // non si leggevano come una mappa ordinata): il nome sta sempre lì; l'altro lato orizzontale solo
  // se da lì uscirebbe dallo schermo. Se il posto è occupato il nome si nasconde (tranne i fissi).
  lato?: LabelSide;
};

export type LabelSide = "sotto" | "destra" | "sinistra" | "sopra";

const LATO_GAP = 3;

// Il segnalino con un filo di margine (bordo e ombra): un nome che lo sfiora sembra già sopra.
const ICON_MARGIN = 3;

function iconRect(it: MapItem, x: number, y: number): Rect {
  const r = it.size / 2 + ICON_MARGIN;
  return it.anchor === "center"
    ? { x1: x - r, x2: x + r, y1: y - r, y2: y + r }
    : { x1: x - r, x2: x + r, y1: y - it.size - ICON_MARGIN, y2: y + ICON_MARGIN };
}

/** Riquadro a schermo del nome di `it` sul lato dato (x, y = punto del segnalino, già scostato). */
export function labelRect(it: MapItem, x: number, y: number, side: LabelSide): Rect {
  const w = Math.min(LABEL_MAX_W, labelWidth(it.label ?? "") + (it.extraW ?? 0));
  const r = it.size / 2;
  const cy = it.anchor === "center" ? y : y - r; // centro del segnalino
  if (side === "sotto") {
    const top = (it.anchor === "center" ? y + r : y) + GAP;
    return { x1: x - w / 2 + SLACK, x2: x + w / 2 - SLACK, y1: top, y2: top + LABEL_H };
  }
  if (side === "sopra") {
    const bottom = (it.anchor === "center" ? y - r : y - it.size) - GAP;
    return { x1: x - w / 2 + SLACK, x2: x + w / 2 - SLACK, y1: bottom - LABEL_H, y2: bottom };
  }
  const x1 = side === "destra" ? x + r + LATO_GAP : x - r - LATO_GAP - w;
  return { x1: x1 + SLACK, x2: x1 + w - SLACK, y1: cy - LABEL_H / 2, y2: cy + LABEL_H / 2 };
}

// items in ordine di importanza. Restituisce, per ogni id con un nome in vista, il lato del nome.
// Con `schermo` (punti già proiettati dalla mappa e misure del riquadro) un nome che uscirebbe dallo
// schermo prova un altro lato; senza, si usa la proiezione di Mercatore allo zoom dato.
export function posizionaEtichette(
  items: MapItem[],
  zoom: number,
  schermo?: { project: (lat: number, lng: number) => { x: number; y: number }; w: number; h: number },
): Record<string, LabelSide> {
  const pts = items.map((it) => {
    const q = schermo ? schermo.project(it.lat, it.lng) : project(it.lat, it.lng, zoom);
    return { x: q.x + (it.dx ?? 0), y: q.y + (it.dy ?? 0) };
  });
  const fuori = (r: Rect) => !!schermo && (r.x1 - SLACK < 0 || r.x2 + SLACK > schermo.w || r.y1 < 0 || r.y2 > schermo.h);
  const icons = items.map((it, i) => iconRect(it, pts[i].x, pts[i].y));
  const placed: Rect[] = [];
  const out: Record<string, LabelSide> = {};
  const sides: LabelSide[] = ["sotto", "destra", "sinistra", "sopra"];
  const area = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1)) * Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  // Quanto il nome copre (in px²): un altro nome pesa il doppio di un segnalino, uscire dallo schermo di più.
  const urti = (rect: Rect, self: number) =>
    icons.reduce((n, ic, j) => n + (j !== self ? area(rect, ic) : 0), 0) + placed.reduce((n, r) => n + 2 * area(rect, r), 0);
  // Quanto del segnalino è coperto da uno più importante: un nome accanto a una pila di segnalini
  // non si capisce di chi sia, quindi lì resta solo il nome del primo.
  const coperto = (i: number) => icons.slice(0, i).some((ic) => {
    const a = icons[i];
    const w = Math.min(a.x2, ic.x2) - Math.max(a.x1, ic.x1);
    const h = Math.min(a.y2, ic.y2) - Math.max(a.y1, ic.y1);
    return w > 0 && h > 0 && w * h > 0.5 * (a.x2 - a.x1) * (a.y2 - a.y1);
  });
  items.forEach((it, i) => {
    if (!it.label) return;
    if (!it.fixed && coperto(i)) return;
    const { x, y } = pts[i];
    let best: { side: LabelSide; rect: Rect; n: number } | null = null;
    const opposto: LabelSide | null = it.lato === "destra" ? "sinistra" : it.lato === "sinistra" ? "destra" : it.lato === "sotto" ? "sopra" : it.lato === "sopra" ? "sotto" : null;
    const prova = it.lato ? (fuori(labelRect(it, x, y, it.lato)) && opposto ? [opposto] : [it.lato]) : sides;
    for (const side of prova) {
      const rect = labelRect(it, x, y, side);
      const n = urti(rect, i) + (fuori(rect) ? 10_000 : 0);
      if (n === 0) { best = { side, rect, n }; break; }
      if (it.fixed && (best == null || n < best.n)) best = { side, rect, n };
    }
    if (best && (best.n === 0 || it.fixed)) {
      out[it.id] = best.side;
      placed.push(best.rect);
    }
  });
  return out;
}

// Segnalini uno sopra l'altro (revisore del 1/11, 05c e 05f: undici risultati in pochi isolati erano
// un grumo da cui non si capiva quale fosse quale). Allo zoom attuale, ogni segnalino che copre uno più
// importante si sposta di poco (al massimo `max` px) nel primo punto libero intorno, allontanandosi da
// chi copre. Il punto vero resta quello di Google: è solo il disegno a schermo che si scosta, come il
// "ventaglio" delle mappe quando due locali stanno nello stesso palazzo. Avvicinando la mappa lo
// spostamento torna a zero da solo. I segnalini "fermi" (selezionato, card al centro) non si muovono.
export type Segnalino = { id: string; x: number; y: number; size: number; fermo?: boolean };

// Revisore del 2/11 (Spirito di Vino sotto Da Enzo, colonna di segnalini in 05c): con al massimo 28 px
// lo spostamento non bastava e i segnalini restavano a contatto. Ora si cerca il punto libero più vicino
// fino a `max` px (anelli ogni 4 px, 24 direzioni), con un filo di aria (GAP) tra i bordi: a qualsiasi
// zoom i segnalini non si toccano. Il calcolo si rifà a ogni disegno, quindi avvicinando la mappa lo
// spostamento cala da solo fino a zero.
export function separaSegnalini(items: Segnalino[], max = 84): Record<string, { dx: number; dy: number }> {
  const GAP = 6;
  const out: Record<string, { dx: number; dy: number }> = {};
  const placed: { x: number; y: number; r: number }[] = [];
  const urto = (x: number, y: number, r: number) =>
    placed.reduce((n, p) => n + Math.max(0, r + p.r + GAP - Math.hypot(x - p.x, y - p.y)), 0);
  // I fermi per primi: gli altri si scostano da loro, mai il contrario.
  const ordine = [...items.filter((it) => it.fermo), ...items.filter((it) => !it.fermo)];
  for (const it of ordine) {
    const r = it.size / 2;
    let best = { x: it.x, y: it.y, n: urto(it.x, it.y, r) };
    if (!it.fermo && best.n > 0) {
      // Direzione di partenza: lontano dal segnalino più vicino (se coincidono, verso destra).
      const vicino = placed.reduce<{ x: number; y: number; d: number } | null>((m, p) => {
        const d = Math.hypot(it.x - p.x, it.y - p.y);
        return m == null || d < m.d ? { x: p.x, y: p.y, d } : m;
      }, null);
      const a0 = vicino && vicino.d > 0.5 ? Math.atan2(it.y - vicino.y, it.x - vicino.x) : 0;
      outer: for (let raggio = 4; raggio <= max; raggio += 4) {
        for (let k = 0; k < 24; k++) {
          // Angoli alternati intorno alla direzione di partenza: 0, +15°, -15°, +30°, …
          const a = a0 + (k % 2 === 0 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 12);
          const x = it.x + Math.cos(a) * raggio;
          const y = it.y + Math.sin(a) * raggio;
          const n = urto(x, y, r);
          if (n < best.n - 0.5) best = { x, y, n };
          if (n === 0) break outer;
        }
      }
    }
    placed.push({ x: best.x, y: best.y, r });
    const dx = Math.round(best.x - it.x);
    const dy = Math.round(best.y - it.y);
    if (dx !== 0 || dy !== 0) out[it.id] = { dx, dy };
  }
  return out;
}

// Inquadratura dopo una ricerca (revisore del 1/11, 05c: un risultato a 8 km allargava la mappa a tutta
// Roma e gli altri undici finivano in un grumo). Un punto lontanissimo dagli altri (oltre 3 volte la
// distanza tipica dal centro del gruppo, e comunque oltre 1 km) non allarga la mappa: resta nella lista
// e con il suo segnalino. Con meno di 4 punti, o se gli "anomali" fossero tanti, si inquadra tutto.
export function puntiDaInquadrare<T extends { lat: number; lng: number }>(list: T[]): T[] {
  if (list.length < 4) return list;
  const mediana = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const c = { lat: mediana(list.map((p) => p.lat)), lng: mediana(list.map((p) => p.lng)) };
  const k = Math.cos((c.lat * Math.PI) / 180);
  const metri = (p: { lat: number; lng: number }) => Math.hypot(p.lat - c.lat, (p.lng - c.lng) * k) * 111_320;
  const d = list.map(metri);
  const soglia = Math.max(3 * mediana(d), 1000);
  const tenuti = list.filter((_, i) => d[i] <= soglia);
  return tenuti.length >= Math.ceil(list.length * 0.75) ? tenuti : list;
}
