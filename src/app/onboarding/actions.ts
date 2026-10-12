"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { tasteQuery } from "@/lib/preferences";

interface OnboardingData {
  cuisines: string[];
  occasions: string[];
  atmospheres: string[];
  priceRange: string | null;
}

export async function completeOnboarding({
  cuisines,
  occasions,
  atmospheres,
  priceRange,
}: OnboardingData): Promise<{ error: string } | never> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
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

  // Momento magia: la mappa si apre già con una ricerca sui gusti appena scelti
  // (1 ricerca Google, una volta per utente, come se la scrivesse lui).
  const q = tasteQuery({ cuisines, occasions, atmospheres, priceRange });
  redirect(q ? `/mappa?q=${encodeURIComponent(q)}` : "/mappa");
}
