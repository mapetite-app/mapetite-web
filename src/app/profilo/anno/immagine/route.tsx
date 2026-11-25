import { ImageResponse } from "next/og";
import { annoDa, buildAnno, MESI_CORTI, numeriAnno } from "@/lib/anno-tavola";
import { loadAnnoRows } from "@/lib/anno-tavola-server";
import { fonts } from "@/lib/og-fonts";

// Immagine verticale (storia 1080×1920) di "Il tuo anno a tavola" (proposta 49), da condividere.
// Solo numeri contati dai "Ci sono stato" e nomi generici (tipo di locale, mese, città): nessun nome di
// locale, nessuna posizione, nessun contenuto Google fuori dall'app.
const W = 1080;
const H = 1920;
const TEAL = "#1a3c40";
const CORAL = "#ff6b4a";

export async function GET(request: Request) {
  const rows = await loadAnnoRows();
  if (rows === null) return new Response("Accedi per vedere il tuo anno a tavola.", { status: 401 });
  const anno = annoDa();
  const a = buildAnno(rows, anno);
  if (a.provati === 0) return new Response("Nessun posto provato quest'anno.", { status: 404 });
  const host = new URL(request.url).host;
  const loaded = await fonts();

  const stat = (value: string, label: string) => (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "28px 30px", borderRadius: 36, background: "rgba(255,255,255,0.08)" }}>
      <div style={{ display: "flex", fontSize: 84, fontWeight: 700, lineHeight: 1 }}>{value}</div>
      <div style={{ display: "flex", marginTop: 12, fontSize: 30, color: "rgba(255,255,255,0.72)" }}>{label}</div>
    </div>
  );
  const riga = (label: string, value: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "22px 0", borderBottom: "2px solid rgba(255,255,255,0.1)" }}>
      <div style={{ display: "flex", fontSize: 32, color: "rgba(255,255,255,0.65)" }}>{label}</div>
      <div style={{ display: "flex", fontSize: 40, fontWeight: 600 }}>{value}</div>
    </div>
  );
  const posti = (n: number) => `${n} ${n === 1 ? "posto" : "posti"}`;
  const numeri = numeriAnno(a);
  // Barre mese per mese (revisore 25/11: il fondo era vuoto): solo visite con la data, almeno 2 in tutto.
  const datate = a.mesi.reduce((x, y) => x + y, 0);
  const maxMese = Math.max(1, ...a.mesi);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "110px 90px 90px", background: TEAL, color: "white", fontFamily: loaded.length ? "Poppins" : undefined }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex", width: 26, height: 26, borderRadius: 999, background: CORAL }} />
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700 }}>Mapetite</div>
        </div>
        <div style={{ display: "flex", marginTop: 80, fontSize: 40, color: "rgba(255,255,255,0.75)" }}>{`Il mio ${anno} a tavola`}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 26, marginTop: 40, color: CORAL }}>
          <div style={{ display: "flex", fontSize: 260, fontWeight: 700, lineHeight: 1, letterSpacing: -8 }}>{a.provati}</div>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 600 }}>{a.provati === 1 ? "posto provato" : "posti provati"}</div>
        </div>

        <div style={{ display: numeri.length ? "flex" : "none", gap: 24, marginTop: 70 }}>
          {numeri.map((x) => stat(x.value, x.label))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 40 }}>
          {a.tipo && riga("Il mio genere", `${a.tipo.label} · ${posti(a.tipo.count)}`)}
          {a.mese && riga("Il mese più goloso", `${a.mese.label.charAt(0).toUpperCase()}${a.mese.label.slice(1)} · ${posti(a.mese.count)}`)}
          {a.citta && riga("La mia città", a.citta.nome)}
          {a.daProvare > 0 && riga(`Nel ${anno + 1}`, `${a.daProvare} da provare`)}
        </div>

        <div style={{ display: "flex", flex: 1 }} />
        {datate >= 2 && (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 50, marginBottom: 60 }}>
            <div style={{ display: "flex", fontSize: 28, fontWeight: 600, letterSpacing: 4, textTransform: "uppercase", color: "rgba(255,255,255,0.6)", marginBottom: 26 }}>Mese per mese</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 18, height: 160 }}>
              {a.mesi.map((n, i) => (
                <div key={i} style={{ display: "flex", flex: 1, height: n > 0 ? Math.max(14, Math.round((n / maxMese) * 160)) : 6, borderRadius: 10, background: n === maxMese ? CORAL : n > 0 ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.12)" }} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 18, marginTop: 14 }}>
              {MESI_CORTI.map((m, i) => (
                <div key={i} style={{ display: "flex", flex: 1, justifyContent: "center", fontSize: 26, color: "rgba(255,255,255,0.55)" }}>{m}</div>
              ))}
            </div>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontSize: 30, color: "rgba(255,255,255,0.7)" }}>
          <div style={{ display: "flex" }}>I locali giusti per te, non quelli di tutti.</div>
          <div style={{ display: "flex", color: CORAL, fontWeight: 600 }}>{host}</div>
        </div>
      </div>
    ),
    { width: W, height: H, fonts: loaded.length ? loaded : undefined, headers: { "Cache-Control": "private, no-store" } },
  );
}
