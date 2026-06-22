import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PreferencesEditor from "./preferences-editor";

export default async function PreferencePage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    redirect("/login");
  }

  const user = data.user;

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed, cuisines, occasions, atmospheres, price_range")
    .eq("id", user.id)
    .single();

  if (!profile?.onboarding_completed) {
    redirect("/onboarding");
  }

  return (
    <PreferencesEditor
      initialCuisines={profile.cuisines ?? []}
      initialOccasions={profile.occasions ?? []}
      initialAtmospheres={profile.atmospheres ?? []}
      initialPriceRange={profile.price_range ?? null}
    />
  );
}
