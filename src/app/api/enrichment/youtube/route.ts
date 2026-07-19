// src/app/api/enrichment/youtube/route.ts
// Route di TEST per il layer YouTube (Sprint 3 Block 1, Day 21).
// Verifica via curl che la pipeline YouTube risponda. NON scrive su DB.
// Uso: GET /api/enrichment/youtube?name=Roscioli&city=Roma

import { NextRequest, NextResponse } from "next/server";
import { fetchYouTubeVideos } from "@/lib/youtube";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name") ?? "";
  const city = searchParams.get("city") ?? undefined;

  if (!name.trim()) {
    return NextResponse.json(
      { error: "parametro 'name' obbligatorio" },
      { status: 400 }
    );
  }

  const videos = await fetchYouTubeVideos({ name, city });

  return NextResponse.json({
    query: { name, city: city ?? null },
    count: videos.length,
    videos,
  });
}
