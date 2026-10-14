import { NextResponse } from "next/server";

// Route di servizio (arricchimento, seed delle guide): scrivono con i permessi di servizio
// in dati che finiscono nei verdetti, o chiamano API a quota (Google, YouTube). Non sono per
// il pubblico: in sviluppo libere; online solo con l'intestazione `x-admin-key` uguale alla
// chiave segreta di Supabase già presente sul server. Altrimenti rispondono 404.
export function adminOnly(req: Request): NextResponse | null {
  if (process.env.NODE_ENV === "development") return null;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (key && req.headers.get("x-admin-key") === key) return null;
  return NextResponse.json({ error: "Non trovato." }, { status: 404 });
}
