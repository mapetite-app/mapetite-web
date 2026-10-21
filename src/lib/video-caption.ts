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

// I link corti dell'app TikTok (vm.tiktok.com/…, tiktok.com/t/…) si risolvono seguendo i soli rimandi
// (come per i link corti di Google Maps), senza leggere la pagina: l'oEmbed vuole l'indirizzo del video.
// Fino a 3 rimandi; se HEAD non dà il rimando (TikTok a volte risponde 200 o 403) si riprova con GET.
export async function resolveShortTikTok(url: string): Promise<string> {
  let current = url;
  for (let i = 0; i < 3; i++) {
    const u = new URL(current);
    const host = u.hostname.toLowerCase().replace(/^(www\.|m\.)/, "");
    const corto = host === "vm.tiktok.com" || host === "vt.tiktok.com" || (host === "tiktok.com" && /^\/t\//.test(u.pathname));
    if (!corto) break;
    let loc: string | null = null;
    for (const method of ["HEAD", "GET"] as const) {
      try {
        const res = await fetch(current, { method, redirect: "manual", signal: AbortSignal.timeout(4000), cache: "no-store", headers: { "User-Agent": "Mozilla/5.0 (Mapetite; oEmbed)" } });
        loc = res.headers.get("location");
        if (loc) break;
      } catch {
        // si prova con l'altro metodo
      }
    }
    if (!loc) break;
    const next = new URL(loc, current).toString();
    if (videoSourceOf(next) !== "TikTok") break;
    current = next;
  }
  return current;
}

// Indirizzo che l'oEmbed di TikTok accetta: https://www.tiktok.com/@autore/video/ID, senza parametri.
// I post a foto (caroselli "5 posti dove…", /photo/ID) e i vecchi m.tiktok.com/v/ID.html
// si leggono con lo stesso ID nella forma /video/ (22/10: Lorenzo, "impossibile leggere il link").
export function tiktokOembedUrl(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  const autore = u.pathname.match(/^\/(@[^/]+)/)?.[1] ?? "@";
  const id = u.pathname.match(/\/(?:video|photo)\/(\d+)/)?.[1] ?? u.pathname.match(/^\/v\/(\d+)/)?.[1];
  return id ? `https://www.tiktok.com/${autore}/video/${id}` : `https://www.tiktok.com${u.pathname}`;
}

// Testo per Haiku: didascalia e autore. null se il video non è leggibile (privato, rimosso, rete).
export async function fetchVideoCaption(url: string): Promise<string | null> {
  const source = videoSourceOf(url);
  if (!source) return null;
  try {
    const full = source === "TikTok" ? tiktokOembedUrl(await resolveShortTikTok(url)) : url;
    let res = await fetch(OEMBED[source](full), { signal: AbortSignal.timeout(6000), cache: "no-store" });
    // Post a foto: se la forma /video/ non va, si prova l'indirizzo così com'era.
    if (!res.ok && source === "TikTok" && full !== url) res = await fetch(OEMBED[source](url), { signal: AbortSignal.timeout(6000), cache: "no-store" });
    if (!res.ok) {
      // Nei log di Vercel: forma del link (senza parametri) e risposta, per capire i casi che non si leggono.
      console.warn(`[video-caption] oEmbed ${source} ${res.status} link=${url.split("?")[0]} provato=${full}`);
      return null;
    }
    const data: unknown = await res.json();
    const o = (data ?? {}) as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title.trim() : "";
    const author = typeof o.author_name === "string" ? o.author_name.trim() : "";
    if (!title) {
      console.warn(`[video-caption] oEmbed ${source} senza didascalia link=${url.split("?")[0]}`);
      return null;
    }
    return `Didascalia del video ${source}: ${title.slice(0, 1500)}${author ? `\nAutore: ${author.slice(0, 100)}` : ""}`;
  } catch (e) {
    console.warn(`[video-caption] ${source} non raggiungibile link=${url.split("?")[0]}`, e);
    return null;
  }
}
