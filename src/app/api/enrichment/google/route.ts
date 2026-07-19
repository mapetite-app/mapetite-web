// src/app/api/enrichment/google/route.ts
// Route di TEST per il Day 22: scrive la riga Google in enrichment e la rilegge.
// GET  /api/enrichment/google?placeId=XXX  → legge tutte le fonti del locale
// POST /api/enrichment/google              → { placeId, rating, userRatingCount,
//                                              priceLevel, googleMapsUri } → upsert
// Nota: route provvisoria di verifica. In Block 2 la scrittura Google avverrà
// dentro il flusso di apertura scheda, non da un endpoint dedicato.

import { NextRequest, NextResponse } from "next/server";
import {
  mapGoogleToEnrichment,
  upsertEnrichment,
  getEnrichment,
} from "@/lib/enrichment";

export async function GET(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get("placeId");
  if (!placeId) {
    return NextResponse.json({ error: "placeId mancante" }, { status: 400 });
  }
  const rows = await getEnrichment(placeId);
  return NextResponse.json({ placeId, count: rows.length, sources: rows });
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "body JSON non valido" }, { status: 400 });
  }

  const { placeId, rating, userRatingCount, priceLevel, googleMapsUri, websiteUri } = body ?? {};
  if (!placeId) {
    return NextResponse.json({ error: "placeId mancante" }, { status: 400 });
  }

  const row = mapGoogleToEnrichment(placeId, {
    rating: rating ?? null,
    userRatingCount: userRatingCount ?? null,
    priceLevel: priceLevel ?? null,
    googleMapsUri: googleMapsUri ?? null,
    websiteUri: websiteUri ?? null,
  });

  const ok = await upsertEnrichment(row);
  if (!ok) {
    return NextResponse.json({ error: "upsert fallito" }, { status: 500 });
  }
  const rows = await getEnrichment(placeId);
  return NextResponse.json({ written: row, allSources: rows });
}
