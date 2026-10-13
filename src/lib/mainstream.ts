// "Non turistico", "autentico", "poco conosciuto": la richiesta chiede
// esplicitamente di evitare i locali da turisti. In questi casi i locali che
// LE RECENSIONI descrivono come turistici si spostano IN FONDO (mai esclusi).
// Solo ordine e solo dati che Google dà già: nessuna chiamata in più.
//
// Versione 2 (13/10, richiesta di Lorenzo: "la scelta va fatta in base a quello che
// dicono gli utenti"). Prima contava solo il numero di recensioni, ma un locale può
// averne tante ed essere buono e frequentato da romani. Ora decide un punteggio
// spiegabile, fatto di quattro segnali:
//   1. lingua delle recensioni (originalText.languageCode): se quasi tutte sono
//      scritte in lingua straniera, la clientela è soprattutto turistica;
//   2. parole da turisti nelle recensioni ("trappola per turisti", "tourist trap",
//      "menu turistico", "turistico", "caro per quello che è"…);
//   3. parole da gente del posto ("ci vanno i romani", "di quartiere", "come a casa",
//      "locals", "non turistico"…), che tolgono punti;
//   4. il numero di recensioni (molte più degli altri risultati): solo segnale debole.
// In fondo va chi arriva a SOGLIA punti. Senza la lingua (dato assente) il numero di
// recensioni pesa come prima, ma le parole delle recensioni possono ancora salvare un locale.

const OFF_THE_BEATEN_PATH =
  /\b(?:non|poco)\s+(?:troppo\s+)?(?:turistic|famos|mainstream|commercial|conosciut)|\bautentic|\bgenuin|\bnascost|\bsconosciut|\bsegret|\bda\s+romani|\bdove\s+vanno\s+(?:i|gli)\s+(?:romani|milanesi|napoletani|fiorentini|locali|abitanti)|\bfuori\s+dai\s+(?:soliti\s+)?giri|\bgemm[ae]\b|\blontano\s+dai\s+turisti|\bsenza\s+turisti/i;

// Numero di recensioni "di massa" = almeno MIN_COUNT E più di RATIO volte la mediana dei
// risultati, oppure tante recensioni con voto mediocre (Spritz Navigli: 4,0 con 4.526).
// Soglie della v1 (Da Enzo 10.239 su mediana ~3.900; Navigli ~4.500): invariate.
const MIN_COUNT = 3000;
const RATIO = 2.5;
const MEDIOCRE_RATING = 4.3;

// Punteggio: in fondo da SOGLIA in su.
const SOGLIA = 2;
// Con la lingua delle recensioni il conteggio è solo un indizio: da solo non basta, ma basta
// un altro segnale anche debole ("caro per quello che è") per mandare in fondo.
const PESO_MASSA_CON_LINGUA = 1.5;
const PESO_MASSA_SENZA_LINGUA = 2; // senza, vale come nella v1 (basta da solo)
const MIN_RECENSIONI_LINGUA = 3;   // sotto questo numero di recensioni con lingua nota, la quota non conta
const TETTO_TURISTICO = 3.5;
const TETTO_LOCALE = 2;

type Segnale = { re: RegExp; label: string; peso: number };

