import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import ScreenshotResult from "./screenshot-result";
import type { Luogo } from "@/components/reel-save";

// Altri locali dello stesso screenshot (JSON dal ricevi). Si accettano solo stringhe corte: arriva dall'URL.
function parseAltri(raw: string): Luogo[] {
  try {
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const s = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
    return arr.slice(0, 7).flatMap((x) => {
      const nome = s((x as Record<string, unknown>)?.nome, 120);
      return nome ? [{ nome, citta: s((x as Record<string, unknown>).citta, 80), categoria: s((x as Record<string, unknown>).categoria, 40) }] : [];
    });
  } catch {
    return [];
  }
}

// Esito dello screenshot condiviso da Instagram/TikTok (Android): la lettura è già fatta
// da /importa/condividi/ricevi, qui arrivano solo nome, città ed eventuale errore.
export default async function CondividiImmaginePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const pick = (k: string) => {
    const v = params[k];
    return (Array.isArray(v) ? v[0] : v ?? "").trim();
  };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  // Solo in sviluppo locale: utente finto per il test automatico (scripts/e2e/giro.mjs).
  const e2eUser = process.env.NODE_ENV === "development" ? process.env.E2E_FAKE_USER ?? null : null;

  // Salvataggio da solo solo se la lettura viene dal Condividi di questo telefono (cookie del ricevi).
  const nome = pick("nome").slice(0, 120);
  const letto = (await cookies()).get("mapetite_reel_letto")?.value;
  const autoSave = Boolean(nome && letto && decodeURIComponent(letto).slice(0, 120) === nome);

  return (
    <ScreenshotResult
      autoSave={autoSave}
      nome={pick("nome").slice(0, 120)}
      citta={pick("citta").slice(0, 80)}
      categoria={pick("categoria").slice(0, 40)}
      altri={parseAltri(pick("altri"))}
      errore={pick("errore")}
      piu={pick("piu") === "1"}
      lette={Math.min(5, Number.parseInt(pick("lette"), 10) || 0)}
      userId={e2eUser ?? userData?.user?.id ?? null}
    />
  );
}
