"use client";

import type { SocialSource } from "@/lib/social-link";

// Link di Instagram/TikTok/YouTube Shorts: il post non si legge, si spiega cosa fare.
// "Cerca …" compare solo se nel testo condiviso c'è anche un nome plausibile; la ricerca
// Google parte solo dopo il tocco.
export default function SocialLinkHelp({
  source,
  hint,
  onScreenshot,
  onSearch,
}: {
  source: SocialSource;
  hint: string | null;
  onScreenshot: () => void;
  onSearch: (q: string) => void;
}) {
  return (
    <div className="space-y-3 rounded-card border border-accent/40 bg-accent/10 p-4" data-testid="link-social">
      <p className="text-sm text-text">
        <span aria-hidden>📸 </span>
        Da Instagram e TikTok non posso leggere il post. Fai uno screenshot del post e caricalo con il pulsante qui
        sotto: leggo io nome e città del locale. Su Android puoi anche condividerlo direttamente a Mapetite.
      </p>
      {source === "YouTube" && (
        <p className="text-xs text-text-muted">Vale anche per gli Shorts di YouTube.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onScreenshot}
          data-testid="link-social-screenshot"
          className="min-h-11 rounded-pill bg-brand px-4 text-sm font-display font-semibold text-white"
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
