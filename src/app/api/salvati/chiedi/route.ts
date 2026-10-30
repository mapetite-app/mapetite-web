import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { allowAi, clientKey } from "@/lib/ai-limit";
import { createClient } from "@/lib/supabase/server";
import { cityFromAddress } from "@/lib/city";
import { categoryLabel } from "@/lib/category-label";
import { isStateTag } from "@/lib/tags";
import { MAX_POSTI, MAX_TOKENS, MIN_POSTI_RICERCA, buildPrompt, estimateCostUsd, parseScelte, pulisciDomanda, type PostoSalvato } from "@/lib/chiedi-salvati";

// "Chiedi ai tuoi posti" (PROPOSTE.md 33). Body: { domanda }. Legge solo i salvati della persona
// (sessione, RLS) e verdetto/sintesi già in memoria; una chiamata Haiku, nessuna chiamata Google.
// Risponde { scelti: [{ id, perche }] } con id = UUID dei salvati. Senza AI: 503, la lista resta.
// { da: "ricerca" }: la stessa scelta accanto a una ricerca nel mondo ("Dai tuoi salvati" sopra i
// risultati); tetto a parte e niente chiamata con meno di MIN_POSTI_RICERCA salvati.

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 15_000 });
const HAIKU_MODEL = "claude-haiku-4-5-20251001";

type Row = {
  tags: string[] | null;
  note: string | null;
  places: { id: string; name: string; category: string | null; address: string | null; google_place_id: string | null } | null;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const domanda = pulisciDomanda(body?.domanda);
  const daRicerca = body?.da === "ricerca";
  if (!domanda) return NextResponse.json({ error: "Scrivi cosa cerchi." }, { status: 400 });

  const supabase = await createClient();
  const devUser = process.env.NODE_ENV === "development" ? process.env.E2E_FAKE_USER ?? null : null;
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? devUser;
  if (!userId) return NextResponse.json({ error: "Accedi per chiedere ai tuoi posti." }, { status: 401 });

  const { data, error } = await supabase
    .from("saved_places")
    .select("tags, note, places (id, name, category, address, google_place_id)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(MAX_POSTI);
  if (error) {
    console.error("[chiedi-salvati] lettura saved_places fallita:", error.message);
    return NextResponse.json({ error: "Non riesco a leggere i tuoi posti: riprova." }, { status: 502 });
  }
  const rows = ((data ?? []) as unknown as Row[]).filter((r) => r.places);
  if (rows.length < (daRicerca ? MIN_POSTI_RICERCA : 1)) return NextResponse.json({ scelti: [] });

  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Non posso rispondere adesso: riprova più tardi." }, { status: 503 });
  if (!allowAi(daRicerca ? "chiedi-ricerca" : "chiedi", clientKey(request, userId))) {
    return NextResponse.json({ error: "Hai fatto tante domande in poco tempo: riprova tra qualche minuto." }, { status: 429 });
  }

  // Verdetto e sintesi già in memoria (lettura pubblica): nessuna chiamata nuova.
  const googleIds = rows.map((r) => r.places!.google_place_id).filter((g): g is string => !!g);
  const syn = new Map<string, { verdict: string | null; synthesis: string | null }>();
  if (googleIds.length > 0) {
    const { data: s, error: sErr } = await supabase.from("place_synthesis").select("place_id, verdict, synthesis").in("place_id", googleIds);
    if (sErr) console.error("[chiedi-salvati] lettura place_synthesis fallita:", sErr.message);
    for (const v of s ?? []) syn.set(v.place_id as string, { verdict: (v.verdict as string) || null, synthesis: (v.synthesis as string) || null });
  }
  const posti: PostoSalvato[] = rows.map((r) => {
    const p = r.places!;
    const s = p.google_place_id ? syn.get(p.google_place_id) : undefined;
    return {
      id: p.id,
      name: p.name,
      category: categoryLabel(p.category) ?? p.category,
      city: cityFromAddress(p.address),
      raccolte: (r.tags ?? []).filter((t) => !isStateTag(t) && t.trim()),
      note: r.note,
      verdict: s?.verdict ?? null,
      synthesis: s?.synthesis ?? null,
    };
  });

  const t0 = Date.now();
  try {
    const message = await anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: buildPrompt(domanda, posti) }],
    });
    const { input_tokens, output_tokens } = message.usage;
    const text = message.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    const scelti = parseScelte(text, posti);
    console.log(`[chiedi-salvati]${daRicerca ? " da=ricerca" : ""} posti=${posti.length} scelti=${scelti.length} ms=${Date.now() - t0} in=${input_tokens} out=${output_tokens} cost=$${estimateCostUsd(input_tokens, output_tokens).toFixed(6)}`);
    return NextResponse.json({ scelti });
  } catch (err) {
    console.error("[chiedi-salvati] chiamata Haiku fallita:", err);
    return NextResponse.json({ error: "Non sono riuscito a rispondere: riprova tra poco." }, { status: 502 });
  }
}
