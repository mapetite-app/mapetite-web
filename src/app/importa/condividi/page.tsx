import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import ShareImport from "./share-import";
import { CONDIVISO_COOKIE, impronta } from "@/lib/condiviso";

// Arrivo da "Condividi" di Google Maps (Android, app installata: share_target nel manifest).
// Google manda nome del locale e link in title / text / url, a seconda dell'app.
export default async function CondividiPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const pick = (k: string) => {
    const v = params[k];
    return (Array.isArray(v) ? v[0] : v ?? "").trim();
  };
  const title = pick("title");
  const sharedText = [pick("text"), pick("url")].filter(Boolean).join("\n");

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  // Solo in sviluppo locale: utente finto per il test automatico (scripts/e2e/giro.mjs);
  // il cookie "e2e_anonimo" simula chi non ha fatto l'accesso.
  const dev = process.env.NODE_ENV === "development";
  const anonimo = dev && (await cookies()).has("e2e_anonimo");
  const e2eUser = dev && !anonimo ? process.env.E2E_FAKE_USER ?? null : null;

  // Salvataggio da solo di un reel solo se il testo arriva davvero dal Condividi (impronta lasciata dal ricevi).
  const fullText = [title, sharedText].filter(Boolean).join("\n");
  const segno = (await cookies()).get(CONDIVISO_COOKIE)?.value;
  const autoSave = Boolean(fullText && segno && segno === impronta(fullText));

  return <ShareImport title={title} sharedText={sharedText} autoSave={autoSave} userId={anonimo ? null : e2eUser ?? userData?.user?.id ?? null} />;
}
