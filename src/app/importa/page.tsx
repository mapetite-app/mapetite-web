import { cookies } from "next/headers";
import { getUser } from "@/lib/supabase/server";
import ImportaView from "./importa-view";

export default async function ImportaPage() {
  const { data: userData } = await getUser();
  // Solo in sviluppo locale: utente finto per il test automatico (scripts/e2e/giro.mjs);
  // il cookie "e2e_anonimo" simula chi non ha fatto l'accesso.
  const dev = process.env.NODE_ENV === "development";
  const anonimo = dev && (await cookies()).has("e2e_anonimo");
  const e2eUser = dev && !anonimo ? process.env.E2E_FAKE_USER ?? null : null;
  return <ImportaView userId={anonimo ? null : e2eUser ?? userData?.user?.id ?? null} />;
}
