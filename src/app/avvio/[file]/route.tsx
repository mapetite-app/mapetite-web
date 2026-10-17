import { ImageResponse } from "next/og";
import { IPHONE_SCHERMI, avvioFile } from "@/lib/avvio";

// Schermata d'avvio su iPhone: fondo teal, il marchio e il nome (src/lib/avvio.ts).
// Generate una volta in fase di build: nessun costo a ogni apertura.
export const dynamicParams = false;
export function generateStaticParams() {
  return IPHONE_SCHERMI.map((s) => ({ file: avvioFile(s) }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const m = /^(\d+)x(\d+)\.png$/.exec(file);
  if (!m) return new Response("Non trovato", { status: 404 });
  const width = Number(m[1]);
  const height = Number(m[2]);
  const mark = Math.round(width * 0.26);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#1a3c40",
        }}
      >
        <svg width={mark} height={mark} viewBox="0 0 512 512">
          <path d="M120 432V236a70 70 0 0 1 140 0v196M260 236a70 70 0 0 1 140 0v196" fill="none" stroke="#ff6b4a" strokeWidth="76" />
          <rect x="172" y="224" width="7" height="50" rx="3.5" fill="#ff6b4a" />
          <rect x="186.5" y="220" width="7" height="54" rx="3.5" fill="#ff6b4a" />
          <rect x="201" y="224" width="7" height="50" rx="3.5" fill="#ff6b4a" />
          <rect x="172" y="264" width="36" height="16" rx="8" fill="#ff6b4a" />
          <rect x="184" y="272" width="12" height="80" rx="6" fill="#ff6b4a" />
          <circle cx="260" cy="72" r="20" fill="none" stroke="#ff6b4a" strokeWidth="10" />
        </svg>
        <div style={{ marginTop: Math.round(width * 0.04), fontSize: Math.round(width * 0.1), fontWeight: 700, letterSpacing: -1, color: "white" }}>
          Mapetite
        </div>
      </div>
    ),
    { width, height, headers: { "Cache-Control": "public, max-age=31536000, immutable" } },
  );
}
