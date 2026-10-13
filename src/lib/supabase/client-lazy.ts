// Client Supabase del browser caricato solo quando serve (≈70 kB compressi in meno
// prima che la pagina diventi usabile). Per le pagine dove Supabase si usa solo dopo
// un tocco (salvare, segnare come visitato, aggiornare una raccolta).
// Il pacchetto si scarica comunque appena il telefono è libero, dopo il primo disegno:
// al tocco è già pronto, anche se nel frattempo la rete è caduta.
const load = () => import("./client");

if (typeof window !== "undefined") {
  const warm = () => { void load().catch(() => {}); };
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(warm, { timeout: 4000 });
  else setTimeout(warm, 2000);
}

export async function browserClient() {
  const { createClient } = await load();
  return createClient();
}
