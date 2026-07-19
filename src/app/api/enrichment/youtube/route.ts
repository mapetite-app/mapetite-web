// src/app/api/enrichment/youtube/route.ts
// Route del layer YouTube (Sprint 3 Block 1, Day 24).
// Fetch dei video pertinenti + PERSISTENZA su enrichment (fonte automatica).
// Il GET resta usabile via curl per il test manuale.
// Uso: GET /api/enrichment/youtube?name=Roscioli&city=Roma&placeId=ChIJ...
//   - senza placeId: fa comunque il fetch e restituisce i video, ma non scrive
//     (persisted:false) — così il test puro senza scrittura resta possibile.

import { NextRequest, NextResponse } from "next/server";
import { fetchYouTubeVideos } from "@/lib/youtube";
import { mapYouTubeToEnrichment, upsertEnrichment } from "@/lib/enrichment";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name") ?? "";
  const city = searchParams.get("city") ?? undefined;
  const placeId = searchParams.get("placeId") ?? undefined;

  if (!name.trim()) {
    return NextResponse.json(
      { error: "parametro 'name' obbligatorio" },
      { status: 400 }
    );
  }

  const videos = await fetchYouTubeVideos({ name, city });

  let persisted = false;
  let persistReason: string | null = null;

  if (!placeId) {
    persistReason = "placeId assente — fetch senza scrittura";
  } else if (videos.length === 0) {
    persistReason = "nessun video da persistere";
  } else {
    // Degrada in sicurezza: un fallimento di scrittura non fa fallire la risposta.
    const row = mapYouTubeToEnrichment(placeId, videos);
    if (row) {
      persisted = await upsertEnrichment(row);
      if (!persisted) persistReason = "upsert fallito";
    } else {
      persistReason = "nessun video da persistere";
    }
  }

  return NextResponse.json({
    query: { name, city: city ?? null, placeId: placeId ?? null },
    count: videos.length,
    videos,
    persisted,
    persistReason,
  });
}
