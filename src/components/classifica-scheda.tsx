"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { browserClient } from "@/lib/supabase/client-lazy";
import { cityFromAddress } from "@/lib/city";
import { isMissingColumn, sortByScore } from "@/lib/classifica";
import ClassificaConfronto, { type RankedPlace } from "@/components/classifica-confronto";

// Nella scheda di un locale salvato e segnato "Ci sono stato": la sua posizione nella classifica
// personale della città o, se non c'è ancora, il confronto "più o meno di X?". Se la colonna
// rank_score non esiste (migrazione 20261015_classifica non applicata) non mostra niente.

type Loaded =
  | { stato: "nascosto" }
  | { stato: "pronto"; city: string; ranked: RankedPlace[]; mine: number | null };

const VISITED = "Già visitato";

export default function ClassificaScheda({
  userId,
  place,
}: {
  userId: string;
  place: { id: string; name: string; category: string | null; address: string | null }; // id = UUID Supabase
}) {
  const [data, setData] = useState<Loaded | null>(null);
  const [redo, setRedo] = useState(false);
  const city = cityFromAddress(place.address);

  useEffect(() => {
    if (!city) return;
    let alive = true;
    (async () => {
      const supabase = await browserClient().catch(() => null);
      if (!supabase) { if (alive) setData({ stato: "nascosto" }); return; }
      const { data: rows, error } = await supabase
        .from("saved_places")
        .select("place_id, rank_score, tags, places (name, category, address)")
        .eq("user_id", userId)
        .not("rank_score", "is", null);
      if (!alive) return;
      if (error) {
        if (!isMissingColumn(error)) console.error("[classifica] lettura fallita:", error.message);
        setData({ stato: "nascosto" });
        return;
      }
      type Row = { place_id: string; rank_score: number | string | null; tags: string[] | null; places: { name: string; category: string | null; address: string | null } | null };
      const list = ((rows ?? []) as unknown as Row[]).filter(
        (r) => r.places && r.rank_score != null && r.tags?.includes(VISITED) && cityFromAddress(r.places.address) === city,
      );
      const mine = list.find((r) => r.place_id === place.id);
      const ranked = sortByScore(
        list.filter((r) => r.place_id !== place.id).map((r) => ({ id: r.place_id, name: r.places!.name, category: r.places!.category, score: Number(r.rank_score) })),
      );
      // Primo provato della città: entra in classifica senza domande (non c'è nulla con cui confrontarlo).
      let mineScore = mine ? Number(mine.rank_score) : null;
      if (mineScore == null && ranked.length === 0) {
        const { error: wErr } = await supabase.from("saved_places").update({ rank_score: 0 }).eq("user_id", userId).eq("place_id", place.id);
        if (!wErr) mineScore = 0;
      }
      if (alive) setData({ stato: "pronto", city, ranked, mine: mineScore });
    })();
    return () => { alive = false; };
  }, [userId, place.id, city]);

  const save = async (score: number) => {
    const supabase = await browserClient().catch(() => null);
    if (!supabase) return false;
    const { error } = await supabase.from("saved_places").update({ rank_score: score }).eq("user_id", userId).eq("place_id", place.id);
    if (error) return false;
    setData((d) => (d && d.stato === "pronto" ? { ...d, mine: score } : d));
    setRedo(false);
    return true;
  };

  if (!city || !data || data.stato === "nascosto") return null;

  if (data.mine == null || redo) {
    if (data.ranked.length === 0) return null;
    return (
      <div className="mt-3">
        <ClassificaConfronto target={place} city={data.city} ranked={data.ranked} onSave={save} onSkip={redo ? () => setRedo(false) : undefined} />
      </div>
    );
  }

  const position = data.ranked.filter((r) => r.score > data.mine!).length + 1;
  const total = data.ranked.length + 1;
  return (
    <div data-testid="classifica-posizione" className="mt-3 flex items-center gap-3 rounded-card bg-accent-light/60 px-3 py-2.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent font-title text-lg font-semibold text-white">{position}</span>
      <span className="min-w-0 flex-1 text-sm text-text">
        <span className="block font-display font-semibold">{position === 1 ? `Il tuo preferito a ${data.city}` : `${position}° nella tua classifica di ${data.city}`}</span>
        <span className="block text-xs text-text-muted">su {total} {total === 1 ? "posto provato" : "posti provati"} · <Link href="/profilo#classifica" className="font-semibold text-accent">vedi la classifica</Link></span>
      </span>
      {data.ranked.length > 0 && (
        <button type="button" onClick={() => setRedo(true)} className="min-h-10 shrink-0 text-xs font-display font-semibold text-brand">
          Rifai
        </button>
      )}
    </div>
  );
}
