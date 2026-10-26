"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ChevronRight } from "lucide-react";
import { completeOnboarding, skipOnboarding } from "./actions";
import { CUISINES, OCCASIONS, ATMOSPHERES, PRICE_RANGES } from "@/lib/preferences";
import { DIETE, SCOPERTE, TIPI, capito, fraseCapito, dieteValide, pulisciMappa, scopertaDedotta, type Scoperta } from "@/lib/mappa-gusto";
import { ZONE } from "@/lib/gusti";
import { trackFeature } from "@/lib/track";
import { cityArea } from "@/lib/named-city";
import { saveLastView } from "@/lib/last-view";
import { clearStoredInvite, readStoredInvite } from "@/lib/invito";

const SERIF = "font-[family-name:var(--font-newsreader)]";

// Risposte in corso, conservate sul telefono (decisione 13b del backlog): se al salvataggio
// l'accesso è scaduto si passa dal login e, tornati qui, le risposte sono ancora tutte al loro
// posto. Valgono 2 giorni; si cancellano quando il salvataggio parte o con "Salta".
const DRAFT_KEY = "mapetite.benvenuto";
const DRAFT_TTL_MS = 2 * 24 * 60 * 60 * 1000;

interface Draft {
  step: number;
  cuisines: string[];
  occasions: string[];
  atmospheres: string[];
  priceRange: string | null;
  city: string | null;
  otherCity: string;
  otherOpen: boolean;
  zone: string[];
  su: string[];
  giu: string[];
  visti: string[];
  scoperta: Scoperta | null;
  diete: string[];
}

function readDraftRaw(): string | null {
  try {
    return localStorage.getItem(DRAFT_KEY);
  } catch {
    return null;
  }
}

function saveDraft(d: Draft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...d, ts: Date.now() }));
  } catch { /* archiviazione non disponibile: si va avanti senza */ }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch { /* niente da fare */ }
}

const vuota = (d: Draft) => d.step === 0 && !d.city && !d.otherOpen && !d.zone.length && !d.visti.length && !d.occasions.length && !d.priceRange && !d.diete.length;

// Solo valori che l'onboarding conosce: il contenuto del telefono si ricontrolla come un input.
function parseDraft(raw: string | null): Draft | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object" || typeof o.ts !== "number" || Date.now() - o.ts > DRAFT_TTL_MS) return null;
    const pick = (v: unknown, allowed: readonly { value: string }[]) =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && allowed.some((a) => a.value === x)) : [];
    const city = CITIES.some((c) => c.value === o.city) ? o.city : null;
    const m = pulisciMappa(o, (z) => ZONE.some((x) => x.nome === z && x.citta === city));
    const d: Draft = {
      step: Number.isInteger(o.step) ? Math.min(Math.max(o.step, 0), TOTAL - 1) : 0,
      cuisines: pick(o.cuisines, CUISINES),
      occasions: pick(o.occasions, OCCASIONS),
      atmospheres: pick(o.atmospheres, ATMOSPHERES),
      priceRange: PRICE_RANGES.some((p) => p.value === o.priceRange) ? o.priceRange : null,
      city,
      otherCity: typeof o.otherCity === "string" ? o.otherCity.slice(0, 40) : "",
      otherOpen: o.otherOpen === true,
      zone: m.zone,
      su: m.su,
      giu: m.giu,
      visti: Array.isArray(o.visti) ? o.visti.filter((x: unknown): x is string => typeof x === "string" && TIPI.some((t) => t.id === x)) : [...m.su, ...m.giu],
      scoperta: m.scoperta,
      diete: dieteValide(o.diete),
    };
    return vuota(d) ? null : d;
  } catch {
    return null;
  }
}

// Primo accesso dopo la registrazione: la "mappa del gusto" (sprint 25/10, LORENZO.md).
// Una domanda per schermata, come Albo (collaudo 23/10: il vecchio passo 3 ne aveva quattro insieme):
// città e zone, dieci tipi di posto 👍/👎, famosi o chicche, cosa eviti a tavola, occasioni, spesa,
// poi "Ecco cosa ho capito di te" e subito i posti per te. Tutto saltabile.
// Un solo stile in tutti i passi (mockup A): titolo serif, scelta segnata in teal, tasto principale teal.
const STEPS = [
  { title: "Dove esci di solito?", subtitle: "Città e zone: i consigli partono da lì." },
  { title: "Ti piace o no?", subtitle: "Dieci tipi di posto. Rispondi d'istinto." },
  { title: "Famosi o chicche?", subtitle: "Scegli quello che ti somiglia di più." },
  { title: "Come mangi?", subtitle: "Diete e cose che eviti: le terrò sempre presenti." },
  { title: "Per cosa esci di solito?", subtitle: "Anche più di una risposta." },
  { title: "Quanto spendi di solito?", subtitle: "A persona, per una cena." },
  { title: "Ecco cosa ho capito di te", subtitle: "" },
] as const;
const TOTAL = STEPS.length;
const PASSO_TIPI = 1;
const PASSO_SCOPERTA = 2;
const PASSO_DIETE = 3;
const PASSO_OCCASIONI = 4;
const PASSO_SPESA = 5;
const PASSO_CAPITO = 6;

const CITIES = [
  { value: "Roma", emoji: "🏛️" },
  { value: "Milano", emoji: "🏙️" },
];

