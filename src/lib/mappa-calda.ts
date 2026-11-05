// Mappa "calda" (piano 1–8/11, area 4e; Lorenzo 5/11: niente più crema/beige, "dà un'idea cheap": terra grigio chiaro neutro): la base grigia di Mapbox (light-v11) con colori caldi e
// tenui, nello stile delle app di riferimento (Places, Mapstr): crema per la terra, verde salvia per
// i parchi, azzurro polvere per l'acqua. Solo vernice sopra lo stile già scaricato: nessuna
// richiesta in più, nessun costo. ?mappa=chiara torna alla mappa grigia di prima.

export type MappaVernice = {
  getStyle: () => { layers?: { id: string; type?: string }[] } | undefined;
  setPaintProperty: (id: string, k: string, v: unknown) => void;
  getPaintProperty?: (id: string, k: string) => unknown;
};

export const MAPPA_CALDA = {
  terra: "#f3f4f2",
  edifici: "#e7e9e6",
  parchi: "#dde8d9",
  acqua: "#cfe2e4",
  acquaTesto: "#6f9399",
  stradeBordo: "#e2e5e2",
  strade: "#ffffff",
} as const;

export function vernicaMappaCalda(map: MappaVernice) {
  const c = MAPPA_CALDA;
  const metti = (id: string, k: string, v: unknown) => {
    try { map.setPaintProperty(id, k, v); } catch { /* livello assente in questo stile */ }
  };
  // Già verniciata (styledata arriva più volte): niente da rifare.
  try { if (map.getPaintProperty?.("land", "background-color") === c.terra) return; } catch { /* stile senza "land" */ }
  let layers: { id: string; type?: string }[] = [];
  try { layers = map.getStyle()?.layers ?? []; } catch { return; }
  for (const { id, type } of layers) {
    if (type === "background") metti(id, "background-color", c.terra);
    else if (id === "landcover" && type === "fill") metti(id, "fill-color", c.parchi);
    else if ((id === "national-park" || id === "landuse") && type === "fill") {
      // Parchi, prati, giardini in salvia; il resto (scuole, ospedali…) si confonde con la terra.
      metti(id, "fill-color", ["match", ["get", "class"], ["park", "grass", "pitch", "wood", "cemetery", "garden", "national_park", "scrub"], c.parchi, c.terra]);
    } else if (id === "water" && type === "fill") metti(id, "fill-color", c.acqua);
    else if (id === "waterway" && type === "line") metti(id, "line-color", c.acqua);
    else if (id.startsWith("building") && type === "fill") metti(id, "fill-color", c.edifici);
    else if (/^(road|bridge|tunnel)-.*case/.test(id) && type === "line") metti(id, "line-color", c.stradeBordo);
    else if (/^(road|bridge|tunnel)-/.test(id) && type === "line" && !/rail|path|steps|pedestrian|construction/.test(id)) metti(id, "line-color", c.strade);
    else if (/water.*label/.test(id) && type === "symbol") metti(id, "text-color", c.acquaTesto);
  }
}
