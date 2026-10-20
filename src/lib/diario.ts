// Diario dei posti provati (piano 4.4): data della visita, voto, nota privata.
// Niente colonne nuove per voto e nota: il voto è il "Com'era?" che esiste già (tag 👍/👎,
// letti da suggerimenti e "Stasera"), la nota è saved_places.note. Nuova solo la data
// (saved_places.visited_at, migrazione 20261015_diario).
// Funzioni pure, senza dipendenze (le usa anche scripts/e2e/giro.mjs): per questo i nomi dei
// tag sono ripetuti qui invece di importarli da tags.ts.

export const VISITED = "Già visitato";
export const LIKE = "Mi è piaciuto"; // = OPINION_LIKE in tags.ts
export const DISLIKE = "Non fa per me"; // = OPINION_DISLIKE in tags.ts

export type Voto = "su" | "giu";

export function votoOf(tags: string[] | null | undefined): Voto | null {
  if (tags?.includes(LIKE)) return "su";
  if (tags?.includes(DISLIKE)) return "giu";
  return null;
}

export const votoTag = (v: Voto) => (v === "su" ? LIKE : DISLIKE);

/** Tag con il voto scelto (o senza voto): toglie l'altro, tiene tutto il resto nell'ordine. */
export function withVoto(tags: string[] | null | undefined, voto: Voto | null): string[] {
  const base = (tags ?? []).filter((t) => t !== LIKE && t !== DISLIKE);
  return voto ? [...base, votoTag(voto)] : base;
}

/** Tag dopo "Ci sono stato": tolto "Da provare", aggiunto "Già visitato" (una volta sola). */
export function withVisited(tags: string[] | null | undefined): string[] {
  return [...(tags ?? []).filter((t) => t !== "Da provare" && t !== VISITED), VISITED];
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Giorno di calendario del telefono (non UTC: alle 00:30 è già "oggi"), formato AAAA-MM-GG. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function daysAgoKey(days: number, now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
  return dayKey(d);
}

/** Data valida AAAA-MM-GG (anche dal database: "2026-10-12" o "2026-10-12T00:00:00"). */
export function cleanDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) ? m[0] : null;
}

const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

/** "Ottobre 2026" per la chiave "2026-10". */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const name = MESI[(m ?? 1) - 1] ?? "";
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
}

/** "12 ottobre 2026"; "oggi" e "ieri" quando lo sono. */
export function dateLabel(date: string, now = new Date()): string {
  if (date === dayKey(now)) return "oggi";
  if (date === daysAgoKey(1, now)) return "ieri";
  const [y, m, d] = date.split("-").map(Number);
  return `${d} ${MESI[m - 1]}${y === now.getFullYear() ? "" : ` ${y}`}`;
}

/** "oggi", "ieri", "il 12 ottobre" (dopo "Ci sei stato"). */
export function whenLabel(date: string, now = new Date()): string {
  const l = dateLabel(date, now);
  return l === "oggi" || l === "ieri" ? l : `il ${l}`;
}

/** Giorno corto per la riga del diario: "12" e "ott". */
export function dayParts(date: string): { day: string; month: string } {
  const [, m, d] = date.split("-").map(Number);
  return { day: String(d), month: MESI[m - 1].slice(0, 3) };
}

export type DiaryGroup<T> = { key: string; label: string; items: T[] };

/** Visite raggruppate per mese, dalla più recente; quelle senza data in fondo, in un gruppo a parte. */
export function groupByMonth<T extends { date: string | null; savedAt: string }>(items: T[]): DiaryGroup<T>[] {
  const dated = items.filter((i) => i.date).sort((a, b) => b.date!.localeCompare(a.date!) || b.savedAt.localeCompare(a.savedAt));
  const groups: DiaryGroup<T>[] = [];
  for (const it of dated) {
    const key = it.date!.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(it);
    else groups.push({ key, label: monthLabel(key), items: [it] });
  }
  const undated = items.filter((i) => !i.date).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  if (undated.length > 0) groups.push({ key: "senza-data", label: "Senza data", items: undated });
  return groups;
}

/** Errore di Supabase/PostgREST quando la colonna visited_at non esiste (migrazione da applicare). */
export function isMissingVisitedAt(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "42703" || error.code === "PGRST204" || /visited_at/.test(error.message ?? "");
}

// "I tuoi posti fissi" (PROPOSTE.md, proposta 8): saved_places.visite (migrazione 20261020b_visite)
// conta i "Ci sono tornato". 0 con il tag "Già visitato" = una visita (le righe vecchie non si riscrivono).
export const POSTO_FISSO = 2;

export function visiteDi(tags: string[] | null | undefined, visite: unknown): number {
  const n = typeof visite === "number" && Number.isFinite(visite) ? Math.max(0, Math.min(999, Math.floor(visite))) : 0;
  return Math.max(n, tags?.includes(VISITED) ? 1 : 0);
}

/** "2ª volta", "3ª volta"… */
export const voltaLabel = (n: number) => `${n}ª volta`;
