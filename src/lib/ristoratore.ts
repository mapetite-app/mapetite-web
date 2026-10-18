// Numeri del pannello del ristoratore (/ristoratore/[id], PIANO-25-OTTOBRE.md 8.2): tutto
// calcolato dagli eventi della tabella `events` e dai salvataggi, SEMPRE aggregati. Mai dati
// personali, mai singoli utenti: i conteggi di persone sotto SOGLIA si mostrano come "meno di 3".
// Solo funzioni pure e nessun import, così il giro automatico le prova anche senza server.

export const SOGLIA = 3;

export type RistEvento = {
  created_at: string;
  type: string;
  user_id: string | null;
  anon_id: string | null;
  session_id?: string | null;
  place_id: string | null;
  google_place_id: string | null;
  lat?: number | null;
  lng?: number | null;
  props: Record<string, unknown> | null;
};

export type RistLocale = {
  id: string;
  name: string;
  address: string | null;
  category: string | null;
  lat: number;
  lng: number;
  google_place_id: string | null;
};

export type RistSalvataggio = { place_id: string; user_id: string; created_at: string; tags: string[] | null };

export type Voce = { chiave: string; volte: number; persone: number };
export type Azione = { tipo: AzioneTipo; etichetta: string; persone: number; volte: number; prima: number };
export type GiornoRist = { giorno: string; viste: number; salvati: number };
// Trend di zona (piano 8.4): per ogni fascia oraria, quante persone hanno cercato e le richieste più frequenti.
export type TrendFascia = { fascia: (typeof FASCE)[number]; persone: number; richieste: Voce[] };

export type PannelloRistoratore = {
  giorni: number;
  azioni: Azione[];
  perGiorno: GiornoRist[];
  // Ricerche da cui le persone hanno aperto la scheda del locale (stessa visita, poco prima).
  daRicerca: { ricerche: number; persone: number; tipi: Voce[]; richieste: Voce[]; zone: Voce[] };
  // Ricerche fatte nella zona del locale (città nella richiesta, "vicino a me" o locali aperti a meno di 2 km).
  zona: { nome: string | null; ricerche: number; persone: number; tipi: Voce[]; richieste: Voce[]; fasce: Voce[]; trend: TrendFascia[] };
  confronto: { simili: number; mediaViste: number | null; mediaSalvati: number | null; viste: number; salvati: number };
  pochiDati: boolean;
  // Domanda latente (docs/autonomia/POSIZIONAMENTO.md, proposta 2): chi ha salvato il locale, da sempre,
  // e non ci è ancora stato; occasioni = le raccolte in cui l'ha messo. Solo nel pannello: non cambia
  // mai l'ordine dei risultati (VISIONE: niente premi alla popolarità).
  inAttesa: { persone: number; occasioni: Voce[] };
};

export const AZIONI = [
  { tipo: "apri_scheda", etichetta: "Hanno visto la scheda" },
  { tipo: "salva", etichetta: "L'hanno salvato" },
  { tipo: "ci_sono_stato", etichetta: "Ci sono stati" },
  { tipo: "percorso", etichetta: "Hanno chiesto il percorso" },
  { tipo: "chiama", etichetta: "Hanno chiamato" },
  { tipo: "sito", etichetta: "Hanno aperto il sito" },
] as const;
export type AzioneTipo = (typeof AZIONI)[number]["tipo"];

export const FASCE = ["mattina", "pranzo", "pomeriggio", "aperitivo", "cena", "notte"] as const;

// Persone sotto soglia: mai il numero esatto (1 o 2 persone si riconoscono).
export function mostraPersone(n: number): string {
  if (n <= 0) return "0";
  if (n < SOGLIA) return `meno di ${SOGLIA}`;
  return n.toLocaleString("it-IT");
}

const DAY = 86_400_000;
const STATO_VISITATO = "Già visitato";
const romeDay = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" });
const romeHour = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", hourCycle: "h23" });
const dayKey = (t: number | string): string => romeDay.format(new Date(t));
const dayIndex = (key: string) => Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)) / DAY;
const keyOfIndex = (i: number) => new Date(i * DAY).toISOString().slice(0, 10);

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

