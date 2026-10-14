import OnboardingView from "./onboarding-view";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { safeNext, withNext } from "@/lib/next-path";

// Con `next` (arrivato da un link condiviso o da una pagina che chiedeva l'accesso)
// l'onboarding, finito o saltato, riporta lì. Senza, comportamento di sempre.
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = safeNext(Array.isArray(params.next) ? params.next[0] : params.next);
  // Senza accesso le 4 risposte si perdevano al salvataggio (che chiede l'accesso): prima
  // ci si registra, poi la registrazione riporta qui (decisione 13b del backlog, 15/10).
  // In sviluppo con E2E_FAKE_USER (giro automatico) l'utente finto conta come collegato.
  const e2eUser = process.env.NODE_ENV === "development" && !(await cookies()).get("e2e_anonimo") ? process.env.E2E_FAKE_USER : undefined;
  if (!e2eUser) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect(withNext("/signup", next));
  }
  return <OnboardingView next={next} />;
}
