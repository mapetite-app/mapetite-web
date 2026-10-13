"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { tasteQuery } from "@/lib/preferences";
import { safeNext, withNext } from "@/lib/next-path";

interface OnboardingData {
  cuisines: string[];
  occasions: string[];
  atmospheres: string[];
  priceRange: string | null;
  // Dove tornare dopo l'onboarding (link condiviso, pagina che chiedeva l'accesso).
  next?: string | null;
}

export async function completeOnboarding({
  cuisines,
  occasions,
  atmospheres,
  priceRange,
  next,
}: OnboardingData): Promise<{ error: string } | never> {
  // Arriva dal client: si rivalida come qualsiasi input.
  const back = safeNext(next);
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(withNext("/login", back));
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      cuisines,
      occasions,
      atmospheres,
      price_range: priceRange,
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    // Il messaggio del database è in inglese e tecnico: al tester se ne mostra uno chiaro.
    console.error("[onboarding] salvataggio gusti:", error.message);
    return { error: "Non sono riuscito a salvare i tuoi gusti. Controlla la connessione e riprova." };
  }

  // Chi arrivava da un link condiviso o da una pagina precisa torna lì (es. il locale da salvare).
  if (back) redirect(back);

  // Momento magia: la mappa si apre già con una ricerca sui gusti appena scelti
  // (1 ricerca Google, una volta per utente, come se la scrivesse lui).
  const q = tasteQuery({ cuisines, occasions, atmospheres, priceRange });
  redirect(q ? `/mappa?q=${encodeURIComponent(q)}` : "/mappa");
}
