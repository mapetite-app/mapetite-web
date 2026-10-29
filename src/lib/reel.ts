// Reel e video collegati ai locali (piano 5.6d): link di Instagram, TikTok e YouTube che gli utenti
// hanno salvato insieme a un locale. Si memorizza SOLO il link (mai titolo, miniatura o testo del
// video): l'anteprima si chiede ogni volta all'oEmbed ufficiale (src/app/api/places/oembed).
// Funzioni pure, senza dipendenze: le usano il browser (modulo "Aggiungi un video") e il server.

export type ReelSource = "Instagram" | "TikTok" | "YouTube";

export const REEL_MAX_LEN = 500;

const LINK_RE = /https?:\/\/[^\s<>"']+/g;

function hostOf(u: URL): string {
  return u.hostname.toLowerCase().replace(/^(www\.|m\.)/, "");
}

/** Fonte del link, se è un video/post vero di una delle tre piattaforme; altrimenti null. */
export function reelSourceOf(raw: string): ReelSource | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = hostOf(u);
  const path = u.pathname;
  if (host === "instagram.com" && /^\/(reel|reels|p|tv)\/[A-Za-z0-9_-]+/.test(path)) return "Instagram";
  if (host === "tiktok.com" && (/\/(video|photo)\/\d+/.test(path) || /^\/t\/[A-Za-z0-9]+/.test(path))) return "TikTok";
  if ((host === "vm.tiktok.com" || host === "vt.tiktok.com") && path.length > 1) return "TikTok";
  if (host === "youtube.com" && (/^\/shorts\/[A-Za-z0-9_-]+/.test(path) || (path === "/watch" && u.searchParams.has("v")))) return "YouTube";
  if (host === "youtu.be" && path.length > 1) return "YouTube";
  return null;
}

/**
 * Link pulito da memorizzare: https, senza i parametri di tracciamento delle app (?igsh=, ?si=,
 * ?is_from_webapp…) e senza "#". Su YouTube /watch si tiene solo ?v=. null se non è un reel valido.
 */
export function cleanReelUrl(raw: string): string | null {
  const source = reelSourceOf(raw);
  if (!source) return null;
  const u = new URL(raw.trim());
  u.protocol = "https:";
  u.hash = "";
  const v = hostOf(u) === "youtube.com" && u.pathname === "/watch" ? u.searchParams.get("v") : null;
  u.search = v ? `?v=${encodeURIComponent(v)}` : "";
  const out = u.toString().replace(/\/$/, "");
  return out.length <= REEL_MAX_LEN ? out : null;
}

/** Pagina "embed" ufficiale di un post Instagram (quella che usa embed.js di Meta), con la didascalia. */
export function instagramEmbedUrl(raw: string): string | null {
  const clean = cleanReelUrl(raw);
  if (!clean || reelSourceOf(clean) !== "Instagram") return null;
  const m = new URL(clean).pathname.match(/^\/(reel|reels|p|tv)\/([A-Za-z0-9_-]+)/);
  return m ? `https://www.instagram.com/${m[1] === "reels" ? "reel" : m[1]}/${m[2]}/embed/captioned/` : null;
}

/** Primo link di un reel nel testo condiviso o incollato ("Guarda questo reel https://…"). */
export function findReelLink(text: string): string | null {
  for (const m of text.matchAll(LINK_RE)) {
    const url = cleanReelUrl(m[0].replace(/[),.;!?]+$/, ""));
    if (url) return url;
  }
  return null;
}

/** "Visto su TikTok". */
export const seenOn = (s: ReelSource) => `Visto su ${s}`;
