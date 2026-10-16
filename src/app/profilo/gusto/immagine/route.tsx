import { ImageResponse } from "next/og";
import { buildCarta, CARTA_MIN } from "@/lib/carta-gusto";
import { loadCartaRows } from "@/lib/carta-gusto-server";

// Immagine verticale (formato storia 1080×1920) della carta del gusto, da condividere.
// Solo numeri e tipi di locale contati dai salvati: nessun nome di locale, nessun contenuto Google.
const W = 1080;
const H = 1920;
const TEAL = "#1a3c40";
const CORAL = "#ff6b4a";

type Font = { name: string; data: ArrayBuffer; weight: 400 | 600 | 700; style: "normal" };
// Poppins dal servizio Google Fonts (licenza libera), una volta per processo; se la rete
// non risponde si usa il carattere predefinito e l'immagine esce lo stesso.
let fontsPromise: Promise<Font[]> | null = null;
async function loadFont(weight: 400 | 600 | 700): Promise<Font> {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Poppins:wght@${weight}`, { signal: AbortSignal.timeout(2500) })).text();
  const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
  if (!url) throw new Error("font non trovato");
  const data = await (await fetch(url, { signal: AbortSignal.timeout(2500) })).arrayBuffer();
  return { name: "Poppins", data, weight, style: "normal" };
}
function fonts(): Promise<Font[]> {
  if (!fontsPromise) {
    fontsPromise = Promise.all([loadFont(400), loadFont(600), loadFont(700)]).catch((e) => {
      console.error("[carta-gusto] Poppins non disponibile:", e instanceof Error ? e.message : e);
      fontsPromise = null;
      return [];
    });
  }
  return fontsPromise;
}

export async function GET(request: Request) {
  const rows = await loadCartaRows();
  if (rows === null) return new Response("Accedi per vedere la tua carta del gusto.", { status: 401 });
  if (rows.length < CARTA_MIN) return new Response("Servono almeno 3 locali salvati.", { status: 404 });
  const c = buildCarta(rows);
  const host = new URL(request.url).host;
  const maxTipo = Math.max(1, ...c.tipi.map((t) => t.count));
  const loaded = await fonts();

  const stat = (value: string, label: string) => (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "28px 30px", borderRadius: 36, background: "rgba(255,255,255,0.08)" }}>
      <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1 }}>{value}</div>
      <div style={{ marginTop: 12, fontSize: 30, color: "rgba(255,255,255,0.72)" }}>{label}</div>
    </div>
  );
  const label = (t: string) => (
    <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: 4, textTransform: "uppercase", color: "rgba(255,255,255,0.6)", marginBottom: 22 }}>{t}</div>
  );

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "110px 90px 90px", background: TEAL, color: "white", fontFamily: loaded.length ? "Poppins" : undefined }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 26, height: 26, borderRadius: 999, background: CORAL }} />
          <div style={{ fontSize: 40, fontWeight: 700 }}>Mapetite</div>
        </div>
        <div style={{ marginTop: 90, fontSize: 36, color: "rgba(255,255,255,0.75)" }}>La mia carta del gusto</div>
        <div style={{ marginTop: 12, fontSize: 96, fontWeight: 700, lineHeight: 1.05, color: CORAL, letterSpacing: -2 }}>{c.titolo}</div>
        <div style={{ marginTop: 26, fontSize: 36, lineHeight: 1.35, color: "rgba(255,255,255,0.88)" }}>{c.perche}</div>

        <div style={{ display: "flex", gap: 24, marginTop: 70 }}>
          {stat(String(c.salvati), "salvati")}
          {stat(String(c.provati), "provati")}
          {c.gemmePct != null ? stat(`${c.gemmePct}%`, "poco conosciuti") : stat(String(c.cittaCount), "città")}
        </div>

        {c.tipi.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 70 }}>
            {label("Cosa salvo di più")}
            {c.tipi.map((t, i) => (
              <div key={t.label} style={{ display: "flex", alignItems: "center", marginBottom: 22 }}>
                <div style={{ display: "flex", width: 70, fontSize: 44, fontWeight: 700, color: i === 0 ? CORAL : "rgba(255,255,255,0.55)" }}>{i + 1}</div>
                <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 40, fontWeight: 600 }}>
                    <span>{t.label}</span>
                    <span style={{ color: "rgba(255,255,255,0.6)", fontWeight: 400 }}>{t.count}</span>
                  </div>
                  <div style={{ display: "flex", marginTop: 10, height: 12, borderRadius: 999, background: "rgba(255,255,255,0.12)" }}>
                    <div style={{ width: `${Math.round((t.count / maxTipo) * 100)}%`, height: 12, borderRadius: 999, background: i === 0 ? CORAL : "rgba(255,255,255,0.55)" }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {c.raccolte.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 50 }}>
            {label("Le mie raccolte")}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
              {c.raccolte.map((r) => (
                <div key={r.nome} style={{ display: "flex", padding: "14px 30px", borderRadius: 999, border: "2px solid rgba(255,255,255,0.35)", fontSize: 34 }}>
                  {r.nome.length > 22 ? r.nome.slice(0, 21) + "…" : r.nome}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", flex: 1 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontSize: 30, color: "rgba(255,255,255,0.7)" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {c.citta.length > 0 && <div style={{ display: "flex", color: "white", fontWeight: 600 }}>{c.citta.join(" · ")}</div>}
            <div style={{ display: "flex" }}>I locali giusti per te, non quelli di tutti.</div>
          </div>
          <div style={{ display: "flex", color: CORAL, fontWeight: 600 }}>{host}</div>
        </div>
      </div>
    ),
    { width: W, height: H, fonts: loaded.length ? loaded : undefined, headers: { "Cache-Control": "private, no-store" } },
  );
}
