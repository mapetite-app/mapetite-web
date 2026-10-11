import { ImageResponse } from "next/og";

// Anteprima del link (WhatsApp, Telegram, iMessage) quando si condivide Mapetite.
// Solo forme e testo con il font predefinito: nessun download in fase di build.
export const alt = "Mapetite — i locali giusti per te, non quelli di tutti";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px 96px",
          background: "#1a3c40",
          color: "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ width: 40, height: 40, borderRadius: 999, background: "#ff6b4a" }} />
          <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: -2 }}>Mapetite</div>
        </div>
        <div style={{ marginTop: 36, fontSize: 48, lineHeight: 1.25, maxWidth: 900, color: "rgba(255,255,255,0.92)" }}>
          I locali giusti per te, non quelli di tutti.
        </div>
        <div style={{ marginTop: 28, fontSize: 30, color: "#ffb6a5" }}>
          Scrivi cosa cerchi come lo diresti a un amico.
        </div>
      </div>
    ),
    size,
  );
}
