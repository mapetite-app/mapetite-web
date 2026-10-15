import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractSearchIntent } from "@/lib/search-intent";
import { allowAi, clientKey } from "@/lib/ai-limit";

// La frase capita mentre la persona scrive (piano 2.4: prima card in ~2 s). Solo Haiku, nessuna
// chiamata Google: quando arriva l'Invio la ricerca parte subito con l'intento già pronto.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const query = typeof body?.query === "string" ? body.query.trim() : "";
  if (query.length < 8 || query.length > 300) return NextResponse.json({ intent: null });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!allowAi("intento", clientKey(request, user?.id))) return NextResponse.json({ intent: null });
  const intent = await extractSearchIntent(query);
  return NextResponse.json({ intent, query });
}
