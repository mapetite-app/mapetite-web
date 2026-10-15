import { isStateTag } from "@/lib/tags";
import type { MapSpot } from "@/components/mappa-persona";

// Funzioni pure per le pagine social (profilo pubblico, mappa di una persona, feed).
type SavedLike = {
  place_id: string;
  name: string;
  category: string | null;
  lat: number | null;
  lng: number | null;
  tags: string[] | null;
};

export const VISITED = "Già visitato";
export const WANT = "Da provare";

export const isVisited = (s: { tags: string[] | null }) => !!s.tags?.includes(VISITED);

export function mapSpots(rows: SavedLike[]): MapSpot[] {
  return rows.flatMap((r) =>
    r.lat != null && r.lng != null && Number.isFinite(r.lat) && Number.isFinite(r.lng)
      ? [{ id: r.place_id, name: r.name, category: r.category, lat: Number(r.lat), lng: Number(r.lng), visited: isVisited(r) }]
      : [],
  );
}

/** Raccolte pubbliche = i tag scelti dalla persona (esclusi stati e opinioni), con quanti posti. */
export function publicCollections(rows: SavedLike[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of rows) for (const t of r.tags ?? []) if (!isStateTag(t)) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "it"));
}

/** "1 posto" / "3 posti" e simili. */
export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Feed: righe consecutive della stessa persona diventano un gruppo ("Giulia ha salvato X e altri 2 posti"). */
export function groupActivity<T extends { user_id: string }>(rows: T[], maxGroups = 20): T[][] {
  const groups: T[][] = [];
  for (const r of rows) {
    const last = groups[groups.length - 1];
    if (last && last[0].user_id === r.user_id) last.push(r);
    else groups.push([r]);
  }
  return groups.slice(0, maxGroups);
}

/** "oggi", "ieri", "3 giorni fa", "12 set". */
export function whenLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = (x: Date) => Math.floor(new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime() / 86400000);
  const diff = day(now) - day(d);
  if (diff <= 0) return "oggi";
  if (diff === 1) return "ieri";
  if (diff < 7) return `${diff} giorni fa`;
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}
