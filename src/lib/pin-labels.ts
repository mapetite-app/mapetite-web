// Etichette dei pin dopo una ricerca: se il nome di un risultato finirebbe sopra quello di
// un risultato più in alto in lista (o sopra il suo pin), si nasconde il nome meno importante.
// Il pin resta, toccabile; il nome torna quando si avvicina la mappa.
// Calcolo puro, senza la mappa: proiezione di Mercatore come Mapbox (riquadri da 512 px).

export type LabelPin = { id: string; lat: number; lng: number; name: string; big?: boolean };

type Rect = { x1: number; y1: number; x2: number; y2: number };

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

function labelRect(it: MapItem, x: number, y: number, side: LabelSide): Rect {
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
  const pts = items.map((it) => (schermo ? schermo.project(it.lat, it.lng) : project(it.lat, it.lng, zoom)));
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
    for (const side of sides) {
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
