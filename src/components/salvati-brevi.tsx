"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { browserClient } from "@/lib/supabase/client-lazy";
import { getCategoryEmoji } from "@/lib/emoji";
import { categoryLabel } from "@/lib/category-label";
import { cityFromAddress } from "@/lib/city";
import { distanceLabel, distanceMeters } from "@/lib/distance";
import { isWanted } from "@/lib/tags";

// Due o tre salvati veri dell'utente in un riquadro (revisore 2/11): "Riparti da qui" nell'assistente
// (solo i "Da provare", i più vicini se la posizione è nota) e "Ultimi aggiunti" in Importa.
// Una lettura su Supabase (saved_places → places, solo i propri), nessuna chiamata a Google o all'AI.
// Senza utente, senza salvati o senza rete non mostra niente: mai righe inventate.
// Un tocco apre la scheda del salvato sulla mappa (/mappa?salvato=UUID, come dal profilo).

type Riga = { id: string; name: string; category: string | null; address: string | null; lat: number | null; lng: number | null };

export default function SalvatiBrevi({
  userId,
  titolo,
  testid,
  max = 3,
  soloDaProvare = false,
  pos = null,
  className = "",
}: {
  userId: string | null;
  titolo: string;
  testid: string;
  max?: number;
  soloDaProvare?: boolean;
  pos?: { lat: number; lng: number } | null;
  className?: string;
}) {
  const [righe, setRighe] = useState<Riga[] | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    browserClient()
      .then((db) =>
        db
          .from("saved_places")
          .select("tags, created_at, places(id, name, category, address, lat, lng)")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(soloDaProvare ? 60 : max),
      )
      .then(({ data, error }) => {
        if (!alive || error || !Array.isArray(data)) return;
        const out: Riga[] = [];
        for (const row of data as { tags: string[] | null; places: unknown }[]) {
          const p = row.places as Riga | null;
          if (!p?.id || !p.name) continue;
          if (soloDaProvare && !isWanted(row.tags)) continue;
          out.push({ id: p.id, name: p.name, category: p.category ?? null, address: p.address ?? null, lat: p.lat ?? null, lng: p.lng ?? null });
        }
        setRighe(out);
      })
      .catch(() => { /* rete assente: il riquadro non compare */ });
    return () => { alive = false; };
  }, [userId, soloDaProvare, max]);

  if (!userId || !righe || righe.length === 0) return null;
  const vicino = (r: Riga) => (pos && r.lat != null && r.lng != null ? distanceMeters(pos, { lat: r.lat, lng: r.lng }) : Infinity);
  const scelte = (pos ? [...righe].sort((a, b) => vicino(a) - vicino(b)) : righe).slice(0, max);

  return (
    <section data-testid={testid} aria-label={titolo} className={className}>
      <p className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">{titolo}</p>
      <ul className="mt-2 flex flex-col divide-y divide-[#e8e2d8] overflow-hidden rounded-card border border-[#e8e2d8] bg-white">
        {scelte.map((r) => {
          const tipo = categoryLabel(r.category, r.name);
          const citta = cityFromAddress(r.address);
          const dist = pos && r.lat != null && r.lng != null ? distanceLabel(pos, { lat: r.lat, lng: r.lng }) : null;
          const meta = [tipo, citta, dist].filter(Boolean).join(" · ");
          return (
            <li key={r.id}>
              <Link
                href={`/mappa?salvato=${r.id}`}
                data-testid={`${testid}-riga`}
                className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-brand-light"
              >
                <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f3efe8] text-lg">
                  {getCategoryEmoji(r.category, r.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[15px] font-medium leading-snug text-text">{r.name}</span>
                  {meta && <span className="block truncate text-[13px] text-text-muted">{meta}</span>}
                </span>
                <ChevronRight aria-hidden size={16} className="shrink-0 text-text-muted" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
