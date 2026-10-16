// Didascalia di un video TikTok o YouTube (Shorts) dai loro oEmbed ufficiali e gratuiti: è il servizio
// che le piattaforme offrono per incorporare i video altrove, non uno scraping della pagina.
// Instagram non c'è: il suo oEmbed richiede un'app Meta con token (si resta sullo screenshot).
// La didascalia poi va a Haiku (src/lib/import-caption.ts), come il testo di uno screenshot.

export type VideoSource = "TikTok" | "YouTube";

const OEMBED: Record<VideoSource, (url: string) => string> = {
  TikTok: (url) => `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
  YouTube: (url) => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
};

// Solo link di video veri: niente altri indirizzi verso cui far fare richieste al server.
export function videoSourceOf(raw: string): VideoSource | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase().replace(/^(www\.|m\.)/, "");
  if (host === "tiktok.com" || host === "vm.tiktok.com" || host === "vt.tiktok.com") return "TikTok";
  if (host === "youtube.com" && u.pathname.startsWith("/shorts/")) return "YouTube";
  if (host === "youtu.be" && u.pathname.length > 1) return "YouTube";
  return null;
}

const LINK_RE = /https?:\/\/[^\s<>"']+/g;

// Primo link TikTok/YouTube nel testo condiviso ("Guarda questo video su TikTok https://vm.tiktok.com/…").
export function findVideoLink(text: string): string | null {
  for (const m of text.matchAll(LINK_RE)) {
    const url = m[0].replace(/[),.;!?]+$/, "");
    if (videoSourceOf(url)) return url;
  }
  return null;
}

// I link corti dell'app TikTok (vm.tiktok.com/…) si risolvono seguendo il solo rimando (come per i
// link corti di Google Maps), senza leggere la pagina: l'oEmbed vuole l'indirizzo completo del video.
export async function resolveShortTikTok(url: string): Promise<string> {
  const host = new URL(url).hostname.toLowerCase();
  if (host !== "vm.tiktok.com" && host !== "vt.tiktok.com") return url;
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(4000), cache: "no-store" });
    const loc = res.headers.get("location");
    if (loc && videoSourceOf(loc) === "TikTok") return loc;
  } catch {
    // si prova con il link corto
  }
  return url;
}

// Testo per Haiku: didascalia e autore. null se il video non è leggibile (privato, rimosso, rete).
export async function fetchVideoCaption(url: string): Promise<string | null> {
  const source = videoSourceOf(url);
  if (!source) return null;
  try {
    const full = source === "TikTok" ? await resolveShortTikTok(url) : url;
    const res = await fetch(OEMBED[source](full), { signal: AbortSignal.timeout(6000), cache: "no-store" });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    const o = (data ?? {}) as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title.trim() : "";
    const author = typeof o.author_name === "string" ? o.author_name.trim() : "";
    if (!title) return null;
    return `Didascalia del video ${source}: ${title.slice(0, 1500)}${author ? `\nAutore: ${author.slice(0, 100)}` : ""}`;
  } catch {
    return null;
  }
}
