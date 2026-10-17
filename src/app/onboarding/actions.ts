"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { tasteQuery } from "@/lib/preferences";
import { safeNext, withNext } from "@/lib/next-path";

interface OnboardingData {
  cuisines: string[];
  occasions: string[];
  atmospheres: string[];
  priceRange: string | null;
  // Città dove esce di solito (seconda schermata): va in profiles.city, se la colonna c'è.
  city?: string | null;
  // "importa": l'ultima schermata ha proposto di portare i salvati da Google Maps.
  dest?: "importa" | null;
  // Dove tornare dopo l'onboarding (link condiviso, pagina che chiedeva l'accesso).
  next?: string | null;
}

export async function completeOnboarding({
  cuisines,
  occasions,
  atmospheres,
  priceRange,
  city,
  dest,
  next,
}: OnboardingData): Promise<{ error: string } | { login: string } | never> {
  // Arriva dal client: si rivalida come qualsiasi input.
  const back = safeNext(next);
  const citta = cleanCity(city);
  const gusti = { cuisines, occasions, atmospheres, priceRange };

  // Solo in sviluppo con E2E_FAKE_USER (giro automatico): niente scritture, solo il percorso.
  if (process.env.NODE_ENV === "development" && process.env.E2E_FAKE_USER && !(await cookies()).get("e2e_anonimo")) {
    goOn(gusti, citta, dest, back);
  }

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  // Accesso scaduto mentre si rispondeva: il telefono conserva le risposte (bozza in
  // onboarding-view) e va al login; dopo l'accesso chi è nuovo torna all'onboarding, che le ritrova.
  if (!user) {
    return { login: withNext("/login", back) };
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

  // La città a parte: la colonna arriva con la migrazione 20261015_social; se manca, i gusti
  // restano salvati e la città si perde senza errori per l'utente.
  if (citta) {
    const { error: cityErr } = await supabase.from("profiles").update({ city: citta }).eq("id", user.id);
    if (cityErr) console.error("[onboarding] città:", cityErr.message);
  }

  goOn(gusti, citta, dest, back);
}

// Dopo l'ultima schermata.
function goOn(gusti: Parameters<typeof tasteQuery>[0], citta: string | null, dest: OnboardingData["dest"], back: string | null): never {
  // "Importa i tuoi salvati da Google Maps": /importa si apre con "Incolla più link" in cima.
  if (dest === "importa") redirect("/importa?da=benvenuto");

  // Chi arrivava da un link condiviso o da una pagina precisa torna lì (es. il locale da salvare).
  if (back) redirect(back);

  // Momento magia: la mappa si apre già con una ricerca sui gusti appena scelti
  // (1 ricerca Google, una volta per utente, come se la scrivesse lui), nella sua città.
  const q = tasteQuery(gusti);
  const full = q && citta ? `${q} a ${citta}` : q;
  redirect(full ? `/mappa?q=${encodeURIComponent(full)}` : "/mappa");
}

// Città scritta a mano: solo lettere, spazi, apostrofi e trattini, al massimo 40 caratteri.
function cleanCity(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().replace(/\s+/g, " ").slice(0, 40);
  if (!/^[\p{L}' -]{2,40}$/u.test(v)) return null;
  return v.charAt(0).toUpperCase() + v.slice(1);
}

// "Salta": chi vuole provare subito l'app non risponde alle domande, ma l'onboarding conta come
// fatto. Prima restava "da fare": ogni accesso riportava qui e "I tuoi gusti" (/me) rimandava
// all'onboarding. I gusti restano vuoti e si possono dare dopo da "I tuoi gusti".
export async function skipOnboarding(formData: FormData): Promise<never> {
  const back = safeNext(formData.get("next"));
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { error } = await supabase
      .from("profiles")
      .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) console.error("[onboarding] salta:", error.message);
  }
  redirect(back ?? "/mappa");
}
