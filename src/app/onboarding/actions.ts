"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ATMOSPHERES, CUISINES, OCCASIONS, PRICE_RANGES, tasteQuery } from "@/lib/preferences";
import { DIETE } from "@/lib/mappa-gusto";
import { dieteValide, gustiDaTipi, pulisciMappa, queryPerTe, type MappaGusto } from "@/lib/mappa-gusto";
import { ZONE } from "@/lib/gusti";
import { amatiValidi, oraDiRoma, ordinePerOra, tipoLocale } from "@/lib/tipi-locale";
import { safeNext, withNext } from "@/lib/next-path";
import { primoLink } from "@/lib/primo-link";
import { cleanInviteCode, isFriendCode } from "@/lib/invito";
import { anteprimaInvito, loadAmici } from "@/lib/social";

interface OnboardingData {
  cuisines: string[];
  occasions: string[];
  atmospheres: string[];
  priceRange: string | null;
  // Città dove esce di solito (seconda schermata): va in profiles.city, se la colonna c'è.
  city?: string | null;
  // "importa": l'ultima schermata ha proposto di portare i salvati da Google Maps.
  // "gesto": si entra in "Salva il primo posto": i gusti si salvano subito, senza uscire dal primo accesso
  // (revisore 22/11: chi va su Instagram a condividere un reel non deve perdere il profilo).
  dest?: "importa" | "condividi" | "gesto" | null;
  // "condividi" (proposta 52, "Salva il primo posto"): il link incollato, si riapre in "Salva dal reel" / da Maps.
  link?: string | null;
  // Dove tornare dopo l'onboarding (link condiviso, pagina che chiedeva l'accesso).
  next?: string | null;
  // Mappa del gusto (sprint 25/10): zone, tipi di posto 👍/👎, "famosi o chicche?", diete.
  gusto?: unknown;
  diete?: unknown;
}

export async function completeOnboarding({
  cuisines,
  occasions,
  atmospheres,
  priceRange,
  city,
  dest,
  next,
  link: linkRaw,
  gusto: gustoRaw,
  diete: dieteRaw,
}: OnboardingData): Promise<{ error: string } | { login: string } | { ok: true } | never> {
  // Arriva dal client: si rivalida come qualsiasi input.
  const back = safeNext(next);
  // Il link incollato si ricontrolla qui: solo un reel o un posto di Maps, mai un indirizzo qualsiasi.
  const trovato = dest === "condividi" && typeof linkRaw === "string" ? primoLink(linkRaw) : null;
  const primo = trovato && "link" in trovato ? trovato.link : null;
  const citta = cleanCity(city);
  // Tutto si rivalida: solo valori che l'app conosce (zone, tipi, cucine, atmosfere, occasioni, spesa, diete).
  const mappa = pulisciMappa(gustoRaw, (z) => ZONE.some((x) => x.nome === z && (!citta || x.citta === citta)));
  mappa.amati = amatiValidi(mappa.amati);
  // "Cosa ti piace?" non arriva dal primo accesso vecchio (?primo=vecchio): lì si tengono i gusti già salvati.
  const amatiArrivati = !!gustoRaw && typeof gustoRaw === "object" && Array.isArray((gustoRaw as { amati?: unknown }).amati);
  // Diete: solo se la persona è passata dalla schermata "Come esci" (altrimenti non arrivano e restano quelle di prima).
  const diete = Array.isArray(dieteRaw) ? dieteValide(dieteRaw) : null;
  const valide = (v: unknown, lista: { value: string }[]) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && lista.some((l) => l.value === x)) : []);
  const scelteOcc = Array.isArray(occasions) ? occasions.filter((o) => OCCASIONS.some((x) => x.value === o)) : [];
  const scelteSpesa = PRICE_RANGES.some((x) => x.value === priceRange) ? priceRange : null;
  const dedotti = gustiDaTipi(mappa.su, { occasions: scelteOcc, priceRange: scelteSpesa });
  const gusti = {
    cuisines: [...new Set([...valide(cuisines, CUISINES), ...dedotti.cuisines])].slice(0, 8),
    occasions: dedotti.occasions,
    atmospheres: [...new Set([...valide(atmospheres, ATMOSPHERES), ...dedotti.atmospheres])].slice(0, 8),
    priceRange: dedotti.priceRange,
  };

  // Solo in sviluppo con E2E_FAKE_USER (giro automatico): niente scritture, solo il percorso.
  if (process.env.NODE_ENV === "development" && process.env.E2E_FAKE_USER && !(await cookies()).get("e2e_anonimo")) {
    if (dest === "gesto") return { ok: true };
    goOn(gusti, citta, dest, back, mappa, primo);
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
      // Solo quello che questa volta c'è: con "Rifalla" saltando un passo le preferenze di prima restano.
      ...(gusti.cuisines.length > 0 && { cuisines: gusti.cuisines }),
      ...(gusti.occasions.length > 0 && { occasions: gusti.occasions }),
      ...(gusti.atmospheres.length > 0 && { atmospheres: gusti.atmospheres }),
      ...(gusti.priceRange && { price_range: gusti.priceRange }),
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

  // Mappa del gusto e diete a parte: senza le colonne (migrazioni 20261021_mappa_gusto e
  // 20261016_gusti_ricordati) i gusti di sempre restano salvati, senza errori per l'utente.
  if (!amatiArrivati) {
    const { data: prima } = await supabase.from("profiles").select("gusto").eq("id", user.id).maybeSingle();
    mappa.amati = amatiValidi((prima?.gusto as { amati?: unknown } | null)?.amati);
  }
  if (mappa.zone.length || mappa.su.length || mappa.giu.length || mappa.scoperta || mappa.amati.length) {
    const { error: gErr } = await supabase.from("profiles").update({ gusto: mappa }).eq("id", user.id);
    if (gErr) console.error("[onboarding] mappa del gusto:", gErr.message);
  }
  if (diete) {
    // Le diete del primo accesso sostituiscono le precedenti ("Rifalla" e tolgo "Niente pesce");
    // gli altri gusti ricordati dall'assistente (tranquillo, budget…) restano.
    const { data: prof } = await supabase.from("profiles").select("gusti_ricordati").eq("id", user.id).maybeSingle();
    const prima = Array.isArray(prof?.gusti_ricordati) ? (prof.gusti_ricordati as string[]).filter((id) => !DIETE.some((d) => d.id === id)) : [];
    const { error: dErr } = await supabase.from("profiles").update({ gusti_ricordati: [...new Set([...prima, ...diete])] }).eq("id", user.id);
    if (dErr) console.error("[onboarding] diete:", dErr.message);
  }

  if (dest === "gesto") return { ok: true };
  goOn(gusti, citta, dest, back, mappa, primo);
}

