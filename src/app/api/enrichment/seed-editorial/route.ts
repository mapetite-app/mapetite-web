// src/app/api/enrichment/seed-editorial/route.ts
// Route di SEED manuale per il layer editoriale (Sprint 3 Block 1, Day 22bis).
// Inserisce a mano i verdetti delle guide (Michelin, Gambero Rosso, Puntarella
// Rossa) sui locali di punta. Non è una pagina pubblica: è una route server-side
// di seed, coerente con le route di test dei Day 21-22. In Block 2 sparirà.
//
// POST /api/enrichment/seed-editorial
//   body: { place_id: string, entries: EditorialInput[] }
//   → per ogni entry: mapEditorialToEnrichment + upsertEnrichment
//   → { ok: true, written: N, failed: M }

import { NextRequest, NextResponse } from "next/server";
import {
  mapEditorialToEnrichment,
  upsertEnrichment,
  type EditorialInput,
} from "@/lib/enrichment";

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "body JSON non valido" }, { status: 400 });
  }

  const { place_id, entries } = body ?? {};

  if (!place_id || typeof place_id !== "string") {
    return NextResponse.json({ error: "place_id mancante" }, { status: 400 });
  }
  if (!Array.isArray(entries) || entries.length === 0) {
    return NextResponse.json(
      { error: "entries deve essere un array non vuoto" },
      { status: 400 }
    );
  }

  let written = 0;
  let failed = 0;

  for (const entry of entries as EditorialInput[]) {
    try {
      const row = mapEditorialToEnrichment(place_id, entry);
      const ok = await upsertEnrichment(row);
      if (ok) written += 1;
      else failed += 1;
    } catch (err) {
      console.error("[seed-editorial] entry fallita:", err);
      failed += 1;
    }
  }

  return NextResponse.json({ ok: true, written, failed });
}
