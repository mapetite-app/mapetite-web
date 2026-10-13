import OnboardingView from "./onboarding-view";
import { safeNext } from "@/lib/next-path";

// Con `next` (arrivato da un link condiviso o da una pagina che chiedeva l'accesso)
// l'onboarding, finito o saltato, riporta lì. Senza, comportamento di sempre.
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = safeNext(Array.isArray(params.next) ? params.next[0] : params.next);
  return <OnboardingView next={next} />;
}