// Inviti tra amici (14/11, rifatti dopo la revisione): il primo accesso mostra chi ti ha invitato e chiede
// "Diventa amico" o "Non ora". Solo i codici casuali "i-…" (migrazione 20261114c_inviti_sicuri).
// "amico": chi guarda è già amico di chi invita (allora niente "Diventa amico").
export type ChiInvita = { nome: string | null; amico: boolean } | null | "rete";
// "nome": il database chiede prima il tuo nome (revisore 14/11, terzo giro: obbligatorio anche nel server).
export type EsitoInvito = { stato: "ok"; nome: string | null } | { stato: "nome" } | { stato: "no"; motivo: string } | { stato: "rete" };

const fakeE2E = async () => process.env.NODE_ENV === "development" && !!process.env.E2E_FAKE_USER && !(await cookies()).get("e2e_anonimo");
const nomeFinto = (codice: string) => (codice.endsWith("0000000000aa") ? "Giulia" : null);

export async function chiInvita(raw: unknown): Promise<ChiInvita> {
  const codice = cleanInviteCode(raw);
  if (!isFriendCode(codice)) return null;
  if (await fakeE2E()) {
    // Giro automatico: come anteprima_invito, "amico" vale anche quando chi invita è già tra gli amici del dato finto
    // (revisore 15/11: Giulia era tra gli amici e insieme l'invito in sospeso "Diventa amico di Giulia").
    if (codice.endsWith("ffffffffffff")) return null;
    const a = await anteprimaInvito(codice);
    if (a && a !== "errore") return { nome: a.nome, amico: a.amico };
    const nome = nomeFinto(codice);
    const amici = await loadAmici();
    return { nome, amico: codice.endsWith("00000000a1a1") || (!!nome && amici.some((x) => x.display_name === nome)) };
  }
  const p = await anteprimaInvito(codice);
  // Errore del database o rete: "rete", così il telefono tiene il codice e riprova (revisore 14/11).
  if (p === "errore") return "rete";
  return p ? { nome: p.nome, amico: p.amico } : null;
}

