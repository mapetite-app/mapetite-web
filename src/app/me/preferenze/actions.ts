"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

interface PreferencesData {
  cuisines: string[];
  occasions: string[];
  atmospheres: string[];
  price_range: string;
}

export async function updatePreferences({
  cuisines,
  occasions,
  atmospheres,
  price_range,
}: PreferencesData): Promise<{ error: string | null }> {
  if (cuisines.length === 0 || occasions.length === 0) {
    return { error: "Seleziona almeno una cucina e una occasione." };
  }

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
      price_range,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    console.error("[preferenze] salvataggio gusti:", error.message);
    return { error: "Non sono riuscito a salvare i tuoi gusti. Controlla la connessione e riprova." };
  }

  return { error: null };
}
