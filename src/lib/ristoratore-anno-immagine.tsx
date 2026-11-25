import { ImageResponse } from "next/og";
import { MESI_CORTI } from "@/lib/anno-tavola";
import { fonts } from "@/lib/og-fonts";
import { numeriAnnoLocale, righeAnnoLocale, titoloAnno, type AnnoLocale } from "@/lib/ristoratore-anno";

// Immagine verticale (storia 1080×1920) di "Il vostro anno su Mapetite" (proposta 87), che il locale pubblica su
// Instagram. Solo i numeri della pagina (da 3 persone in su): nessun nome di cliente, nessuna foto o testo di
// Google (termini 3.2.3(b)), nemmeno il nome del locale: lo mette il locale stesso nel suo profilo.
// Niente emoji: il motore delle immagini le scaricherebbe da una CDN e senza rete l'immagine fallirebbe.
const W = 1080;
const H = 1920;
const TEAL = "#1a3c40";
const CORAL = "#ff6b4a";

export async function immagineAnnoLocale(a: AnnoLocale, host: string, demo = false): Promise<Response> {
  const titolo = titoloAnno(a);
  if (!titolo) return new Response("Ancora troppo pochi numeri per l'immagine.", { status: 404 });
  const loaded = await fonts();
  const numeri = numeriAnnoLocale(a);
  const righe = righeAnnoLocale(a);
  const maxMese = Math.max(1, ...a.mesi);
  const barre = a.barre;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "110px 90px 90px", background: TEAL, color: "white", fontFamily: loaded.length ? "Poppins" : undefined }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex", width: 26, height: 26, borderRadius: 999, background: CORAL }} />
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700 }}>Mapetite</div>
        </div>
        {/* Revisore 25/11: nell'esempio la scritta deve leggersi anche nella storia sul telefono, vicino al numero. */}
        {demo && (
          <div style={{ display: "flex", alignSelf: "flex-start", marginTop: 60, padding: "16px 30px", borderRadius: 999, background: CORAL, color: "white", fontSize: 36, fontWeight: 700 }}>Esempio dimostrativo · numeri inventati</div>
        )}
        <div style={{ display: "flex", marginTop: demo ? 40 : 80, fontSize: 40, color: "rgba(255,255,255,0.75)" }}>{`Il nostro ${a.anno} su Mapetite`}</div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 40, color: CORAL }}>
          <div style={{ display: "flex", fontSize: 260, fontWeight: 700, lineHeight: 1, letterSpacing: -8 }}>{titolo.numero.toLocaleString("it-IT")}</div>
          <div style={{ display: "flex", marginTop: 16, fontSize: 64, fontWeight: 600 }}>{titolo.testo === "persone vi hanno salvato" ? "persone ci hanno salvato" : "persone sono venute"}</div>
        </div>
        <div style={{ display: numeri.length ? "flex" : "none", gap: 24, marginTop: 70 }}>
          {numeri.map((x) => (
            <div key={x.label} style={{ display: "flex", flexDirection: "column", flex: 1, padding: "28px 30px", borderRadius: 36, background: "rgba(255,255,255,0.08)" }}>
              <div style={{ display: "flex", fontSize: 76, fontWeight: 700, lineHeight: 1 }}>{x.value.replace(/^\p{Extended_Pictographic}\s*/u, "")}</div>
              <div style={{ display: "flex", marginTop: 12, fontSize: 30, color: "rgba(255,255,255,0.72)" }}>{x.label === "vi aspettano" ? "ci aspettano" : x.label}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 40 }}>
          {righe.map((r) => (
            <div key={r.k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "22px 0", borderBottom: "2px solid rgba(255,255,255,0.1)" }}>
              <div style={{ display: "flex", fontSize: 32, color: "rgba(255,255,255,0.65)" }}>{r.label}</div>
              <div style={{ display: "flex", fontSize: 40, fontWeight: 600 }}>{r.value}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flex: 1 }} />
        {barre && (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 50, marginBottom: 60 }}>
            <div style={{ display: "flex", fontSize: 28, fontWeight: 600, letterSpacing: 4, textTransform: "uppercase", color: "rgba(255,255,255,0.6)", marginBottom: 26 }}>Salvati mese per mese</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 18, height: 160 }}>
              {a.mesi.map((n, i) => (
                <div key={i} style={{ display: "flex", flex: 1, height: n > 0 ? Math.max(14, Math.round((n / maxMese) * 160)) : 6, borderRadius: 10, background: a.mese && n === maxMese ? CORAL : n > 0 ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.12)" }} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 18, marginTop: 14 }}>
              {MESI_CORTI.map((m, i) => <div key={i} style={{ display: "flex", flex: 1, justifyContent: "center", fontSize: 26, color: "rgba(255,255,255,0.55)" }}>{m}</div>)}
            </div>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontSize: 30, color: "rgba(255,255,255,0.7)" }}>
          <div style={{ display: "flex" }}>Salvateci anche voi su Mapetite.</div>
          <div style={{ display: "flex", color: CORAL, fontWeight: 600 }}>{host}</div>
        </div>
      </div>
    ),
    { width: W, height: H, fonts: loaded.length ? loaded : undefined, headers: { "Cache-Control": "private, no-store" } },
  );
}
