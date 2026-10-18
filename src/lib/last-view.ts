// Dove era la mappa l'ultima volta (solo in questo telefono). La mappa riparte da lì invece che da
// Roma, e l'assistente senza GPS cerca lì: il 16/10 sera Lorenzo era a Milano e "wine bar tranquillo"
// nell'assistente cercava intorno a Roma (1 risultato; dalla mappa su Milano, 8).
const KEY = "mapetite.vista";
const MAX_AGE_MS = 30 * 24 * 3600 * 1000;

export type LastView = { lat: number; lng: number; zoom: number };

export function saveLastView(v: LastView): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ lat: +v.lat.toFixed(4), lng: +v.lng.toFixed(4), zoom: +v.zoom.toFixed(1), t: Date.now() }));
  } catch {}
}

export function readLastView(): LastView | null {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
    if (!v || ![v.lat, v.lng, v.zoom, v.t].every((n) => typeof n === "number" && Number.isFinite(n))) return null;
    if (Math.abs(v.lat) > 90 || Math.abs(v.lng) > 180 || Date.now() - v.t > MAX_AGE_MS) return null;
    return { lat: v.lat, lng: v.lng, zoom: Math.min(Math.max(v.zoom, 3), 18) };
  } catch {
    return null;
  }
}

// Posizione vera, ma solo se il permesso è GIÀ stato dato (mai la richiesta all'apertura: la chiede
// solo un tocco). Il 17/10 Lorenzo a Milano apriva la mappa su Roma e doveva riscrivere "a Milano".
// null se il permesso non c'è, se il telefono non lo dice o se tarda più di `timeoutMs`.
export async function grantedPosition(timeoutMs = 1500): Promise<{ lat: number; lng: number } | null> {
  try {
    if (typeof navigator === "undefined" || !navigator.geolocation || !navigator.permissions) return null;
    const status = await navigator.permissions.query({ name: "geolocation" });
    if (status.state !== "granted") return null;
    return await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), timeoutMs);
      navigator.geolocation.getCurrentPosition(
        (pos) => { clearTimeout(timer); resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
        () => { clearTimeout(timer); resolve(null); },
        { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 600000 },
      );
    });
  } catch {
    return null;
  }
}
