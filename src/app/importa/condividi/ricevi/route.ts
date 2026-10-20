import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractPlace, fromParsed, type ImportResult } from "@/lib/import-caption";
import { allowAi, clientKey } from "@/lib/ai-limit";

// Destinazione del "Condividi" di Android (share_target POST nel manifest).
// Arrivano due cose diverse:
//  - un link di Google Maps (title/text/url) → si passa alla pagina /importa/condividi di sempre;
//  - uno screenshot di Instagram/TikTok (campo "immagini") → Haiku legge nome e città
//    (la stessa e unica chiamata dell'import manuale) e si va alla pagina con l'esito.
// Le immagini non passano da un redirect: qui si leggono e nell'URL va solo l'esito.

// Formati che Haiku accetta; il tipo si ricava dai primi byte (Android a volte non lo manda).
function sniffImageType(b: Uint8Array): string | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}

// Limite della API di Anthropic per una singola immagine.
const MAX_BYTES = 5 * 1024 * 1024;
const RESULT_PAGE = "/importa/condividi/immagine";

const field = (form: FormData, k: string) => {
  const v = form.get(k);
  return typeof v === "string" ? v.trim() : "";
};

async function currentUserId(request: NextRequest): Promise<string | null> {
  // Solo in sviluppo locale: utente finto per il test automatico (scripts/e2e/giro.mjs);
  // il cookie "e2e_anonimo" simula chi non ha fatto l'accesso.
  const dev = process.env.NODE_ENV === "development";
  if (dev && request.cookies.get("e2e_anonimo")) return null;
  if (dev && process.env.E2E_FAKE_USER) return process.env.E2E_FAKE_USER;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

// Solo in sviluppo con E2E_FAKE_USER: lettura finta dal cookie "e2e_lettura" (niente Haiku nei test).
function fakeReading(request: NextRequest): ImportResult | null {
  if (process.env.NODE_ENV !== "development" || !process.env.E2E_FAKE_USER) return null;
  const raw = request.cookies.get("e2e_lettura")?.value;
  if (!raw) return null;
  try {
    const p = JSON.parse(decodeURIComponent(raw));
    return fromParsed(p);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  // 303: dopo un POST il browser apre la pagina di arrivo con un GET.
  const go = (path: string) => NextResponse.redirect(new URL(path, request.url), 303);

  const form = await request.formData().catch(() => null);
  if (!form) return go("/importa/condividi");

  const images = form.getAll("immagini").filter((f): f is File => typeof f !== "string" && f.size > 0);

  // Nessuna immagine: è un link (Google Maps o altro). Stessa pagina e stessa logica di prima.
  if (images.length === 0) {
    const q = new URLSearchParams();
    for (const k of ["title", "text", "url"]) {
      const v = field(form, k);
      if (v) q.set(k, v);
    }
    const qs = q.toString();
    return go(`/importa/condividi${qs ? `?${qs}` : ""}`);
  }

  const userId = await currentUserId(request);
  if (!userId) {
    const message = "Accedi a Mapetite, poi condividi di nuovo lo screenshot da Instagram o TikTok.";
    return go(`/login?message=${encodeURIComponent(message)}`);
  }

  // Una sola immagine per condivisione: se ne arrivano di più si legge la prima e lo si dice.
  const out = new URLSearchParams();
  if (images.length > 1) out.set("piu", "1");
  const result = (params: Record<string, string | null>) => {
    for (const [k, v] of Object.entries(params)) if (v) out.set(k, v);
    return go(`${RESULT_PAGE}?${out}`);
  };

  const file = images[0];
  if (file.size > MAX_BYTES) return result({ errore: "grande" });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mediaType = sniffImageType(bytes);
  if (!mediaType) return result({ errore: "formato" });

  // Tetto AI (src/lib/ai-limit.ts): conta solo le letture vere con Haiku.
  const finta = fakeReading(request);
  if (!finta && !allowAi("screenshot", clientKey(request, userId))) return result({ errore: "limite" });

  const lettura =
    finta ??
    (await extractPlace({ image: { mediaType, data: Buffer.from(bytes).toString("base64") } }));
  console.log("[condividi/ricevi] screenshot letto:", lettura.nome ? "trovato" : "nessun locale");

  if (!lettura.nome) return result({ errore: "illeggibile" });
  // Gli altri locali dello stesso post ("3 posti dove…") viaggiano insieme, già letti: nessuna nuova lettura AI.
  const altri = (lettura.luoghi ?? []).slice(1);
  return result({ nome: lettura.nome, citta: lettura.citta, categoria: lettura.categoria, altri: altri.length ? JSON.stringify(altri) : null });
}

// Chi apre l'indirizzo a mano (GET) finisce sulla pagina del Condividi.
export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/importa/condividi", request.url), 303);
}
