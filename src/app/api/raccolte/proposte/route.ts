import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { allowAi, clientKey } from "@/lib/ai-limit";
import { createClient } from "@/lib/supabase/server";
import { cityFromAddress } from "@/lib/city";
import { categoryLabel } from "@/lib/category-label";
import { isStateTag } from "@/lib/tags";
import { MAX_PER_CALL, MAX_TOKENS, buildPrompt, estimateCostUsd, parseProposals, type ClassifyInput } from "@/lib/raccolte-ai";

// Proposte di raccolte per i salvati senza raccolta (piano 4.2). Una chiamata Haiku per gruppo
// di al massimo 30 salvati, dentro il tetto AI (ai-limit "raccolte"). Legge solo i salvati
// dell'utente (sessione, RLS) e il verdetto già in memoria; non scrive niente: l'utente accetta
// dal profilo e la scrittura parte dal browser come per ogni altra raccolta.
// Body: { escludi?: string[] } = UUID già proposti o scartati, per passare al gruppo successivo.

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 20_000 });
const HAIKU_MODEL = "claude-haiku-4-5-20251001";

type Row = {
  tags: string[] | null;
  places: { id: string; name: string; category: string | null; address: string | null; google_place_id: string | null } | null;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const exclude = new Set(Array.isArray(body?.escludi) ? (body.escludi as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 2000) : []);

  const supabase = await createClient();
  const devUser = process.env.NODE_ENV === "development" ? process.env.E2E_FAKE_USER ?? null : null;
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? devUser;
  if (!userId) return NextResponse.json({ error: "Accedi per organizzare i tuoi salvati." }, { status: 401 });

  const { data, error } = await supabase
    .from("saved_places")
    .select("tags, places (id, name, category, address, google_place_id)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[raccolte-proposte] lettura saved_places fallita:", error.message);
    return NextResponse.json({ error: "Non riesco a leggere i tuoi salvati: riprova." }, { status: 502 });
  }
  const rows = (data ?? []) as unknown as Row[];
  const existing = [...new Set(rows.flatMap((r) => (r.tags ?? []).filter((t) => !isStateTag(t) && t.trim())))];
  const free = rows.filter((r) => r.places && !exclude.has(r.places.id) && !(r.tags ?? []).some((t) => !isStateTag(t) && t.trim()));
  if (free.length === 0) return NextResponse.json({ proposte: [], restanti: 0 });
  const group = free.slice(0, MAX_PER_CALL);

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Le proposte automatiche non sono disponibili in questo momento." }, { status: 503 });
  }
  if (!allowAi("raccolte", clientKey(request, userId))) {
    return NextResponse.json({ error: "Hai chiesto tante proposte in poco tempo: riprova tra qualche minuto." }, { status: 429 });
  }

  // Verdetto già in memoria (place_synthesis, lettura pubblica): nessuna chiamata nuova.
  const googleIds = group.map((r) => r.places!.google_place_id).filter((g): g is string => !!g);
  const verdicts = new Map<string, string>();
  if (googleIds.length > 0) {
    const { data: s, error: sErr } = await supabase.from("place_synthesis").select("place_id, verdict").in("place_id", googleIds);
    if (sErr) console.error("[raccolte-proposte] lettura place_synthesis fallita:", sErr.message);
    for (const v of s ?? []) if (v.verdict) verdicts.set(v.place_id as string, v.verdict as string);
  }
  const input: ClassifyInput[] = group.map((r) => ({
    id: r.places!.id,
    name: r.places!.name,
    category: categoryLabel(r.places!.category) ?? r.places!.category,
    city: cityFromAddress(r.places!.address),
    verdict: r.places!.google_place_id ? verdicts.get(r.places!.google_place_id) ?? null : null,
  }));

  try {
    const message = await anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: buildPrompt(input, existing) }],
    });
    const { input_tokens, output_tokens } = message.usage;
    console.log(`[raccolte-proposte] places=${input.length} in=${input_tokens} out=${output_tokens} stop=${message.stop_reason} cost=$${estimateCostUsd(input_tokens, output_tokens).toFixed(6)}`);
    const text = message.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    const proposals = parseProposals(text, input, existing);
    const names = new Map(input.map((p) => [p.id, p.name]));
    return NextResponse.json({
      proposte: proposals.map((p) => ({ id: p.id, name: names.get(p.id) ?? "", raccolte: p.collections })),
      // Gli id esaminati (anche senza proposta): il telefono li esclude alla richiesta successiva.
      esaminati: input.map((p) => p.id),
      restanti: free.length - group.length,
    });
  } catch (err) {
    console.error("[raccolte-proposte] chiamata Haiku fallita:", err);
    return NextResponse.json({ error: "Non sono riuscito a preparare le proposte: riprova tra poco." }, { status: 502 });
  }
}