// "nome": chi accetta e non ha ancora un nome lo sceglie qui (lo vedrà l'amico: revisore 14/11, prima
// si vedeva "Qualcuno"). Si scrive solo se il profilo non ne ha già uno (vuoto o fatto di spazi conta come nessuno).
export async function accettaInvito(raw: unknown, nomeRaw?: unknown): Promise<EsitoInvito> {
  const codice = cleanInviteCode(raw);
  if (!isFriendCode(codice)) return { stato: "no", motivo: "codice" };
  // Troncato per caratteri veri (emoji comprese), non per unità UTF-16 (revisore 14/11).
  const nome = typeof nomeRaw === "string" ? Array.from(nomeRaw.trim()).slice(0, 40).join("") : "";
  if (await fakeE2E()) {
    // Giro automatico: codici finti per gli esiti "già usato", "l'avevi tolto tu" e "troppi".
    if (codice.endsWith("00000000a5a5")) return { stato: "no", motivo: "gia-usato" };
    if (codice.endsWith("00000000a6a6")) return { stato: "no", motivo: "tolto-da-te" };
    if (codice.endsWith("00000000a7a7")) return { stato: "no", motivo: "troppi" };
    if (codice.endsWith("00000000a8a8")) return { stato: "no", motivo: "troppi-lui" };
    return { stato: "ok", nome: nomeFinto(codice) };
  }
  const supabase = await createClient();
  if (nome) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: prof } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
      if (!(prof?.display_name as string | null | undefined)?.trim()) {
        const { error: nErr } = await supabase.from("profiles").update({ display_name: nome, updated_at: new Date().toISOString() }).eq("id", user.id);
        if (nErr) console.error("[invito] nome:", nErr.message);
      }
    }
  }
  const { data, error } = await supabase.rpc("accetta_invito", { p_codice: codice });
  if (error) {
    console.error("[invito] accetta:", error.code, error.message);
    return { stato: "rete" };
  }
  const r = data as { stato?: string; nome?: string | null } | null;
  if (r?.stato === "ok") return { stato: "ok", nome: r.nome ?? null };
  if (r?.stato === "nome") return { stato: "nome" };
  return r?.stato === "anonimo" ? { stato: "rete" } : { stato: "no", motivo: r?.stato ?? "?" };
}

// Dopo l'ultima schermata.
// Revisore 7/11: chi tocca prima "Ristorante" non deve partire da "Ristorante a Roma" se ha scelto anche le pizzerie.
const GENERICI = new Set(["ristorante", "fast-food"]);

function goOn(gusti: Parameters<typeof tasteQuery>[0], citta: string | null, dest: OnboardingData["dest"], back: string | null, mappa: MappaGusto, primo: string | null = null): never {
  // "Salva il primo posto": si apre la pagina del link condiviso, che legge il reel o il posto e lo salva.
  if (dest === "condividi" && primo) redirect(`/importa/condividi?${new URLSearchParams({ text: primo })}`);
  // "Importa i tuoi salvati da Google Maps": /importa si apre con "Incolla più link" in cima.
  if (dest === "importa") redirect("/importa?da=benvenuto");

  // Chi arrivava da un link condiviso o da una pagina precisa torna lì (es. il locale da salvare).
  if (back) redirect(back);

  // Momento magia: la mappa si apre già con una ricerca sui gusti appena scelti
  // (1 ricerca Google, una volta per utente, come se la scrivesse lui), nella sua città.
  // Con la mappa del gusto: "5 posti per te" sul tipo di posto piaciuto, nella zona, "non turistico"
  // per chi ama le chicche. Senza: la ricerca sui gusti di sempre.
  // Prova dal vivo 8/11: il tipo adatto all'ora (di sera un cocktail bar, se piace), poi i generici in fondo.
  const perTe = queryPerTe(mappa, citta, ordinePerOra([...mappa.amati].sort((a, b) => Number(GENERICI.has(a)) - Number(GENERICI.has(b))), oraDiRoma()).map((id) => tipoLocale(id)?.query).find((x): x is string => !!x) ?? null);
  const q = tasteQuery(gusti);
  const full = perTe ?? (q && citta ? `${q} a ${citta}` : q);
  redirect(full ? `/mappa?q=${encodeURIComponent(full)}` : "/mappa");
}

// "I miei gusti" dal profilo (5/11): solo la lista dei tipi amati dentro profiles.gusto (jsonb), il resto
// della mappa del gusto resta com'è. Nessuna migrazione: il campo vive nel jsonb che c'è già.
export async function salvaAmati(raw: unknown): Promise<{ error: string | null; amati: string[] }> {
  const amati = amatiValidi(raw);
  // Giro automatico (sviluppo con E2E_FAKE_USER): niente database, si rimanda indietro la lista pulita.
  if (process.env.NODE_ENV === "development" && process.env.E2E_FAKE_USER && !(await cookies()).get("e2e_anonimo")) {
    return { error: null, amati };
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Accesso scaduto: entra di nuovo e riprova.", amati };
  const { data: p, error: rErr } = await supabase.from("profiles").select("gusto").eq("id", user.id).maybeSingle();
  if (rErr) {
    console.error("[gusti] lettura profilo:", rErr.message);
    return { error: "Non sono riuscito a salvare i tuoi gusti. Controlla la connessione e riprova.", amati };
  }
  // Si riscrive il jsonb intero partendo da quello salvato: zone, 👍/👎 e "famosi o chicche" restano.
  const prima = p?.gusto && typeof p.gusto === "object" ? (p.gusto as Record<string, unknown>) : { v: 2 };
  const { error } = await supabase.from("profiles").update({ gusto: { ...prima, amati }, updated_at: new Date().toISOString() }).eq("id", user.id);
  if (error) {
    console.error("[gusti] salvataggio amati:", error.message);
    return { error: "Non sono riuscito a salvare i tuoi gusti. Controlla la connessione e riprova.", amati };
  }
  return { error: null, amati };
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
