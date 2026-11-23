import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID_RE } from "@/lib/foto-utenti";
import { isMotivo, isTipo } from "@/lib/moderazione";

// Proposta 82 "Segnala e nascondi" (23/11): regola 1.2 dell'App Store sui contenuti degli utenti.
// azione "segnala": la recensione o la foto finisce in contenuti_segnalati (la legge Lorenzo in
//   /admin/numeri) e da subito non si vede più a chi l'ha segnalata.
// azione "nascondi": chi guarda smette di vedere recensioni e foto di quella persona (utenti_nascosti).
// L'autore si trova qui dal contenuto, con la chiave di servizio, e non torna mai al telefono: chi ha
// il profilo privato resta anonimo anche per chi lo nasconde. Al massimo 20 segnalazioni al giorno.

const LIMITE_GIORNO = 20;
const ERRORE = "Non ci sono riuscito. Riprova tra poco.";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { azione?: unknown; tipo?: unknown; id?: unknown; motivo?: unknown } | null;
  const azione = body?.azione;
  const tipo = body?.tipo;
  const id = typeof body?.id === "string" ? body.id : "";
  if ((azione !== "segnala" && azione !== "nascondi") || !isTipo(tipo) || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }
  if (azione === "segnala" && !isMotivo(body?.motivo)) {
    return NextResponse.json({ error: "Scegli un motivo." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // Giro automatico in sviluppo: utente finto, nessuna scrittura vera.
  if (!user && process.env.NODE_ENV === "development" && process.env.E2E_FAKE_USER) return NextResponse.json({ ok: true });
  if (!user) return NextResponse.json({ error: "Accedi per farlo." }, { status: 401 });

  const admin = createAdminClient();
  const tabella = tipo === "recensione" ? "reviews" : "foto_locali";
  // Foto: solo quelle pubbliche (quelle private del diario non le vede nessun altro).
  const q = admin.from(tabella).select("user_id").eq("id", id);
  const { data: riga, error: errRiga } = await (tipo === "foto" ? q.eq("pubblica", true) : q).maybeSingle<{ user_id: string }>();
  if (errRiga) {
    console.warn(`[moderazione] lettura ${tabella} ${errRiga.code ?? ""}`);
    return NextResponse.json({ error: ERRORE }, { status: 500 });
  }
  if (!riga) return NextResponse.json({ error: "Questo contenuto non c'è più." }, { status: 404 });
  if (riga.user_id === user.id) return NextResponse.json({ error: "È un tuo contenuto." }, { status: 400 });

  if (azione === "nascondi") {
    const { error } = await admin.from("utenti_nascosti").upsert({ user_id: user.id, nascosto_id: riga.user_id }, { onConflict: "user_id,nascosto_id", ignoreDuplicates: true });
    if (error) {
      console.warn(`[moderazione] nascondi ${error.code ?? ""}`);
      return NextResponse.json({ error: ERRORE }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const da = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: errConto } = await admin
    .from("contenuti_segnalati")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", da);
  if (errConto) {
    console.warn(`[moderazione] conteggio ${errConto.code ?? ""}`);
    return NextResponse.json({ error: ERRORE }, { status: 500 });
  }
  if ((count ?? 0) >= LIMITE_GIORNO) {
    return NextResponse.json({ error: "Hai già fatto molte segnalazioni oggi. Riprova domani." }, { status: 429 });
  }
  const { error } = await admin.from("contenuti_segnalati").upsert(
    { user_id: user.id, tipo, contenuto_id: id, autore_id: riga.user_id, motivo: body?.motivo },
    { onConflict: "user_id,tipo,contenuto_id", ignoreDuplicates: true },
  );
  if (error?.code === "P0001") {
    return NextResponse.json({ error: "Hai già fatto molte segnalazioni oggi. Riprova domani." }, { status: 429 });
  }
  if (error) {
    console.warn(`[moderazione] segnala ${error.code ?? ""}`);
    return NextResponse.json({ error: ERRORE }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
