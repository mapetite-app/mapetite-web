"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// "Togli dagli amici" (revisore 14/11): toglie i due "segui" tra te e l'amico (funzione togli_amico,
// migrazione 20261114d). Prima chi aveva mandato l'invito non poteva togliere chi l'aveva accettato.
export async function togliAmico(id: unknown): Promise<boolean> {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return false;
  if (process.env.NODE_ENV === "development" && process.env.E2E_FAKE_USER && !(await cookies()).get("e2e_anonimo")) return true;
  const supabase = await createClient();
  const { error } = await supabase.rpc("togli_amico", { p_id: id });
  if (error) console.error("[amici] togli:", error.code, error.message);
  return !error;
}

// Dal profilo: il nome da mostrare, che serve per avere il link d'invito (chi lo riceve deve sapere chi è).
export async function salvaNome(raw: unknown): Promise<boolean> {
  const nome = typeof raw === "string" ? raw.trim().slice(0, 40) : "";
  if (!nome) return false;
  if (process.env.NODE_ENV === "development" && process.env.E2E_FAKE_USER && !(await cookies()).get("e2e_anonimo")) return true;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase.from("profiles").update({ display_name: nome, updated_at: new Date().toISOString() }).eq("id", user.id);
  if (error) console.error("[amici] nome:", error.message);
  return !error;
}

// "Nuovo link" (revisore 14/11, terzo giro): un codice d'invito nuovo; quello di prima smette di funzionare
// (utile se il link è girato troppo). Funzione nuovo_invito, migrazione 20261114e.
export async function nuovoInvito(): Promise<string | null> {
  if (process.env.NODE_ENV === "development" && process.env.E2E_FAKE_USER && !(await cookies()).get("e2e_anonimo")) return "i-00000000c0de";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("nuovo_invito");
  if (error) console.error("[amici] nuovo invito:", error.code, error.message);
  return typeof data === "string" && /^i-[0-9a-f]{12}$/.test(data) ? data : null;
}