// Frasi che NEGANO il turistico ("non è turistico", "not a tourist trap", "lontano dai
// turisti"): sono segnali LOCALI e vanno tolte dal testo prima di cercare quelle turistiche.
const NEGAZIONI: RegExp[] = [
  /\bnon\s+(?:è\s+|e'\s+|e\s+)?(?:per\s+niente\s+|affatto\s+|troppo\s+|un\s+(?:posto|locale|ristorante)\s+|il\s+solito\s+(?:posto|locale)\s+)?(?:turistic\w*|(?:una\s+)?trappola\s+per\s+turisti)/g,
  /\b(?:lontan[oaie]\s+dai\s+(?:giri\s+|soliti\s+)?(?:turisti|giri\s+turistici|percorsi\s+turistici)|senza\s+turisti|zero\s+turisti|niente\s+turisti|pochissimi\s+turisti|nessun\s+turista)\b/g,
  /\bnot\s+(?:a\s+|at\s+all\s+|too\s+|very\s+|overly\s+)?(?:touristy|tourist\s+trap)\b|\bno\s+tourists\b|\baway\s+from\s+(?:the\s+)?(?:tourists|tourist\s+\w+)|\bnon[-\s]touristy\b|\bwithout\s+(?:the\s+)?tourists\b/g,
];

// "Zona turistica" parla del quartiere, non del locale ("in piena zona turistica ma si mangia
// come a casa"): non conta né in un senso né nell'altro.
// Anche "una delle zone più turistiche della città" (Navigli Craft Beer, che poi è "pub di quartiere").
const ZONA = /\b(?:zon[ae]|area|aree|quartier[ei]|vi[ae]|strad[ae]|piazz[ae]|centro|città)\s+(?:(?:più|molto|super|tanto|piuttosto|abbastanza)\s+)?turistic\w*|\btouristy\s+(?:area|neighbou?rhood|street|part|spot)|\btourist(?:y)?\s+(?:area|zone|district|hotspot)s?\b|\b(?:area|part\s+of\s+town|neighbou?rhood)\s+(?:is\s+)?(?:very\s+|quite\s+)?touristy\b/g;

const TURISTICI: Segnale[] = [
  { re: /\btrappol[ae]\s+per\s+turisti|\btourist\s+trap/, label: "trappola per turisti", peso: 1.5 },
  { re: /\bacchiappa\s*-?\s*turisti/, label: "acchiappaturisti", peso: 1.5 },
  { re: /\bmen[uù]\s+turistic|\btourist(?:ic)?\s+men[uù]/, label: "menu turistico", peso: 1.5 },
  { re: /\bprezzi\s+da\s+turisti|\btourist\s+prices/, label: "prezzi da turisti", peso: 1.5 },
  { re: /\bpien[oa]\s+di\s+turisti|\bsolo\s+turisti|\btutti\s+turisti|\bfull\s+of\s+tourists|\bonly\s+tourists|\bmostly\s+tourists/, label: "pieno di turisti", peso: 1 },
  { re: /\bturistic\w*|\btouristy\b/, label: "turistico", peso: 1 },
  { re: /\boverpriced\b|\bcar[oa]\s+per\s+(?:quello\s+che|quel\s+che|la\s+qualità)|\bsovrapprezzat|\bprezzi\s+esagerat|\brip[-\s]?off\b|\bfregatura\b/, label: "caro per quello che è", peso: 0.5 },
];

const LOCALI: Segnale[] = [
  { re: /\bci\s+vanno\s+(?:anche\s+)?(?:i|gli)\s+(?:romani|milanesi|napoletani|fiorentini|torinesi|bolognesi|veneziani|residenti)|\bdove\s+(?:vanno|mangiano)\s+(?:i|gli)\s+(?:romani|milanesi|napoletani|fiorentini|residenti)/, label: "ci vanno quelli del posto", peso: 1 },
  { re: /\b(?:gente|persone)\s+del\s+posto|\bfrequentat[oa]\s+(?:soprattutto\s+|principalmente\s+)?(?:da|dai)\s+(?:romani|milanesi|napoletani|italiani|residenti)|\bpien[oa]\s+di\s+(?:romani|milanesi|napoletani|italiani)/, label: "gente del posto", peso: 1 },
  { re: /\bdi\s+quartiere\b/, label: "di quartiere", peso: 1 },
  { re: /\bcome\s+a\s+casa\b/, label: "come a casa", peso: 1 },
  { re: /\blocals\b|\bwhere\s+(?:the\s+)?(?:romans|milanese|italians)\s+(?:eat|go)/, label: "locals", peso: 1 },
];
// "Autentico" lo scrivono anche i turisti ("authentic Italian food"): conta poco e solo
// nelle recensioni scritte in italiano.
const AUTENTICO: Segnale = { re: /\bautentic\w*/, label: "autentico", peso: 0.5 };
const NEGAZIONE_LABEL = "non turistico";

export type TouristInput = {
  name: string;
  userRatingCount: number | null;
  rating?: number | null;
  reviewTexts?: string[] | null;
  reviewOrigins?: { lang: string | null; text: string | null }[] | null;
};

export type TouristScore = {
  score: number;
  demote: boolean;
  reason: string;          // per l'utente e i log, in italiano semplice
  massive: boolean;
  langKnown: number;       // recensioni con lingua nota
  foreign: number;         // di cui scritte in lingua straniera
  touristHits: Record<string, number>;
  localHits: Record<string, number>;
};

export function wantsOffTheBeatenPath(query: string): boolean {
  return OFF_THE_BEATEN_PATH.test(query);
}

function isItalian(lang: string | null | undefined): boolean {
  return typeof lang === "string" && /^it\b/i.test(lang);
}

const LINGUE: Record<string, string> = { en: "inglese", fr: "francese", de: "tedesco", es: "spagnolo", pt: "portoghese", nl: "olandese", ru: "russo", zh: "cinese", ja: "giapponese", ko: "coreano", pl: "polacco", sv: "svedese", da: "danese", no: "norvegese", fi: "finlandese", cs: "ceco", he: "ebraico", ar: "arabo", tr: "turco", el: "greco", ro: "rumeno", hu: "ungherese" };

function fmt(n: number): string {
  return n.toLocaleString("it-IT");
}

function hitsText(hits: Record<string, number>): string[] {
  return Object.entries(hits).map(([label, n]) => `«${label}»${n > 1 ? ` ×${n}` : ""}`);
}

// Punteggio turistico di un locale. `massive` = il conteggio delle recensioni è da locale di massa
// rispetto agli altri risultati (calcolato dal chiamante).
export function touristScore(p: TouristInput, massive: boolean): TouristScore {
  const texts = p.reviewTexts ?? [];
  const origins = p.reviewOrigins ?? [];
  const touristHits: Record<string, number> = {};
  const localHits: Record<string, number> = {};
  let touristPts = 0;
  let localPts = 0;

  texts.forEach((t, i) => {
    const o = origins[i];
    // Testo tradotto + originale: "tourist trap" in inglese, "trappola per turisti" tradotto.
    let s = `${t}\n${o?.text ?? ""}`.toLowerCase();
    let negated = false;
    for (const re of NEGAZIONI) {
      if (re.test(s)) negated = true;
      re.lastIndex = 0;
      s = s.replace(re, " ");
    }
    s = s.replace(ZONA, " ");
    // Ogni recensione conta una volta per segnale; per il turistico conta il segnale più forte.
    const t1 = TURISTICI.find((g) => g.re.test(s));
    if (t1) {
      touristHits[t1.label] = (touristHits[t1.label] ?? 0) + 1;
      touristPts += t1.peso;
    }
    const l1 = LOCALI.find((g) => g.re.test(s));
    if (l1) {
      localHits[l1.label] = (localHits[l1.label] ?? 0) + 1;
      localPts += l1.peso;
    } else if (negated) {
      localHits[NEGAZIONE_LABEL] = (localHits[NEGAZIONE_LABEL] ?? 0) + 1;
      localPts += 1;
    } else if (isItalian(o?.lang) && AUTENTICO.re.test(s)) {
      localHits[AUTENTICO.label] = (localHits[AUTENTICO.label] ?? 0) + 1;
      localPts += AUTENTICO.peso;
    }
  });

  const langs = origins.slice(0, texts.length).map((o) => o?.lang ?? null).filter((l): l is string => typeof l === "string" && l.trim() !== "");
  const langKnown = langs.length;
  const foreignLangs = langs.filter((l) => !isItalian(l));
  const foreign = foreignLangs.length;
  const hasLang = langKnown >= MIN_RECENSIONI_LINGUA;
  const share = hasLang ? foreign / langKnown : 0;
  const langPts = !hasLang ? 0 : share >= 0.8 ? 2 : share >= 0.6 ? 1 : 0;
  const massPts = massive ? (hasLang ? PESO_MASSA_CON_LINGUA : PESO_MASSA_SENZA_LINGUA) : 0;

  const score = Math.round((langPts + Math.min(touristPts, TETTO_TURISTICO) + massPts - Math.min(localPts, TETTO_LOCALE)) * 10) / 10;

  const parts: string[] = [];
  if (hasLang && foreign > 0) {
    const byLang = new Map<string, number>();
    for (const l of foreignLangs) {
      const k = l.toLowerCase().split(/[-_]/)[0];
      byLang.set(k, (byLang.get(k) ?? 0) + 1);
    }
    const top = [...byLang.entries()].sort((a, b) => b[1] - a[1]);
    const only = top.length === 1 ? LINGUE[top[0][0]] : null;
    parts.push(`${foreign} recensioni su ${langKnown} in ${only ?? "lingua straniera"}`);
  } else if (hasLang) {
    parts.push(`recensioni tutte in italiano`);
  }
  parts.push(...hitsText(touristHits));
  if (massive) parts.push(`${fmt(p.userRatingCount ?? 0)} recensioni, molte più degli altri`);
  const local = hitsText(localHits);
  if (local.length > 0) parts.push(`ma anche ${local.join(", ")}`);

  return {
    score,
    demote: score >= SOGLIA,
    reason: parts.join(", "),
    massive,
    langKnown,
    foreign,
    touristHits,
    localHits,
  };
}

export function demoteMainstream<T extends TouristInput>(
  query: string,
  places: T[],
): { places: T[]; demoted: string[]; reasons: string[]; log: string[] } {
  const none = { places, demoted: [], reasons: [], log: [] };
  if (places.length < 4 || !wantsOffTheBeatenPath(query)) return none;
  const counts = places.map((p) => p.userRatingCount ?? 0).sort((a, b) => a - b);
  const median = counts[Math.floor(counts.length / 2)];
  const limit = Math.max(MIN_COUNT, median * RATIO);
  const isMass = (p: T) => {
    const n = p.userRatingCount ?? 0;
    return n > limit || (n >= MIN_COUNT && p.rating != null && p.rating < MEDIOCRE_RATING);
  };
  const scored = places.map((p) => ({ p, s: touristScore(p, isMass(p)) }));
  const kept = scored.filter((x) => !x.s.demote);
  // Se sono tutti "turistici" non si tocca nulla (forse il segnale è sbagliato).
  const log = scored
    .filter((x) => x.s.score !== 0 || x.s.massive)
    .map((x) => `${x.p.name}: ${x.s.demote ? "IN FONDO" : "resta"} (punti ${x.s.score}: ${x.s.reason || "nessun segnale"})`);
  if (kept.length === 0 || kept.length === places.length) return { ...none, log };
  const mass = scored.filter((x) => x.s.demote);
  return {
    places: [...kept.map((x) => x.p), ...mass.map((x) => x.p)],
    demoted: mass.map((x) => x.p.name),
    reasons: mass.map((x) => x.s.reason),
    log,
  };
}