function fascia(t: string): (typeof FASCE)[number] {
  const h = Number(romeHour.format(new Date(t)));
  if (h >= 6 && h < 11) return "mattina";
  if (h >= 11 && h < 15) return "pranzo";
  if (h >= 15 && h < 18) return "pomeriggio";
  if (h >= 18 && h < 20) return "aperitivo";
  if (h >= 20 && h < 23) return "cena";
  return "notte";
}

function km(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = Math.PI / 180;
  const x = (bLng - aLng) * r * Math.cos(((aLat + bLat) / 2) * r);
  const y = (bLat - aLat) * r;
  return Math.sqrt(x * x + y * y) * 6371;
}

function tally() {
  const m = new Map<string, { volte: number; persone: Set<string> }>();
  return {
    add(k: string, actor: string | null) {
      const e = m.get(k) ?? { volte: 0, persone: new Set<string>() };
      e.volte++;
      if (actor) e.persone.add(actor);
      m.set(k, e);
    },
    list: (): Voce[] => [...m].map(([chiave, e]) => ({ chiave, volte: e.volte, persone: e.persone.size })).sort((a, b) => b.persone - a.persone || b.volte - a.volte || a.chiave.localeCompare(b.chiave)),
  };
}

// Cosa ha chiesto una ricerca, senza la frase scritta (già così nei dati): requisiti,
// caratteristiche e occasione, in minuscolo e senza doppioni.
function richiesteDi(p: Record<string, unknown>): string[] {
  const out = new Set<string>();
  for (const k of ["requisiti", "caratteristiche"]) {
    const v = p[k];
    if (Array.isArray(v)) for (const x of v) { const s = str(x); if (s) out.add(s.toLowerCase()); }
  }
  const occ = str(p.occasione);
  if (occ) out.add(occ.toLowerCase());
  return [...out];
}

