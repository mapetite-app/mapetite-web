// Firme del server sui dati Google dei risultati di ricerca (src/lib/catalog-sig.ts), lato telefono.
// Chi riceve risultati da /api/search o /api/places/search li passa a rememberFirme; chi chiama
// /api/places/add aggiunge firmaPer(Place ID) al corpo. Così il catalogo condiviso riceve solo
// dati usciti da Google, qualunque giro facciano i risultati tra mappa, scheda e assistente.
// In memoria e in sessionStorage (sopravvive al ricaricamento della pagina), mai obbligatoria:
// senza firma il locale si salva lo stesso.

const KEY = "mapetite-firme-catalogo";
const MAX = 300;
const firme = new Map<string, string>();
let loaded = false;

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = sessionStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as [string, string][]) : [];
    if (Array.isArray(list)) for (const [id, f] of list) if (typeof id === "string" && typeof f === "string") firme.set(id, f);
  } catch { /* navigazione privata o dati rovinati: si riparte vuoti */ }
}

function persist() {
  try { sessionStorage.setItem(KEY, JSON.stringify([...firme].slice(-MAX))); } catch { /* spazio pieno o privata */ }
}

/** Registra le firme di una lista di risultati ({ id, firma }). Accetta qualsiasi cosa. */
export function rememberFirme(list: unknown): void {
  if (!Array.isArray(list)) return;
  load();
  let changed = false;
  for (const r of list as { id?: unknown; firma?: unknown }[]) {
    if (r && typeof r.id === "string" && typeof r.firma === "string") {
      firme.delete(r.id);
      firme.set(r.id, r.firma);
      changed = true;
    }
  }
  while (firme.size > MAX) firme.delete(firme.keys().next().value as string);
  if (changed) persist();
}

/** Firma del locale (Place ID Google), se è arrivato da una ricerca di questa sessione. */
export function firmaPer(googlePlaceId: string): string | undefined {
  load();
  return firme.get(googlePlaceId);
}
