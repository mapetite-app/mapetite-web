"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
    return { error: error.message };
  }

  redirect("/mappa");
}