export function computeRistoratore(
  input: { locale: RistLocale; citta: string | null; simili: RistLocale[]; eventi: RistEvento[]; salvati: RistSalvataggio[]; attesa?: RistSalvataggio[] },
  giorni: number,
  now: number = Date.now(),
): PannelloRistoratore {
  const { locale, citta, simili, eventi, salvati } = input;
  const anonToUser = new Map<string, string>();
  for (const r of eventi) if (r.user_id && r.anon_id) anonToUser.set(r.anon_id, r.user_id);
  const actorOf = (r: { user_id: string | null; anon_id: string | null }): string | null => {
    const u = r.user_id ?? (r.anon_id ? anonToUser.get(r.anon_id) : undefined);
    if (u) return `u:${u}`;
    return r.anon_id ? `a:${r.anon_id}` : null;
  };

  const today = dayIndex(dayKey(now));
  const start = today - giorni + 1;
  const prevStart = start - giorni;
  const ev = eventi.map((r) => ({ r, actor: actorOf(r), day: dayIndex(dayKey(r.created_at)), t: Date.parse(r.created_at) }));
  const sv = salvati.map((s) => ({ s, actor: `u:${s.user_id}`, day: dayIndex(dayKey(s.created_at)) }));

  // Un evento appartiene a un locale per UUID o per Place ID Google (le schede dai risultati
  // della ricerca hanno spesso solo il secondo).
  const byGoogle = new Map<string, string>();
  for (const p of [locale, ...simili]) if (p.google_place_id) byGoogle.set(p.google_place_id, p.id);
  const placeOf = (r: RistEvento): string | null => r.place_id ?? (r.google_place_id ? byGoogle.get(r.google_place_id) ?? null : null);

  const evPerLocale = new Map<string, typeof ev>();
  for (const e of ev) {
    const id = placeOf(e.r);
    if (id) (evPerLocale.get(id) ?? evPerLocale.set(id, []).get(id)!).push(e);
  }
  const svPerLocale = new Map<string, typeof sv>();
  for (const x of sv) (svPerLocale.get(x.s.place_id) ?? svPerLocale.set(x.s.place_id, []).get(x.s.place_id)!).push(x);

  // Persone per azione e locale in un intervallo di giorni.
  function persone(placeId: string, tipo: AzioneTipo, from: number, to: number): { persone: Set<string>; volte: number } {
    const set = new Set<string>();
    let volte = 0;
    for (const e of evPerLocale.get(placeId) ?? []) {
      if (e.r.type !== tipo || e.day < from || e.day > to) continue;
      volte++;
      if (e.actor) set.add(e.actor);
    }
    // I salvataggi veri (saved_places) contano anche se il segnale non è arrivato.
    if (tipo === "salva" || tipo === "ci_sono_stato") {
      for (const x of svPerLocale.get(placeId) ?? []) {
        if (x.day < from || x.day > to) continue;
        if (tipo === "ci_sono_stato" && !(x.s.tags ?? []).includes(STATO_VISITATO)) continue;
        if (!set.has(x.actor)) { set.add(x.actor); volte++; }
      }
    }
    return { persone: set, volte };
  }

  const azioni: Azione[] = AZIONI.map(({ tipo, etichetta }) => {
    const cur = persone(locale.id, tipo, start, today);
    const prev = persone(locale.id, tipo, prevStart, start - 1);
    return { tipo, etichetta, persone: cur.persone.size, volte: cur.volte, prima: prev.persone.size };
  });

  const perGiorno: GiornoRist[] = [];
  for (let d = start; d <= today; d++) {
    perGiorno.push({ giorno: keyOfIndex(d), viste: persone(locale.id, "apri_scheda", d, d).persone.size, salvati: persone(locale.id, "salva", d, d).persone.size });
  }

  // Ricerche nel periodo (le più vecchie servono solo come contesto delle prime aperture).
  const ricerche = ev.filter((e) => e.r.type === "ricerca").sort((a, b) => a.t - b.t);

  // "Come ti trovano": per ogni scheda aperta dai risultati, la ricerca della stessa visita
  // (o della stessa persona) nei 30 minuti prima.
  const linked = new Set<number>();
  const dr = { tipi: tally(), richieste: tally(), zone: tally(), persone: new Set<string>() };
  for (const e of ev) {
    if (e.r.type !== "apri_scheda" || e.day < start || e.day > today || placeOf(e.r) !== locale.id) continue;
    if (e.r.props?.fonte !== "ricerca") continue;
    let found = -1;
    for (let i = ricerche.length - 1; i >= 0; i--) {
      const q = ricerche[i];
      if (q.t > e.t) continue;
      if (e.t - q.t > 30 * 60_000) break;
      const same = e.r.session_id && q.r.session_id ? e.r.session_id === q.r.session_id : !!e.actor && e.actor === q.actor;
      if (same) { found = i; break; }
    }
    if (found < 0 || linked.has(found)) continue;
    linked.add(found);
    const q = ricerche[found];
    const p = q.r.props ?? {};
    dr.tipi.add(str(p.tipo) ?? "qualsiasi locale", q.actor);
    for (const k of richiesteDi(p)) dr.richieste.add(k, q.actor);
    dr.zone.add(str(p.zona) ?? (p.vicino_a_me ? "vicino a me" : "non indicata"), q.actor);
    if (q.actor) dr.persone.add(q.actor);
  }

  // Ricerche nella zona del locale.
  const cittaN = citta ? norm(citta) : null;
  const indirizzoN = locale.address ? norm(locale.address) : "";
  const vicini = new Set<string>();
  for (const e of ev) {
    if (e.r.type !== "apri_scheda" || !e.r.session_id) continue;
    const lat = typeof e.r.lat === "number" ? e.r.lat : Number(e.r.lat);
    const lng = typeof e.r.lng === "number" ? e.r.lng : Number(e.r.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng) && e.r.lat != null && km(lat, lng, locale.lat, locale.lng) <= 2) vicini.add(e.r.session_id);
  }
  const zn = { tipi: tally(), richieste: tally(), fasce: tally(), persone: new Set<string>(), n: 0 };
  const perFascia = new Map<string, ReturnType<typeof tally>>();
  for (const q of ricerche) {
    if (q.day < start || q.day > today) continue;
    const p = q.r.props ?? {};
    const zona = str(p.zona);
    const zonaN = zona ? norm(zona) : null;
    const lat = q.r.lat == null ? NaN : Number(q.r.lat);
    const lng = q.r.lng == null ? NaN : Number(q.r.lng);
    const inZona =
      (zonaN != null && ((cittaN != null && zonaN === cittaN) || (zonaN.length >= 4 && indirizzoN.includes(zonaN)))) ||
      (zonaN == null && !!p.vicino_a_me && Number.isFinite(lat) && Number.isFinite(lng) && km(lat, lng, locale.lat, locale.lng) <= 2) ||
      (!!q.r.session_id && vicini.has(q.r.session_id));
    if (!inZona) continue;
    zn.n++;
    zn.tipi.add(str(p.tipo) ?? "qualsiasi locale", q.actor);
    for (const k of richiesteDi(p)) zn.richieste.add(k, q.actor);
    const fq = fascia(q.r.created_at);
    zn.fasce.add(fq, q.actor);
    const tf = perFascia.get(fq) ?? perFascia.set(fq, tally()).get(fq)!;
    for (const k of richiesteDi(p)) tf.add(k, q.actor);
    if (q.actor) zn.persone.add(q.actor);
  }
  const fasce = zn.fasce.list();
  const fasceOrdinate: Voce[] = FASCE.map((f) => fasce.find((x) => x.chiave === f) ?? { chiave: f, volte: 0, persone: 0 });
  const trend: TrendFascia[] = fasceOrdinate.map((f) => ({ fascia: f.chiave as (typeof FASCE)[number], persone: f.persone, richieste: (perFascia.get(f.chiave)?.list() ?? []).slice(0, 3) }));

  // Confronto con i locali della stessa categoria nella stessa città (media, mai il singolo:
  // sotto i 3 locali simili non si mostra).
  const altri = simili.filter((p) => p.id !== locale.id);
  const media = (tipo: AzioneTipo) =>
    altri.length >= SOGLIA ? Math.round((altri.reduce((s, p) => s + persone(p.id, tipo, start, today).persone.size, 0) / altri.length) * 10) / 10 : null;
  const viste = azioni.find((a) => a.tipo === "apri_scheda")!.persone;
  const salvatiN = azioni.find((a) => a.tipo === "salva")!.persone;

  return {
    giorni,
    azioni,
    perGiorno,
    daRicerca: { ricerche: linked.size, persone: dr.persone.size, tipi: dr.tipi.list(), richieste: dr.richieste.list(), zone: dr.zone.list() },
    zona: { nome: citta, ricerche: zn.n, persone: zn.persone.size, tipi: zn.tipi.list(), richieste: zn.richieste.list(), fasce: fasceOrdinate, trend },
    confronto: { simili: altri.length, mediaViste: media("apri_scheda"), mediaSalvati: media("salva"), viste, salvati: salvatiN },
    pochiDati: viste < SOGLIA,
    inAttesa: inAttesa(input.attesa ?? [], locale.id),
  };
}

