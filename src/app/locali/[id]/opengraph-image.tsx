import { ImageResponse } from "next/og";
import { categoryLabel } from "@/lib/category-label";
import { cityFromAddress } from "@/lib/city";
import { loadPublicPlace, priceLabel, ratingLabel } from "./dati";

// Anteprima del link di un locale (WhatsApp, Telegram, iMessage): nome, contesto e verdetto
// già in cache. Solo testo e forme: nessuna foto Google (niente costi per ogni anteprima).
export const alt = "Un locale consigliato su Mapetite";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadPublicPlace(id);
  const name = data?.place.name ?? "Mapetite";
  const context = data
    ? [cityFromAddress(data.place.address), categoryLabel(data.place.category), priceLabel(data.place.price_level), ratingLabel(data.place.rating)]
        .filter(Boolean)
        .join(" · ")
    : "I locali giusti per te, non quelli di tutti.";
  const verdict = data?.synthesis?.verdict?.trim() || null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 88px",
          background: "#1a3c40",
          color: "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 24, height: 24, borderRadius: 999, background: "#ff6b4a" }} />
          <div style={{ fontSize: 40, fontWeight: 700 }}>Mapetite</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: name.length > 28 ? 72 : 88, fontWeight: 700, lineHeight: 1.05, letterSpacing: -1 }}>{clip(name, 48)}</div>
          {context && <div style={{ marginTop: 20, fontSize: 34, color: "rgba(255,255,255,0.75)" }}>{context}</div>}
          {verdict && (
            <div style={{ display: "flex", flexDirection: "column", marginTop: 36 }}>
              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 2, color: "#ff6b4a" }}>IL VERDETTO MAPETITE</div>
              <div style={{ marginTop: 10, fontSize: 38, lineHeight: 1.3, color: "rgba(255,255,255,0.95)" }}>{clip(verdict, 120)}</div>
            </div>
          )}
        </div>
      </div>
    ),
    size,
  );
}