// Scelta segnata: lo stesso aspetto per card, pillole e prezzi (collaudo 23/10: erano due stili diversi).
const SCELTA_ON = "border-brand bg-[#e8efee]";
const SCELTA_OFF = "border-border bg-white";
const TASTO = "flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl px-6 font-display text-[17px] font-semibold transition-opacity active:scale-[0.98] disabled:opacity-40";
const TASTO_PIENO = `${TASTO} bg-brand text-white shadow-float hover:opacity-90`;
const TASTO_VUOTO = `${TASTO} border-2 border-brand bg-transparent text-brand`;

function toggle(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

function Chip({
  item,
  selected,
  onToggle,
}: {
  item: { value: string; label: string; emoji: string };
  selected: boolean;
  onToggle: (value: string) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onToggle(item.value)}
      className={`inline-flex min-h-12 items-center gap-2 rounded-pill border-2 px-4 py-1.5 font-display text-[15px] font-semibold text-brand transition-colors ${selected ? SCELTA_ON : SCELTA_OFF}`}
    >
      {item.emoji && <span aria-hidden>{item.emoji}</span>}
      <span>{item.label}</span>
      {selected && <Check size={16} strokeWidth={3} aria-hidden />}
    </button>
  );
}

// Le risposte salvate sul telefono si leggono dopo l'idratazione (sul server non ci sono):
// con una bozza il modulo riparte da lì, senza effetti che rimettono a posto lo stato.
const noSubscribe = () => () => {};
// Risposte già salvate nel profilo (per "Rifalla"): servono da punto di partenza, mai come bozza.
export type DalProfilo = { city: string | null; occasions: string[]; priceRange: string | null; zone: string[]; su: string[]; giu: string[]; scoperta: Scoperta | null; diete: string[]; cuisines?: string[]; atmospheres?: string[] };

export default function OnboardingView({ next = null, dalProfilo = null }: { next?: string | null; dalProfilo?: DalProfilo | null }) {
  const raw = useSyncExternalStore(noSubscribe, readDraftRaw, () => null);
  // La bozza si legge una volta sola, all'apertura: le risposte salvate mentre si risponde non devono
  // far ripartire la schermata con "Ho ritrovato le risposte" (collaudo 23/10: lo vedeva chi entrava la prima volta).
  const client = useSyncExternalStore(noSubscribe, () => true, () => false);
  const [aperta, setAperta] = useState<{ raw: string | null } | null>(null);
  if (client && aperta === null) setAperta({ raw });
  const draft = parseDraft(aperta?.raw ?? null);
  const base: Draft | null = dalProfilo
    ? {
        // Cucine e atmosfere scelte in /me/preferenze: si tengono (prima "Rifalla" le sovrascriveva).
        step: 0, cuisines: dalProfilo.cuisines ?? [], atmospheres: dalProfilo.atmospheres ?? [],
        otherCity: dalProfilo.city && !CITIES.some((c) => c.value === dalProfilo.city) ? dalProfilo.city : "",
        city: CITIES.some((c) => c.value === dalProfilo.city) ? dalProfilo.city : null,
        otherOpen: !!dalProfilo.city && !CITIES.some((c) => c.value === dalProfilo.city),
        occasions: dalProfilo.occasions.filter((o) => OCCASIONS.some((x) => x.value === o)),
        priceRange: PRICE_RANGES.some((x) => x.value === dalProfilo.priceRange) ? dalProfilo.priceRange : null,
        zone: dalProfilo.zone, su: dalProfilo.su, giu: dalProfilo.giu, visti: [...dalProfilo.su, ...dalProfilo.giu],
        scoperta: dalProfilo.scoperta, diete: dalProfilo.diete,
      }
    : null;
  return <Benvenuto key={draft ? "ripreso" : "nuovo"} next={next} initial={draft ?? base} ripreso={draft != null} />;
}

