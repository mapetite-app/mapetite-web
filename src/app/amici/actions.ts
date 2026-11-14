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