// Stati e voti del salvataggio: non sono occasioni.
const STATI = new Set(["Da provare", STATO_VISITATO]);
export function inAttesa(rows: RistSalvataggio[], placeId: string): { persone: number; occasioni: Voce[] } {
  const chi = new Set<string>();
  const occ = tally();
  for (const r of rows) {
    const tags = r.tags ?? [];
    if (r.place_id !== placeId || tags.includes(STATO_VISITATO)) continue;
    chi.add(r.user_id);
    for (const t of tags) if (!STATI.has(t) && !/^(👍|👎)/u.test(t)) occ.add(t, r.user_id);
  }
  return { persone: chi.size, occasioni: occ.list().slice(0, 4) };
}

// Esempio DICHIARATO del trend di zona, quando i dati veri della zona sono ancora pochi: la
// pagina lo etichetta sempre "Esempio". Mai mescolato con i numeri veri.
export const TREND_ESEMPIO: TrendFascia[] = [
  { fascia: "mattina", persone: 14, richieste: [{ chiave: "colazione", volte: 9, persone: 8 }, { chiave: "cornetti artigianali", volte: 5, persone: 4 }] },
  { fascia: "pranzo", persone: 38, richieste: [{ chiave: "pranzo veloce", volte: 16, persone: 14 }, { chiave: "prezzi giusti", volte: 11, persone: 10 }, { chiave: "vegetariano", volte: 6, persone: 5 }] },
  { fascia: "pomeriggio", persone: 9, richieste: [{ chiave: "dolci", volte: 4, persone: 4 }] },
  { fascia: "aperitivo", persone: 52, richieste: [{ chiave: "tavoli all'aperto", volte: 21, persone: 18 }, { chiave: "vino naturale", volte: 12, persone: 11 }, { chiave: "cena tra amici", volte: 9, persone: 8 }] },
  { fascia: "cena", persone: 71, richieste: [{ chiave: "cucina romana", volte: 27, persone: 24 }, { chiave: "non turistico", volte: 22, persone: 19 }, { chiave: "romantico", volte: 10, persone: 9 }] },
  { fascia: "notte", persone: 6, richieste: [{ chiave: "aperto tardi", volte: 4, persone: 4 }] },
];