function Benvenuto({ next, initial, ripreso }: { next: string | null; initial: Draft | null; ripreso: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(initial?.step ?? 0);
  const cuisines = initial?.cuisines ?? [];
  const atmospheres = initial?.atmospheres ?? [];
  const [occasions, setOccasions] = useState<string[]>(initial?.occasions ?? []);
  const [priceRange, setPriceRange] = useState<string | null>(initial?.priceRange ?? null);
  const [city, setCity] = useState<string | null>(initial?.city ?? null);
  const [otherCity, setOtherCity] = useState(initial?.otherCity ?? "");
  const [otherOpen, setOtherOpen] = useState(initial?.otherOpen ?? false);
  const [zone, setZone] = useState<string[]>(initial?.zone ?? []);
  const [su, setSu] = useState<string[]>(initial?.su ?? []);
  const [giu, setGiu] = useState<string[]>(initial?.giu ?? []);
  const [visti, setVisti] = useState<string[]>(initial?.visti ?? []);
  const [scoperta, setScoperta] = useState<Scoperta | null>(initial?.scoperta ?? null);
  const [diete, setDiete] = useState<string[]>(initial?.diete ?? []);
  // Il passo più avanti visto: le diete si mandano solo se la persona ha visto la loro domanda
  // (saltandola restano quelle di prima); "famosi o chicche" proposto dai 👍 e visto vale come scelta.
  const [maxVisto, setMaxVisto] = useState(initial?.step ?? 0);
  const [submitting, setSubmitting] = useState<"importa" | "mappa" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Ogni risposta si conserva subito sul telefono (vedi DRAFT_KEY). La prima schermata ancora
  // vuota non lascia niente: chi apre e chiude l'onboarding non si ritrova una bozza vuota.
  const draftNow: Draft = { step, cuisines, occasions, atmospheres, priceRange, city, otherCity, otherOpen, zone, su, giu, visti, scoperta, diete };
  const draftJson = JSON.stringify(draftNow);
  // Le risposte prese dal profilo ("Rifalla") diventano bozza solo quando la persona cambia qualcosa.
  const [partenza] = useState(draftJson);
  useEffect(() => {
    const d = JSON.parse(draftJson) as Draft;
    if (vuota(d) || (!ripreso && draftJson === partenza)) return;
    saveDraft(d);
  }, [draftJson, partenza, ripreso]);

  // Ogni schermata parte dall'alto (prima restava lo scorrimento della precedente: titolo tagliato).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);
  // Aggiornamento durante il render, non in un effetto.
  if (step > maxVisto) setMaxVisto(step);
  // "Ho ritrovato le risposte" solo all'arrivo: tornando al passo ripreso non ricompare (collaudo del 24/10).
  const [lasciato, setLasciato] = useState(false);
  if (!lasciato && step !== (initial?.step ?? 0)) setLasciato(true);
  // "Rifai tutto" chiede conferma: un tocco solo cancellava dieci risposte (collaudo del 24/10).
  const [confermaRifai, setConfermaRifai] = useState(false);
  useEffect(() => {
    if (!confermaRifai) return;
    const t = setTimeout(() => setConfermaRifai(false), 4000);
    return () => clearTimeout(t);
  }, [confermaRifai]);

  // Arrivato da un link d'invito: la registrazione è fatta, il pannello lo conta una volta.
  useEffect(() => {
    const codice = readStoredInvite();
    if (!codice) return;
    trackFeature("invito_registrato", { contesto: codice });
    clearStoredInvite();
  }, []);

  const progress = ((step + 1) / TOTAL) * 100;
  const config = STEPS[step];
  const chosenCity = otherOpen ? otherCity.trim() || null : city;
  const zoneCitta = !otherOpen && city ? ZONE.filter((z) => z.citta === city) : [];
  // Solo le card votate: "Non lo conosco" spingeva verso i famosi (collaudo del 24/10, VISIONE).
  const dedotta = scopertaDedotta(su, [...su, ...giu]);
  const scopertaOra = scoperta ?? dedotta;
  const scopertaVista = maxVisto >= PASSO_SCOPERTA;
  // Lasciando il passo 3 la proposta dei 👍 diventa la scelta: prima si ricalcolava a ogni voto e la frase
  // diceva "giri alla larga dai posti turistici" senza che la persona l'avesse mai vista (collaudo del 24/10).
  const fissaScoperta = () => { if (step === PASSO_SCOPERTA && scoperta == null && dedotta) setScoperta(dedotta); };
  // Il tipo di posto da valutare adesso: quello riaperto dalla frase, se c'è; se no il primo non ancora visto.
  const [riaperta, setRiaperta] = useState<string | null>(null);
  const corrente = (riaperta ? TIPI.find((t) => t.id === riaperta) : null) ?? TIPI.find((t) => !visti.includes(t.id)) ?? null;
  // Card riaperta per cambiarla: si vede cosa avevi risposto (collaudo del 24/10).
  const prima = riaperta ? (su.includes(riaperta) ? "👍" : giu.includes(riaperta) ? "👎" : null) : null;
  // Al server la scelta vista al passo 3, anche se era quella proposta dai 👍 (prima si perdeva).
  const gusto = { v: 1 as const, zone, su, giu, scoperta: scopertaVista ? scopertaOra : scoperta };

  // Arrivati a correggere dalla frase: ogni passo ha "Torna alla frase" (collaudo 23/10: "Continua" portava avanti).
  const [tornaFrase, setTornaFrase] = useState(false);
  const tornaAllaFrase = () => { setTornaFrase(false); setRiaperta(null); setStep(PASSO_CAPITO); };
  // Per i lettori di schermo: l'esito del voto e la card dopo (aria-live, collaudo 23/10).
  const [esito, setEsito] = useState("");
  const vota = (id: string, voto: "su" | "giu" | "boh") => {
    // Rivotando lo stesso tipo resta al suo posto (in testa alla frase), non scivola in fondo dietro "e altri N".
    setSu((p) => (voto === "su" ? (p.includes(id) ? p : [...p, id]) : p.filter((x) => x !== id)));
    setGiu((p) => (voto === "giu" ? (p.includes(id) ? p : [...p, id]) : p.filter((x) => x !== id)));
    const dopo = visti.includes(id) ? visti : [...visti, id];
    setVisti(dopo);
    setEsito(`${voto === "su" ? "Sì" : voto === "giu" ? "No" : "Non lo conosci"}: ${TIPI.find((t) => t.id === id)?.titolo ?? ""}.`);
    // Card riaperta dalla frase: rivotata, si torna sempre alla frase (prima solo se si erano votate tutte e dieci).
    // Riaperta dall'elenco "Fatto: …" del passo stesso: si torna all'elenco.
    if (riaperta === id) { if (tornaFrase) setTimeout(tornaAllaFrase, 250); else setRiaperta(null); return; }
    // Finiti i dieci: si passa da soli alla schermata dopo (o si torna alla frase, se si correggeva da lì).
    if (dopo.length >= TIPI.length) setTimeout(() => (tornaFrase ? tornaAllaFrase() : setStep(PASSO_SCOPERTA)), 250);
  };
  const annullaUltimo = () => {
    const ultimo = visti[visti.length - 1];
    if (!ultimo) return;
    setVisti((p) => p.slice(0, -1));
    setSu((p) => p.filter((x) => x !== ultimo));
    setGiu((p) => p.filter((x) => x !== ultimo));
  };

  const finish = async (dest: "importa" | null) => {
    setSubmitting(dest ?? "mappa");
    setError(null);
    trackFeature(dest === "importa" ? "benvenuto_importa" : "benvenuto_fine", { contesto: `passo_${step + 1}`, tipi: visti.length, chicche: scopertaOra ?? "nessuna" });
    // La bozza si toglie prima: se il salvataggio va a buon fine il server porta altrove e qui
    // non si torna. Se non va (accesso scaduto, rete), si rimette com'era.
    clearDraft();
    // La città scelta diventa il punto di partenza di mappa, assistente e Sorprendimi su questo
    // telefono, anche senza gusti scelti o passando da Importa (18/10: un tester di Milano partiva da Roma).
    const area = chosenCity ? cityArea(chosenCity) : null;
    if (area) saveLastView({ lat: area.lat, lng: area.lng, zoom: 12 });
    let result: Awaited<ReturnType<typeof completeOnboarding>>;
    try {
      result = await completeOnboarding({ cuisines, occasions, atmospheres, priceRange, city: chosenCity, dest, next, gusto, diete: maxVisto >= PASSO_DIETE ? diete : undefined });
    } catch (err) {
      // Il rimando di Next dopo il salvataggio passa di qui come errore: va lasciato andare.
      if (err && typeof err === "object" && "digest" in err && String((err as { digest: unknown }).digest).startsWith("NEXT_")) throw err;
      // Rete caduta (succede in metro): la bozza torna e il pulsante si sblocca.
      saveDraft(draftNow);
      setError("Non sono riuscito a salvare: controlla la connessione e riprova.");
      setSubmitting(null);
      return;
    }
    if (result && "login" in result) {
      saveDraft(draftNow);
      router.push(result.login);
      return;
    }
    if (result?.error) {
      saveDraft(draftNow);
      setError(result.error);
      setSubmitting(null);
    }
  };

  // La scelta "chicche/famosi" che la persona ha visto già segnata al passo 3 e ha lasciato vale come
  // scelta. Una mai mostrata non entra nella sintesi.
  const gustoVisto = { ...gusto, scoperta: scopertaVista ? scopertaOra : scoperta };
  const extra = { citta: chosenCity, priceRange, diete, occasions: OCCASIONS.filter((o) => occasions.includes(o.value)) };
  const righe = capito(gustoVisto, extra);
  const frase = fraseCapito(gustoVisto, extra, 3);
  // Dietro "Altro" solo ciò che la frase non dice già: quello che è nella frase si cambia toccando la parola.
  const nellaFrase = new Set(frase.flat().map((x) => x.k).filter(Boolean) as string[]);
  const righeAltre = righe.filter((r) => !nellaFrase.has(r.chiave));
  const PASSO_DI: Record<string, number> = { zone: 0, su: PASSO_TIPI, giu: PASSO_TIPI, scoperta: PASSO_SCOPERTA, occasioni: PASSO_OCCASIONI, spesa: PASSO_SPESA, diete: PASSO_DIETE };
  // Scorrimento col dito sulla card (come Beli e Tinder): a destra 👍, a sinistra 👎.
  const [drag, setDrag] = useState<{ x0: number; dx: number } | null>(null);
  // "Altro": le righe del profilo che la frase non dice (chiuse: la frase basta).
  const [correggi, setCorreggi] = useState(false);
  // Aperte le righe, si portano in vista dopo il disegno: sopra i tasti in basso, ma mai sotto la barra in alto.
  useEffect(() => {
    if (!correggi) return;
    const el = document.querySelector("[data-testid=capito-righe]");
    const fondo = document.querySelector("[data-testid=benvenuto-fine]")?.closest(".fixed")?.getBoundingClientRect().top ?? window.innerHeight;
    const cima = document.querySelector("[data-testid=benvenuto] > .sticky")?.getBoundingClientRect().bottom ?? 0;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const giu = Math.min(r.bottom + 12 - fondo, r.top - cima - 12);
    if (giu > 0) window.scrollBy({ top: giu, behavior: "smooth" });
  }, [correggi]);
  // Toccando una parola della frase si torna alla domanda che la cambia; poi "Torna alla frase".
  const cambia = (k: string, id?: string) => {
    setTornaFrase(true);
    setEsito("");
    if (id) { setRiaperta(id); setStep(PASSO_TIPI); return; }
    setStep(PASSO_DI[k] ?? 0);
  };
  // Card lasciata andare oltre la soglia: vola fuori dal lato giusto, poi arriva la prossima (come Beli).
  const [via, setVia] = useState<"su" | "giu" | null>(null);

  // Il tasto in basso dei passi a una domanda: "Torna alla frase" se si correggeva da lì, "Continua" con
  // una risposta, "Salta" senza (prima "Continua" e "Salta" insieme facevano la stessa cosa: collaudo 23/10).
  const risposto = step === 0 ? !!chosenCity : step === PASSO_SCOPERTA ? !!scopertaOra : step === PASSO_DIETE ? diete.length > 0 : step === PASSO_OCCASIONI ? occasions.length > 0 : step === PASSO_SPESA ? !!priceRange : true;

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-[#f8f6f2]" data-testid="benvenuto" data-passo={step + 1}>
      {/* Barra di avanzamento (mockup A): freccia, barra teal, "2 di 7". */}
      <div className="sticky top-0 z-10 bg-[#f8f6f2] px-6 pb-2 pt-4">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <button
            type="button"
            onClick={() => { fissaScoperta(); if (tornaFrase) tornaAllaFrase(); else setStep((s) => s - 1); }}
            disabled={step === 0}
            aria-label={tornaFrase ? "Torna alla frase" : "Indietro"}
            className="-ml-2 flex min-h-11 min-w-11 shrink-0 items-center justify-center text-[#141414] disabled:opacity-0"
          >
            <ArrowLeft size={22} aria-hidden />
          </button>
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-pill bg-[#e9e4da]"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={TOTAL}
            aria-valuenow={step + 1}
            aria-label="Avanzamento"
          >
            <div className="h-full rounded-pill bg-brand transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <span className="shrink-0 text-[13px] font-sans tabular-nums text-text-muted" data-testid="benvenuto-passo">
            {step + 1} di {TOTAL}
          </span>
          {/* Solo nella prima schermata e solo prima di aver risposto: "Salta" salta tutto (i gusti si danno
              dopo in "I tuoi gusti"). Tornando qui dalla frase o con la freccia cancellava tutte le risposte
              in un tocco (collaudo del 24/10). Dopo, ogni domanda ha il suo "Salta" in basso. */}
          {step === 0 && !tornaFrase && maxVisto === 0 && !ripreso && (
            <form action={skipOnboarding} className="-mr-2 shrink-0">
              {next && <input type="hidden" name="next" value={next} />}
              <button type="submit" data-testid="onboarding-salta" onClick={clearDraft} className="min-h-11 px-2 text-[15px] font-display font-semibold text-text-muted">
                Salta
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Contenuto */}
      <div className="mx-auto w-full max-w-lg flex-1 px-6 pb-48 pt-3">
        {/* Un solo titolo per tutti i passi (mockup A): serif grande e una riga sotto. */}
        <h1 className={`${SERIF} mb-1.5 text-balance text-[34px] font-medium leading-[1.06] tracking-[-0.02em] text-[#141414] min-[380px]:text-[38px]`}>
          {step === PASSO_CAPITO && frase.length === 0 ? "Partiamo da zero" : config.title}
        </h1>
        {config.subtitle && (
          <p className="mb-5 text-[15px] font-sans text-text-muted [@media(max-height:700px)]:mb-3">
            {step === PASSO_SCOPERTA && !scoperta && dedotta ? "L'ho scelto dai tuoi 👍: cambialo se non è così." : config.subtitle}
          </p>
        )}
        {step === PASSO_CAPITO && <div className="mb-4 min-[380px]:mb-5" />}
        {/* Non sulla card dei tipi né sulla frase finale: toglieva spazio e copriva i tasti a 360px (collaudo 23/10). */}
        {ripreso && !lasciato && step === initial?.step && step !== PASSO_TIPI && step < PASSO_CAPITO && (
          <p data-testid="benvenuto-ripreso" role="status" className="-mt-2 mb-5 rounded-btn bg-[#e8efee] px-3 py-2 text-sm font-sans text-brand">
            Ho ritrovato le risposte che avevi già dato: puoi continuare da qui.
          </p>
        )}

        {step === 0 && (
          <div className="flex flex-col gap-3" data-testid="benvenuto-citta">
            {CITIES.map((c) => {
              const on = !otherOpen && city === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setOtherOpen(false);
                    setCity(on ? null : c.value);
                    setZone([]);
                  }}
                  className={`flex min-h-16 w-full items-center gap-4 rounded-card border-2 px-4 text-left transition-colors ${on ? SCELTA_ON : SCELTA_OFF}`}
                >
                  <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-2xl">{c.emoji}</span>
                  <span className="flex-1 font-display text-lg font-semibold text-brand">{c.value}</span>
                  {on && <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-white"><Check size={14} strokeWidth={3} /></span>}
                </button>
              );
            })}
            <div className={`rounded-card border-2 px-4 py-2.5 transition-colors ${otherOpen ? SCELTA_ON : SCELTA_OFF}`}>
              <button
                type="button"
                aria-pressed={otherOpen}
                onClick={() => { setOtherOpen((o) => !o); setZone([]); }}
                className="flex min-h-11 w-full items-center gap-4 text-left"
              >
                <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-2xl">📍</span>
                <span className="flex-1 font-display text-lg font-semibold text-brand">Un&apos;altra città</span>
                {otherOpen && <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-white"><Check size={14} strokeWidth={3} /></span>}
              </button>
              {otherOpen && (
                <input
                  autoFocus
                  value={otherCity}
                  onChange={(e) => setOtherCity(e.target.value)}
                  maxLength={40}
                  placeholder="es. Torino"
                  aria-label="La tua città"
                  data-testid="benvenuto-altra-citta"
                  className="mt-3 w-full rounded-btn border border-border bg-white px-3 py-2.5 text-base focus:border-brand focus:outline-none"
                />
              )}
            </div>
            {zoneCitta.length > 0 && (
              <div data-testid="benvenuto-zone" className="mt-2">
                <p className="mb-2.5 text-[15px] font-sans text-text-muted">Le tue zone, fino a 3 <span className="text-text-muted/80">(facoltativo)</span></p>
                <div className="flex flex-wrap gap-2">
                  {zoneCitta.map((z) => (
                    <Chip
                      key={z.nome}
                      item={{ value: z.nome, label: z.nome, emoji: "" }}
                      selected={zone.includes(z.nome)}
                      onToggle={(v) => setZone((p) => (p.includes(v) ? p.filter((x) => x !== v) : p.length >= 3 ? p : [...p, v]))}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === PASSO_TIPI && (
          <div data-testid="benvenuto-tipi">
            {corrente ? (
              <>
                {/* La pila (mockup A): le prossime due card si intravedono dietro, un po' ruotate. */}
                <div className="relative">
                {!riaperta && TIPI.filter((t) => !visti.includes(t.id) && t.id !== corrente.id).slice(0, 2).map((t, i) => (
                  <div
                    key={t.id}
                    aria-hidden
                    className="absolute inset-0 rounded-[1.75rem] shadow-card"
                    style={{ background: `linear-gradient(160deg, ${t.sfondo})`, transform: i === 0 ? "rotate(4deg) translate(10px, 6px)" : "rotate(-4deg) translate(-10px, 8px)", opacity: 0.9 }}
                  />
                ))}
                <div
                  data-testid="tipo-card"
                  key={corrente.id}
                  onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); setDrag({ x0: e.clientX, dx: 0 }); }}
                  onPointerMove={(e) => drag && setDrag({ ...drag, dx: e.clientX - drag.x0 })}
                  onPointerUp={() => {
                    if (drag && Math.abs(drag.dx) > 90 && !via) {
                      const dir = drag.dx > 0 ? "su" : "giu";
                      setVia(dir);
                      window.setTimeout(() => { setVia(null); vota(corrente.id, dir); }, 180);
                    }
                    setDrag(null);
                  }}
                  onPointerCancel={() => setDrag(null)}
                  // Alta quasi metà schermo anche sui telefoni bassi: a 360×740 più bassa l'emoji finiva sul contatore.
                  className="relative flex h-[clamp(15rem,44svh,23rem)] touch-pan-y select-none flex-col justify-end overflow-hidden rounded-[1.75rem] p-6 text-white shadow-float"
                  style={{
                    background: `linear-gradient(160deg, ${corrente.sfondo})`,
                    transform: via ? `translateX(${via === "su" ? 130 : -130}%) rotate(${via === "su" ? 14 : -14}deg)` : drag ? `translateX(${drag.dx}px) rotate(${drag.dx / 25}deg)` : undefined,
                    transition: drag ? "none" : "transform 180ms ease-in",
                  }}
                >
                  {drag && Math.abs(drag.dx) > 30 && (
                    // Dal lato opposto alla direzione (come Tinder): spostando a destra non esce dallo schermo (collaudo 23/10).
                    <span aria-hidden data-testid="tipo-cartellino" className={`absolute top-4 z-20 rounded-pill px-3 py-1 font-display text-sm font-bold ${drag.dx > 0 ? "left-4 bg-accent" : "right-4 bg-black/50"}`}>
                      {drag.dx > 0 ? "👍 Sì" : "👎 No"}
                    </span>
                  )}
                  {/* Contatore dei tipi dentro la card; riaperta dalla frase dice "Cambia" (prima "10 di 10": collaudo 23/10). */}
                  <span data-testid="tipi-contatore" className={`absolute left-5 top-5 z-10 rounded-pill ${drag && Math.abs(drag.dx) > 30 ? "opacity-0" : ""} bg-black/30 px-2.5 py-0.5 font-display text-xs font-semibold`}>{riaperta ? `Cambia la risposta${prima ? ` · prima ${prima}` : ""}` : `${visti.length + 1} di ${TIPI.length}`}</span>
                  {/* Luci calde sfocate e l'emoji al centro, come nel mockup: niente foto inventate. */}
                  <span aria-hidden className="pointer-events-none absolute left-6 top-10 h-20 w-20 rounded-full bg-[#ffd9a0]/35 blur-2xl" />
                  <span aria-hidden className="pointer-events-none absolute right-8 top-6 h-16 w-16 rounded-full bg-[#ffd9a0]/30 blur-2xl" />
                  <span aria-hidden className="relative flex min-h-0 flex-1 items-center justify-center pb-2 text-[4.25rem] leading-none drop-shadow-lg min-[380px]:text-[5.5rem]">{corrente.emoji}</span>
                  <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/45 to-transparent" />
                  <span className="relative mb-2.5 inline-flex w-fit items-center gap-1.5 rounded-pill bg-white/85 px-3 py-1 font-display text-[13px] font-semibold text-[#141414]">
                    {corrente.famoso ? "Molto noto" : <><span className="text-accent" aria-hidden>✦</span> Chicca di quartiere</>}
                  </span>
                  <h2 className={`${SERIF} relative text-[30px] font-medium leading-[1.08]`}>{corrente.titolo}</h2>
                  <p className="relative mt-1.5 text-sm font-sans text-white/90">{corrente.riga}</p>
                </div>
                </div>
                {/* Tasti tondi grandi (mockup A): 👎 bianco, 👍 corallo, "Non lo conosco" in mezzo. */}
                <div className="mt-8 flex items-center justify-between px-3 [@media(max-height:760px)]:mt-6">
                  <button type="button" data-testid="tipo-giu" aria-label={`No, ${corrente.titolo}`} onClick={() => vota(corrente.id, "giu")} className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border border-border bg-white text-[2rem] shadow-card active:scale-95">
                    <span aria-hidden>👎</span>
                  </button>
                  <button type="button" data-testid="tipo-boh" onClick={() => vota(corrente.id, "boh")} className="min-h-11 max-w-[7rem] px-2 text-center text-[15px] font-sans leading-snug text-text-muted">
                    Non lo conosco
                  </button>
                  <button type="button" data-testid="tipo-su" aria-label={`Sì, ${corrente.titolo}`} onClick={() => vota(corrente.id, "su")} className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-accent text-[2rem] shadow-[0_10px_28px_rgba(255,107,74,0.45)] active:scale-95">
                    <span aria-hidden>👍</span>
                  </button>
                </div>
                <p aria-hidden className="mt-2 text-center text-xs font-sans text-text-muted [@media(max-height:760px)]:hidden">← trascina la card, oppure tocca →</p>
                <p className="sr-only" aria-live="polite" data-testid="tipi-esito">{esito} {riaperta ? "Cambia la risposta" : `${visti.length + 1} di ${TIPI.length}`}: {corrente.titolo}.</p>
              </>
            ) : (
              <div data-testid="tipi-finiti">
                {/* Stesso stile dei titoli e delle scelte degli altri passi (collaudo del 24/10: sembrava un avviso). */}
                <p className="font-display text-lg font-semibold text-brand">
                  {su.length === 0 ? "Nessuno ti piace" : `${su.length} ${su.length === 1 ? "ti piace" : "ti piacciono"}`}, {giu.length} no
                </p>
                <p className="mt-0.5 text-[15px] font-sans text-text-muted">Tocca un posto per cambiare la risposta.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {TIPI.map((t) => (
                    <button key={t.id} type="button" data-testid="tipo-riapri" onClick={() => { setEsito(""); setRiaperta(t.id); }} aria-label={`Cambia: ${t.titolo}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-pill border-2 border-border bg-white px-3 text-sm font-sans text-text">
                      <span aria-hidden>{t.emoji}</span> {t.titolo} <span aria-hidden>{su.includes(t.id) ? "👍" : giu.includes(t.id) ? "👎" : "·"}</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  data-testid="tipi-rifai"
                  onClick={() => { if (!confermaRifai) { setConfermaRifai(true); return; } setConfermaRifai(false); setVisti([]); setSu([]); setGiu([]); }}
                  className={`mt-4 flex min-h-11 items-center px-1 font-display text-[15px] font-semibold ${confermaRifai ? "text-accent" : "text-text-muted"}`}
                >
                  {confermaRifai ? "Sicuro? Tocca ancora per ricominciare" : "↺ Rifai tutti e dieci"}
                </button>
              </div>
            )}
          </div>
        )}

        {step === PASSO_SCOPERTA && (
          <div className="flex flex-col gap-3" role="radiogroup" aria-label="Famosi o chicche?" data-testid="benvenuto-scoperta">
            {SCOPERTE.map((sc) => {
              const on = scopertaOra === sc.value;
              return (
                <button
                  key={sc.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setScoperta(sc.value)}
                  className={`flex min-h-[4.5rem] w-full items-center gap-4 rounded-card border-2 px-4 py-3 text-left transition-colors ${on ? SCELTA_ON : SCELTA_OFF}`}
                >
                  <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-2xl">{sc.value === "chicche" ? "💎" : sc.value === "famosi" ? "⭐" : "🍽️"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-lg font-semibold text-brand">{sc.label}</span>
                    <span className="block text-sm font-sans text-text-muted">{sc.riga}</span>
                  </span>
                  {on && <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-white"><Check size={14} strokeWidth={3} /></span>}
                </button>
              );
            })}
          </div>
        )}

        {step === PASSO_DIETE && (
          <div className="flex flex-wrap gap-2" data-testid="benvenuto-diete">
            {DIETE.map((d) => (
              <Chip key={d.id} item={{ value: d.id, label: d.label, emoji: d.emoji }} selected={diete.includes(d.id)} onToggle={(v) => setDiete((p) => toggle(p, v))} />
            ))}
          </div>
        )}

        {step === PASSO_OCCASIONI && (
          <div className="flex flex-wrap gap-2" data-testid="benvenuto-occasioni">
            {OCCASIONS.map((item) => (
              <Chip key={item.value} item={item} selected={occasions.includes(item.value)} onToggle={(v) => setOccasions((p) => toggle(p, v))} />
            ))}
          </div>
        )}

        {step === PASSO_SPESA && (
          <div className="grid grid-cols-2 gap-3" data-testid="benvenuto-spesa">
            {PRICE_RANGES.map((item) => {
              const on = priceRange === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPriceRange(on ? null : item.value)}
                  className={`relative flex min-h-20 flex-col items-center justify-center rounded-card border-2 px-2 py-2 transition-colors ${on ? SCELTA_ON : SCELTA_OFF}`}
                >
                  <span className="font-display text-xl font-bold text-brand">{item.value}</span>
                  <span className="text-sm font-sans text-text-muted">{item.description}</span>
                  {on && <span aria-hidden className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white"><Check size={12} strokeWidth={3} /></span>}
                </button>
              );
            })}
          </div>
        )}

        {step === PASSO_CAPITO && (
          <div data-testid="benvenuto-capito">
            {frase.length > 0 ? (
              <>
                {/* La frase da amico: solo ciò che hai scelto, parole chiave sottolineate in corallo.
                    Toccarne una porta alla domanda che la cambia. */}
                <p data-testid="capito-frase" className={`${SERIF} text-[21px] leading-[1.42] text-[#141414] min-[380px]:text-[24px]`}>
                  {frase.map((f, i) => (
                    <span key={i}>
                      {i > 0 && " "}
                      {f.map((x, j) => x.k ? (
                        <span
                          key={j}
                          role="button"
                          tabIndex={0}
                          data-testid="capito-parola"
                          aria-label={`${x.t}: cambia`}
                          onClick={() => cambia(x.k!, x.id)}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); cambia(x.k!, x.id); } }}
                          // Uno span, non un <button>: il bottone non va a capo dentro la riga e spezzava la frase.
                          // Area di tocco invisibile più alta della riga (≥ 44px, collaudo 23/10): la parola resta com'è.
                          className="relative cursor-pointer after:absolute after:inset-x-0 after:-inset-y-3 after:content-[''] bg-[linear-gradient(transparent_62%,rgba(255,107,74,0.28)_62%)] [-webkit-box-decoration-break:clone] [box-decoration-break:clone]"
                        >
                          {x.t}
                        </span>
                      ) : <span key={j}>{x.t}</span>)}
                    </span>
                  ))}
                </p>
                <p className="mt-6 text-[15px] font-sans text-text-muted [@media(max-height:700px)]:mt-3">Non è così? Tocca una parola per cambiarla.</p>
                {righeAltre.length > 0 && (
                  <button type="button" data-testid="capito-correggi" aria-expanded={correggi} onClick={() => setCorreggi((v) => !v)} className="-ml-1 mt-1 flex min-h-11 items-center gap-1 px-1 text-left text-[15px] font-display font-semibold text-brand">
                    Il resto del profilo
                    <ChevronRight size={16} aria-hidden className={`shrink-0 transition-transform ${correggi ? "rotate-90" : ""}`} />
                  </button>
                )}
              </>
            ) : (
              <p data-testid="capito-vuoto" className={`${SERIF} text-[21px] leading-[1.42] text-[#141414] min-[380px]:text-[24px]`}>
                Non mi hai detto ancora niente: imparo da quello che salvi e cerchi. Puoi rifarla quando vuoi da &quot;I tuoi gusti&quot;.
              </p>
            )}
            {/* Le righe da correggere una per una: un tocco più in là, dietro "Altro". */}
            {correggi && righeAltre.length > 0 && (
              <ul data-testid="capito-righe" className="mt-1 overflow-hidden rounded-card border border-border bg-white shadow-card">
                {righeAltre.map((r, i) => (
                  <li key={r.chiave} className={i > 0 ? "border-t border-border" : ""}>
                    <button type="button" data-testid="capito-riga" onClick={() => cambia(r.chiave)} className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-surface">
                      <span aria-hidden className="text-xl">{r.emoji}</span>
                      <span className="min-w-0 flex-1 text-[15px] font-sans leading-snug text-text">{r.testo}</span>
                      <ChevronRight aria-label="Cambia" size={18} className="shrink-0 text-text-muted" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {/* Senza risposte non c'è niente di cui "tenere conto": la frase si contraddiceva (collaudo 23/10). */}
            {frase.length > 0 && (
              <p className="mt-4 text-xs font-sans text-text-muted">Da ora ricerca, verdetti e ordine dei risultati tengono conto di questo.</p>
            )}
          </div>
        )}
      </div>

      {/* Pulsanti in basso, fissi sul fondo dello schermo (primo accesso a schermo intero, senza la barra dell'app). */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#f8f6f2]/95 px-6 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto max-w-lg">
          {step === PASSO_TIPI ? (
            // "Torna al precedente" qui sotto e non sotto i tasti: a 360×740 finiva mezzo coperto (collaudo 23/10).
            // Con una card riaperta dalla frase non c'è: annullava un'altra card.
            <div className="flex items-center justify-between gap-3">
              {visti.length > 0 && !riaperta && corrente ? (
                <button type="button" data-testid="tipo-indietro" onClick={annullaUltimo} className="flex min-h-12 items-center whitespace-nowrap px-1 font-display text-[15px] font-semibold text-text-muted">
                  ↶ Precedente
                </button>
              ) : <span />}
              {tornaFrase ? (
                <button type="button" data-testid="torna-frase" onClick={tornaAllaFrase} className="flex min-h-12 items-center gap-1 px-1 font-display text-[15px] font-semibold text-brand">
                  Torna alla frase <ArrowRight size={16} aria-hidden />
                </button>
              ) : (
                <button type="button" data-testid="tipi-basta" onClick={() => setStep(PASSO_SCOPERTA)} className="flex min-h-12 items-center gap-1 whitespace-nowrap px-1 font-display text-[15px] font-semibold text-brand">
                  {corrente ? "Basta così" : "Continua"} <ArrowRight size={16} aria-hidden />
                </button>
              )}
            </div>
          ) : step < PASSO_CAPITO ? (
            <button
              type="button"
              data-testid={tornaFrase ? "torna-frase" : "benvenuto-avanti"}
              onClick={() => { fissaScoperta(); if (tornaFrase) tornaAllaFrase(); else setStep((s) => s + 1); }}
              disabled={step === 0 && !risposto}
              className={risposto || step === 0 || step === PASSO_DIETE || tornaFrase ? TASTO_PIENO : TASTO_VUOTO}
            >
              {/* "Come mangi?" senza scelte è una risposta: "Mangio di tutto", non "Salta". */}
              {tornaFrase ? "Torna alla frase" : risposto || step === 0 ? "Continua" : step === PASSO_DIETE ? "Mangio di tutto" : "Salta"}
            </button>
          ) : (
            <>
              <button type="button" data-testid="benvenuto-fine" onClick={() => finish(null)} disabled={!!submitting} className={TASTO_PIENO}>
                {/* Mockup A: "Apri la mia mappa →" (la mappa parte già sui posti per te). */}
                {submitting === "mappa" ? (next ? "Salvo i tuoi gusti…" : "Cerco i posti per te…") : next ? "Salva e continua" : <>Apri la mia mappa <ArrowRight size={18} aria-hidden /></>}
              </button>
              {/* I posti già salvati altrove (Google Maps, il link di un reel): dopo la sintesi, non al posto suo. */}
              <button
                type="button"
                data-testid="benvenuto-importa-si"
                onClick={() => finish("importa")}
                disabled={!!submitting}
                className="mt-1 flex min-h-11 w-full items-center justify-center font-display text-[15px] font-semibold text-brand disabled:opacity-60"
              >
                {submitting === "importa" ? "Un attimo…" : "Prima porta qui i tuoi posti salvati"}
              </button>
            </>
          )}
          {error && <p className="mt-3 text-center text-sm text-error">{error}</p>}
        </div>
      </div>
    </div>
  );
}
