import { isStateTag, normalizeTagName } from "@/lib/tags";

// Raccolte come cartelle (piano 4.1). Una raccolta resta un tag dei salvati (saved_places.tags,
// esclusi stati e opinioni): nessuna tabella nuova. Qui solo funzioni pure, usate da server
// e browser.

type Tagged = { tags: string[] | null };

/** Indirizzo della pagina di una propria raccolta. */
export const collectionPath = (name: string) => `/raccolte/${encodeURIComponent(name)}`;
/** Indirizzo pubblico (sola lettura) della raccolta di una persona con profilo pubblico. */
export const publicCollectionPath = (handle: string, name: string) => `/u/${handle}/raccolte/${encodeURIComponent(name)}`;

/** Nome dalla parte dell'indirizzo ("Con%20amici" → "Con amici"); null se non leggibile. */
export function collectionFromParam(raw: string): string | null {
  try {
    const name = decodeURIComponent(raw).trim();
    return name && name.length <= 40 ? name : null;
  } catch {
    return null;
  }
}

export type CollectionSummary<T> = { name: string; count: number; preview: T[] };

/** Raccolte dei salvati, dalla più piena; preview = i primi locali (nell'ordine ricevuto) per la copertina. */
export function summarizeCollections<T extends Tagged>(rows: T[], previewSize = 4): CollectionSummary<T>[] {
  const byTag = new Map<string, CollectionSummary<T>>();
  for (const row of rows) {
    for (const tag of new Set(row.tags ?? [])) {
      if (isStateTag(tag) || !tag.trim()) continue;
      const c = byTag.get(tag) ?? { name: tag, count: 0, preview: [] };
      c.count++;
      if (c.preview.length < previewSize) c.preview.push(row);
      byTag.set(tag, c);
    }
  }
  return [...byTag.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "it"));
}

/** Salvati di una raccolta. */
export function inCollection<T extends Tagged>(rows: T[], name: string): T[] {
  return rows.filter((r) => r.tags?.includes(name));
}

/** Salvati che non sono in nessuna raccolta (solo stati o nessun tag). */
export function withoutCollection<T extends Tagged>(rows: T[]): T[] {
  return rows.filter((r) => !(r.tags ?? []).some((t) => !isStateTag(t) && t.trim() !== ""));
}

// Colore della cartella: sempre lo stesso per lo stesso nome, scelto tra toni della palette
// Mapetite (teal del marchio e varianti calde vicine al corallo). Testo bianco leggibile su tutti.
const FOLDER_COLORS = ["#1a3c40", "#2a5b60", "#7a4b3a", "#3d4f7c", "#5b6b3a", "#8a3f4f"] as const;
export function collectionColor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return FOLDER_COLORS[h % FOLDER_COLORS.length];
}

export const placesLabel = (n: number) => `${n} ${n === 1 ? "locale" : "locali"}`;

/** Nome scritto → nome definitivo della raccolta, oppure messaggio d'errore. "existing": tutti i tag già usati. */
export function checkCollectionName(raw: string, existing: string[], current?: string): { tag: string } | { error: string } {
  const tag = normalizeTagName(raw, existing.filter((t) => t !== current));
  if (!tag) return { error: "Scrivi un nome per la raccolta." };
  if (isStateTag(tag)) return { error: "Questo nome è già usato per lo stato del locale (Voglio andarci / Ci sono stato): scegline un altro." };
  return { tag };
}
