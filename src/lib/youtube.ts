// src/lib/youtube.ts
// Layer di arricchimento YouTube per il motore multi-fonte (Sprint 3 Block 1).
// On-demand: interroga YouTube Data API v3 per un locale, restituisce video pertinenti.
// Degrada in sicurezza: se la key manca, la quota è esaurita o la rete fallisce,
// ritorna [] senza mai lanciare — l'arricchimento è additivo, mai un blocker.

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YT_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";

export interface YouTubeVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  publishedAt: string;
  thumbnailUrl: string;
}

interface FetchParams {
  name: string;
  city?: string;
  maxResults?: number;
}

export async function fetchYouTubeVideos({
  name,
  city,
  maxResults = 3,
}: FetchParams): Promise<YouTubeVideo[]> {
  if (!YOUTUBE_API_KEY) {
    console.warn("[youtube] YOUTUBE_API_KEY assente — arricchimento saltato");
    return [];
  }
  if (!name?.trim()) return [];

  const q = [name, city].filter(Boolean).join(" ").trim();

  const params = new URLSearchParams({
    key: YOUTUBE_API_KEY,
    q,
    part: "snippet",
    type: "video",
    maxResults: String(maxResults),
    relevanceLanguage: "it",
    safeSearch: "strict",
  });

  try {
    const res = await fetch(`${YT_SEARCH_URL}?${params.toString()}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(`[youtube] HTTP ${res.status} per query "${q}"`);
      return [];
    }

    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];

    return items
      .filter((it: any) => it?.id?.videoId && it?.snippet)
      .map((it: any): YouTubeVideo => ({
        videoId: it.id.videoId,
        title: it.snippet.title ?? "",
        channelTitle: it.snippet.channelTitle ?? "",
        publishedAt: it.snippet.publishedAt ?? "",
        thumbnailUrl:
          it.snippet.thumbnails?.medium?.url ??
          it.snippet.thumbnails?.default?.url ??
          "",
      }));
  } catch (err) {
    console.error("[youtube] fetch fallito:", err);
    return [];
  }
}
