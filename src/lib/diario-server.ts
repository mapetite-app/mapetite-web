import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { cleanDate, isMissingVisitedAt, VISITED } from "@/lib/diario";

// Lettura del diario (piano 4.4): i salvati segnati "Ci sono stato" con data, voto (tag) e nota.
// La data si legge a parte: senza la colonna visited_at (migrazione 20261015_diario non applicata)
// il diario funziona lo stesso, senza date (withDate = false).
export type DiaryEntry = {
  id: string; // UUID di places
  name: string;
  category: string | null;
  address: string | null;
  tags: string[];
  note: string | null;
  date: string | null; // AAAA-MM-GG
  savedAt: string;
};

type Row = {
  created_at: string;
  tags: string[] | null;
  note: string | null;
  visited_at?: string | null; // solo nei dati finti del giro (la colonna si legge a parte)
  places: { id: string; name: string; category: string | null; address: string | null } | null;
};

function toEntries(rows: Row[], dates: Map<string, string | null> | null): DiaryEntry[] {
  return rows.flatMap((r) =>
    r.places && r.tags?.includes(VISITED)
      ? [{ id: r.places.id, name: r.places.name, category: r.places.category, address: r.places.address, tags: r.tags, note: r.note, date: dates?.get(r.places.id) ?? null, savedAt: r.created_at }]
      : [],
  );
}

// Solo in sviluppo con E2E_FAKE_USER: stessi dati finti del profilo (cookie "e2e_profilo",
// scritto da scripts/e2e/giro.mjs); "diario": false simula la migrazione non applicata.
async function e2eDiary(): Promise<{ entries: DiaryEntry[]; withDate: boolean } | null> {
  if (process.env.NODE_ENV !== "development" || !process.env.E2E_FAKE_USER) return null;
  const raw = (await cookies()).get("e2e_profilo")?.value;
  if (!raw) return null;
  try {
    const data = JSON.parse(decodeURIComponent(raw)) as { saved?: Row[]; diario?: boolean };
    const withDate = data.diario !== false;
    const rows = data.saved ?? [];
    const dates = withDate ? new Map(rows.flatMap((r) => (r.places ? [[r.places.id, cleanDate(r.visited_at)] as [string, string | null]] : []))) : null;
    return { entries: toEntries(rows, dates), withDate };
  } catch {
    return null;
  }
}

export async function loadDiary(userId: string): Promise<{ entries: DiaryEntry[]; withDate: boolean }> {
  const fake = await e2eDiary();
  if (fake) return fake;
  const supabase = await createClient();
  const [{ data, error }, { data: dateRows, error: dateError }] = await Promise.all([
    supabase
      .from("saved_places")
      .select("created_at, tags, note, places (id, name, category, address)")
      .eq("user_id", userId)
      .contains("tags", [VISITED])
      .order("created_at", { ascending: false }),
    supabase.from("saved_places").select("place_id, visited_at").eq("user_id", userId).not("visited_at", "is", null),
  ]);
  if (error) console.error("[diario] lettura salvati fallita:", error.message);
  if (dateError && !isMissingVisitedAt(dateError)) console.error("[diario] lettura date fallita:", dateError.message);
  const dates = dateError ? null : new Map((dateRows ?? []).map((r) => [r.place_id as string, cleanDate(r.visited_at)]));
  return { entries: toEntries((data ?? []) as unknown as Row[], dates), withDate: !dateError };
}