// "Cosa ti dicono i numeri": al massimo due frasi semplici in cima al pannello, costruite SOLO
// dai numeri del pannello e solo con voci sopra la soglia (niente frasi su 1 o 2 persone).
// Nessuna frase se i dati non bastano: meglio niente che una conclusione inventata.
const FASCIA_FRASE: Record<string, string> = { mattina: "la mattina", pranzo: "a pranzo", pomeriggio: "il pomeriggio", aperitivo: "all'aperitivo", cena: "a cena", notte: "a tarda sera" };
const virgolette = (v: Voce[]) => v.map((x) => `“${x.chiave}”`).join(" e ");
const num1 = (n: number) => n.toLocaleString("it-IT", { maximumFractionDigits: 1 });

export function cosaDiconoINumeri(p: PannelloRistoratore): string[] {
  const out: string[] = [];
  const sopra = (v: Voce[]) => v.filter((x) => x.persone >= SOGLIA);
  const daTe = sopra(p.daRicerca.richieste).slice(0, 2);
  const inZona = sopra(p.zona.richieste).slice(0, 2);
  const picco = sopra(p.zona.fasce).reduce<Voce | null>((a, b) => (!a || b.persone > a.persone ? b : a), null);
  const quando = picco ? FASCIA_FRASE[picco.chiave] : null;
  if (daTe.length) out.push(`Chi ti cerca vuole soprattutto ${virgolette(daTe)}${quando ? `, e nella tua zona si cerca di più ${quando}` : ""}.`);
  else if (inZona.length) out.push(`Nella tua zona si chiede soprattutto ${virgolette(inZona)}${quando ? `, e si cerca di più ${quando}` : ""}.`);
  else if (quando) out.push(`Nella tua zona si cerca di più ${quando}.`);

  const c = p.confronto;
  if (c.mediaSalvati && c.salvati >= SOGLIA) {
    const r = c.salvati / c.mediaSalvati;
    out.push(
      r >= 1.1
        ? `Ti salvano ${num1(r)} volte più dei locali simili in zona: chi ti scopre ti vuole ricordare.`
        : r <= 0.9
          ? `Ti salvano meno dei locali simili (${Math.round(r * 100)}% della media): foto e informazioni curate aiutano.`
          : "Ti salvano quanto i locali simili in zona.",
    );
  } else {
    const v = p.azioni.find((a) => a.tipo === "apri_scheda");
    if (v && v.persone >= SOGLIA && v.prima >= SOGLIA) {
      const d = Math.round(((v.persone - v.prima) / v.prima) * 100);
      out.push(`La tua scheda è stata vista dal ${Math.abs(d)}% di persone ${d >= 0 ? "in più" : "in meno"} rispetto ai ${p.giorni} giorni prima.`);
    }
  }
  return out.slice(0, 2);
}
