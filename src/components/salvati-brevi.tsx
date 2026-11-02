"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { browserClient } from "@/lib/supabase/client-lazy";
import { getCategoryEmoji } from "@/lib/emoji";
import { categoryLabel } from "@/lib/category-label";
import { cityFromAddress } from "@/lib/city";
import { distanceLabel, distanceMeters } from "@/lib/distance";
import { isWanted, STATE_TAGS } from "@/lib/tags";

// Due o tre salvati veri dell'utente in un riquadro (revisore 2/11): "Riparti da qui" nell'assistente
// (solo i "Da provare", i più vicini se la posizione è nota) e "Ultimi aggiunti" in Importa.
// Una lettura su Supabase (saved_places → places, solo i propri), nessuna chiamata a Google o all'AI.
// Senza utente, senza salvati o senza rete non mostra niente: mai righe inventate.
// Un tocco apre la scheda del salvato sulla mappa (/mappa?salvato=UUID, come dal profilo).
// Revisore 2/11, terzo giro: ogni riga ha lo stato ("Da provare" / "Ci sono stato") e, se c'è già in archivio,
// il verdetto in corsivo (place_synthesis, una lettura su Supabase: nessuna chiamata nuova a Google o all'AI).

type Riga = { id: string; name: string; category: string | null; address: string | null; lat: number | null; lng: number | null; googlePlaceId: string | null; fatto: boolean };
const DONE = STATE_TAGS[1];

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
  const [verdetti, setVerdetti] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    browserClient()
      .then((db) =>
        db
          .from("saved_places")
          .select("tags, created_at, places(id, name, category, address, lat, lng, google_place_id)")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(soloDaProvare ? 60 : max),
      )
      .then(({ data, error }) => {
        if (!alive || error || !Array.isArray(data)) return;
        const out: Riga[] = [];
        for (const row of data as { tags: string[] | null; places: unknown }[]) {
          const p = row.places as (Omit<Riga, "googlePlaceId" | "fatto"> & { google_place_id?: string | null }) | null;
          if (!p?.id || !p.name) continue;
          if (soloDaProvare && !isWanted(row.tags)) continue;
          out.push({ id: p.id, name: p.name, category: p.category ?? null, address: p.address ?? null, lat: p.lat ?? null, lng: p.lng ?? null, googlePlaceId: p.google_place_id ?? null, fatto: !!row.tags?.includes(DONE) });
        }
        setRighe(out);
        // Verdetti già in archivio, solo per le righe lette (un di più: se la lettura fallisce restano senza).
        const ids = [...new Set(out.map((r) => r.googlePlaceId).filter((g): g is string => !!g))].slice(0, 60);
        if (ids.length === 0) return;
        return browserClient()
          .then((db) => db.from("place_synthesis").select("place_id, verdict").in("place_id", ids))
          .then(({ data: rows, error: e2 }) => {
            if (!alive || e2 || !Array.isArray(rows)) return;
            const v: Record<string, string> = {};
            for (const r of rows as { place_id: string; verdict: string | null }[]) { const t = r.verdict?.trim(); if (t) v[r.place_id] = t; }
            setVerdetti(v);
          });
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
          const verdetto = r.googlePlaceId ? verdetti[r.googlePlaceId] ?? null : null;
          return (
            <li key={r.id}>
              <Link
                href={`/mappa?salvato=${r.id}`}
                data-testid={`${testid}-riga`}
                className="flex min-h-14 w-full items-start gap-3 px-4 py-3 text-left active:bg-brand-light"
              >
                <span aria-hidden className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f3efe8] text-lg">
                  {getCategoryEmoji(r.category, r.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[15px] font-medium leading-snug text-text">{r.name}</span>
                  {/* Stato sulla riga del tipo, come nella lista dei Salvati (senza stato è "Da provare"): sulla stessa
                      riga per non allungare il riquadro, che nell'assistente deve stare tutto sopra il campo. */}
                  <span className="mt-0.5 flex min-w-0 items-center gap-2">
                    {meta && <span className="min-w-0 truncate text-[13px] text-text-muted">{meta}</span>}
                    <span data-testid={`${testid}-stato`} className={`inline-flex h-[22px] shrink-0 items-center gap-1 whitespace-nowrap rounded-pill px-2 text-[11.5px] font-semibold ${r.fatto ? "bg-[#e3eded] text-brand" : "bg-[#f1efeb] font-medium text-[#6b7075]"}`}>
                      {r.fatto ? <Check size={12} strokeWidth={3} aria-hidden /> : <span aria-hidden className="text-[10px] leading-none">📌</span>}
                      {r.fatto ? "Ci sono stato" : "Da provare"}
                    </span>
                  </span>
                  {verdetto && (
                    <span data-testid={`${testid}-verdetto`} className="mt-0.5 line-clamp-2 font-[family-name:var(--font-newsreader)] text-[14.5px] italic leading-snug text-[#4a4f55]">{verdetto}</span>
                  )}
                </span>
                <ChevronRight aria-hidden size={16} className="mt-2.5 shrink-0 text-text-muted" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
