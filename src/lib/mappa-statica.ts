// Copertine "mappa" (sessione del 14/11): i revisori dell'8/11 hanno bocciato gli scaffali dei salvati perché
// "senza foto". Le foto Google dei salvati non si possono conservare (termini Google, 3.2.3(b)) e chiederle per
// 500 salvati finirebbe la quota foto (200/giorno). Al loro posto: una mappa statica Mapbox (nessun costo Google,
// stessa fonte della mappa nella scheda) inquadrata sui posti del gruppo, con i puntini disegnati da noi.
// Funzioni pure: centro e zoom si calcolano qui, così i puntini cadono esattamente dove sono i posti.

export type Punto = { lat: number; lng: number };
export type MappaStatica = { url: string; punti: { x: number; y: number; i: number }[] }; // i = indice in nucleo(punti)

const TILE = 512; // le immagini statiche Mapbox usano tessere da 512 px
const ZOOM_MIN = 11;
const ZOOM_MAX = 14.5; // più vicino si vedono due strade e nessun nome: la copertina non dice dove siamo
const RAGGIO_GRUPPO_M = 1_200; // revisori 14/11: con 6 e 2,5 km i posti lontani finivano fuori dal riquadro (copertine vuote)

const mx = (lng: number) => (lng + 180) / 360;
const my = (lat: number) => {
  const s = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
};
const lngDi = (x: number) => x * 360 - 180;
const latDi = (y: number) => (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;

function metri(a: Punto, b: Punto): number {
  const r = Math.PI / 180;
  const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6_371_000;
}

// Un gruppo sparso tra Roma e Milano non sta in una copertina: si tiene il nucleo più denso (il posto con più
// vicini entro 1,2 km e quelli attorno). Meglio una zona leggibile che due città in un francobollo.
export function nucleo<T extends Punto>(punti: readonly T[], raggio = RAGGIO_GRUPPO_M): T[] {
  const validi = punti.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && (p.lat !== 0 || p.lng !== 0));
  if (validi.length <= 1) return validi;
  let best = validi[0];
  let bestN = -1;
  for (const p of validi) {
    const n = validi.filter((q) => metri(p, q) <= raggio).length;
    if (n > bestN) { bestN = n; best = p; }
  }
  return validi.filter((q) => metri(best, q) <= raggio);
}

// Centro e zoom che fanno stare tutti i punti nel riquadro w×h con un margine; puntini in % del riquadro.
// raggio: quanto può essere largo il gruppo; la mappa grande del profilo ne tiene di più delle copertine.
export function mappaStatica(punti: readonly Punto[], w: number, h: number, token: string | undefined, margine = 12, raggio = RAGGIO_GRUPPO_M): MappaStatica | null {
  const vista = nucleo(punti, raggio).slice(0, 12);
  if (!token || vista.length === 0) return null;
  const xs = vista.map((p) => mx(p.lng));
  const ys = vista.map((p) => my(p.lat));
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const zx = x1 > x0 ? Math.log2((w - 2 * margine) / ((x1 - x0) * TILE)) : ZOOM_MAX;
  const zy = y1 > y0 ? Math.log2((h - 2 * margine) / ((y1 - y0) * TILE)) : ZOOM_MAX;
  const z = Math.round(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zx, zy)) * 100) / 100;
  const scala = TILE * 2 ** z;
  const at = `${lngDi(cx).toFixed(5)},${latDi(cy).toFixed(5)},${z}`;
  // Logo e attribuzione nel riquadro coprirebbero metà copertina: l'attribuzione è scritta sotto gli scaffali.
  const url = `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${at},0/${w}x${h}@2x?attribution=false&logo=false&access_token=${token}`;
  const dentro = vista.map((p, i) => ({
    i,
    x: Math.round(((mx(p.lng) - cx) * scala + w / 2) / w * 1000) / 10,
    y: Math.round(((my(p.lat) - cy) * scala + h / 2) / h * 1000) / 10,
  })).filter((pt) => pt.x >= 5 && pt.x <= 95 && pt.y >= 6 && pt.y <= 94);
  // Una mappa senza i suoi posti (o con meno della metà) non dice niente: meglio la copertina di prima.
  if (dentro.length === 0 || dentro.length * 2 < vista.length) return null;
  return {
    url,
    // Con lo zoom al minimo un posto può cadere fuori: niente mezzi puntini sul bordo (revisore 14/11).
    punti: dentro,
  };
}
