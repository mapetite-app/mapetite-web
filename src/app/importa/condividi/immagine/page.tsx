import { createClient } from "@/lib/supabase/server";
import ScreenshotResult from "./screenshot-result";

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

  return (
    <ScreenshotResult
      nome={pick("nome").slice(0, 120)}
      citta={pick("citta").slice(0, 80)}
      errore={pick("errore")}
      piu={pick("piu") === "1"}
      userId={e2eUser ?? userData?.user?.id ?? null}
    />
  );
}
