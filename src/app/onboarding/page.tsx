import OnboardingView, { type DalProfilo } from "./onboarding-view";
import { dieteValide, pulisciMappa } from "@/lib/mappa-gusto";
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
  // "Rifalla" (da I tuoi gusti): si riparte dalle risposte già date, così non si perde niente
  // (prima le diete non ritoccate si cancellavano). Senza colonne o senza profilo, si parte vuoti.
  let dalProfilo: DalProfilo | null = null;
  if (!e2eUser) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect(withNext("/signup", next));
    const { data: p, error } = await supabase.from("profiles").select("city, occasions, price_range, cuisines, atmospheres, gusto, gusti_ricordati").eq("id", user.id).maybeSingle();
    if (!error && p) {
      const r = p as { city?: string | null; occasions?: string[] | null; price_range?: string | null; cuisines?: string[] | null; atmospheres?: string[] | null; gusto?: unknown; gusti_ricordati?: unknown };
      const m = pulisciMappa(r.gusto, () => true);
      dalProfilo = { city: r.city ?? null, occasions: r.occasions ?? [], priceRange: r.price_range ?? null, zone: m.zone, su: m.su, giu: m.giu, scoperta: m.scoperta, diete: dieteValide(r.gusti_ricordati), cuisines: r.cuisines ?? [], atmospheres: r.atmospheres ?? [] };
    }
  }
  // Giro automatico: il profilo già salvato arriva da un cookie (nessun database).
  if (e2eUser) {
    try {
      const raw = (await cookies()).get("e2e_gusto")?.value;
      if (raw) dalProfilo = JSON.parse(decodeURIComponent(raw)) as DalProfilo;
    } catch { /* cookie non valido: si parte vuoti */ }
  }
  return <OnboardingView next={next} dalProfilo={dalProfilo} />;
}
