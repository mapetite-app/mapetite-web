"use client";

import type { SocialSource } from "@/lib/social-link";

// Link di Instagram/TikTok/YouTube Shorts. TikTok e YouTube: "Trova il locale dal video" legge la
// didascalia (oEmbed ufficiale) e la passa all'AI. Instagram non si legge: si spiega lo screenshot.
// "Cerca …" compare solo se nel testo condiviso c'è anche un nome plausibile; la ricerca
// Google parte solo dopo il tocco.
export default function SocialLinkHelp({
  source,
  hint,
  onScreenshot,
  onSearch,
  onReadVideo,
}: {
  source: SocialSource;
  hint: string | null;
  onScreenshot: () => void;
  onSearch: (q: string) => void;
  onReadVideo?: () => void;
}) {
  const video = onReadVideo != null && source !== "Instagram";
  return (
    <div className="space-y-3 rounded-card border border-accent/40 bg-accent/10 p-4" data-testid="link-social">
      {video ? (
        <p className="text-sm text-text">
          <span aria-hidden>🎬 </span>
          Leggo la descrizione del video {source === "YouTube" ? "di YouTube" : "di TikTok"} e trovo il locale. Se non c&apos;è
          scritto, fai uno screenshot del video e caricalo.
        </p>
      ) : (
        <p className="text-sm text-text">
          <span aria-hidden>📸 </span>
          Da Instagram non posso leggere il post. Fai uno screenshot del post e caricalo con il pulsante qui
          sotto: leggo io nome e città del locale. Su Android puoi anche condividerlo direttamente a Mapetite.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {video && (
          <button
            type="button"
            onClick={onReadVideo}
            data-testid="link-social-video"
            className="min-h-11 rounded-pill bg-brand px-4 text-sm font-display font-semibold text-white"
          >
            ✨ Trova il locale dal video
          </button>
        )}
        <button
          type="button"
          onClick={onScreenshot}
          data-testid="link-social-screenshot"
          className={video
            ? "min-h-11 rounded-pill border border-brand bg-white px-4 text-sm font-display font-semibold text-brand"
            : "min-h-11 rounded-pill bg-brand px-4 text-sm font-display font-semibold text-white"}
        >
          Carica uno screenshot
        </button>
        {hint && (
          <button
            type="button"
            onClick={() => onSearch(hint)}
            data-testid="link-social-cerca"
            className="min-h-11 max-w-full truncate rounded-pill border border-brand bg-white px-4 text-sm font-display font-semibold text-brand"
          >
            Cerca “{hint}”
          </button>
        )}
      </div>
    </div>
  );
}
