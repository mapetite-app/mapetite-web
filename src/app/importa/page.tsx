import { createClient } from "@/lib/supabase/server";
import ImportaView from "./importa-view";

export default async function ImportaPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  // Solo in sviluppo locale: utente finto per il test automatico (scripts/e2e/giro.mjs).
  const e2eUser = process.env.NODE_ENV === "development" ? process.env.E2E_FAKE_USER ?? null : null;
  return <ImportaView userId={e2eUser ?? userData?.user?.id ?? null} />;
}
