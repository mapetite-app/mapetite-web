// Etichette dei pin dopo una ricerca: se il nome di un risultato finirebbe sopra quello di
// un risultato più in alto in lista (o sopra il suo pin), si nasconde il nome meno importante.
// Il pin resta, toccabile; il nome torna quando si avvicina la mappa.
// Calcolo puro, senza la mappa: proiezione di Mercatore come Mapbox (riquadri da 512 px).

export type LabelPin = { id: string; lat: number; lng: number; name: string; big?: boolean };

type Rect = { x1: number; y1: number; x2: number; y2: number };

const LABEL_H = 20; // altezza della pillola col nome (text-[11px] + padding)
const LABEL_MAX_W = 100; // max-w-[110px], ma un nome troncato col "…" resta più stretto
const GAP = 2;
const SLACK = 4; // pochi pixel di bordo che si toccano non danno fastidio

function project(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const scale = 512 * 2 ** zoom;
  const s = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale,
  };
}

function labelWidth(name: string): number {
  return Math.min(LABEL_MAX_W, pinName(name).length * 6.2 + 16);
}

// Nome corto sul pin: l'insegna senza la descrizione che Google aggiunge dopo un trattino o una barra
// ("La Sora Cencia – Trattoria tipica romana a Trastevere" → "La Sora Cencia"), così non si legge
// "La Sora Cencia …". Il nome intero resta nella card e nella scheda.
export function pinName(name: string): string {
  const head = name.split(/\s+[–—|-]\s+|\s*\(|,\s+/)[0].trim();
  return head.length >= 3 ? head : name;
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
}

// pins in ordine di importanza (il primo vince sempre). Restituisce gli id da mostrare senza nome.
export function labelsToHide(pins: LabelPin[], zoom: number): Set<string> {
  const hidden = new Set<string>();
  const taken: Rect[] = [];
  for (const p of pins) {
    const { x, y } = project(p.lat, p.lng, zoom);
    // Marker ancorato in basso: il nome sta subito sopra il punto, il cerchio sopra il nome.
    const w = labelWidth(p.name);
    const label: Rect = { x1: x - w / 2 + SLACK, x2: x + w / 2 - SLACK, y1: y - LABEL_H, y2: y };
    const size = p.big ? 53 : 36;
    const icon: Rect = { x1: x - size / 2, x2: x + size / 2, y1: y - LABEL_H - GAP - size, y2: y - LABEL_H - GAP };
    if (taken.some((r) => overlaps(label, r))) {
      hidden.add(p.id);
      taken.push(icon);
    } else {
      taken.push(label, icon);
    }
  }
  return hidden;
}
