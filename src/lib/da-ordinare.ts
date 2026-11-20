// "Da ordinare" (PROPOSTE.md 51): il piatto che le recensioni Google lette nominano di più, con la prova.
// Scelta del CEO (20/11): niente AI. Un elenco di piatti veri e una regola di conteggio: zero chiamate e
// zero token, e niente può essere inventato (la prova è la frase della recensione, copiata).
// Regole: almeno 2 recensioni diverse nominano lo stesso piatto, in una frase senza critiche, da recensioni
// con almeno 4 stelle (o senza voto noto). Mai piatti generici ("pizza", "pasta", "carne") né il piatto
// che dà il nome al locale ("Trapizzino" → niente "trapizzino"). Senza prova la riga non c'è.
// Funzione pura: la usano la ricerca, il verdetto dei salvati e il giro automatico.

export type DaOrdinare = { piatto: string; n: number; di: number; prova: string };

// [nome mostrato, espressione]. Espressioni su testo minuscolo senza accenti (vedi `piano`).
const PIATTI: [string, RegExp][] = [
  // Roma
  ["cacio e pepe", /\bcacio\s*(?:e|&|\+)?\s*pepe\b/],
  ["carbonara", /\bcarbonar[ae]\b/],
  ["amatriciana", /\ba?matriciana\b/],
  ["gricia", /\bgricia\b/],
  ["carciofo alla giudia", /\bcarciof[oi]\s+alla\s+giud[ie]a\b/],
  ["carciofo alla romana", /\bcarciof[oi]\s+alla\s+romana\b/],
  ["supplì", /\bsuppl[iì]\b/],
  ["coda alla vaccinara", /\bcoda\s+(?:alla\s+)?vaccinara\b/],
  ["saltimbocca", /\bsaltimbocca\b/],
  ["trippa", /\btrippa\b/],
  ["abbacchio", /\babbacchio\b/],
  ["puntarelle", /\bpuntarelle\b/],
  ["fiori di zucca", /\bfiori\s+di\s+zucca\b/],
  ["pajata", /\bpa[jg]l?iata\b|\bpajata\b/],
  ["polpette", /\bpolpett(?:e|ine)\b/],
  ["maritozzo", /\bmaritozz[oi]\b/],
  ["pizza bianca", /\bpizza\s+bianca\b/],
  ["pizza fritta", /\bpizz[ae]\s+fritt[ae]\b/],
  ["pinsa", /\bpins[ae]\b/],
  ["trapizzino", /\btrapizzin[oi]\b/],
  ["porchetta", /\bporchetta\b/],
  // Milano e nord
  ["cotoletta", /\bcotolett[ae]\b/],
  ["risotto alla milanese", /\brisotto\s+(?:alla\s+milanese|giallo|allo\s+zafferano)\b/],
  ["ossobuco", /\bosso\s*bu(?:c|ch)[oi]\b/],
  ["mondeghili", /\bmondeghil[il]?\b/],
  ["cassoeula", /\bcassoeula\b/],
  ["vitello tonnato", /\bvitello\s+tonnato\b/],
  ["tortellini", /\btortellin[io]\b/],
  ["tagliatelle al ragù", /\btagliatelle\s+al\s+ragu\b/],
  ["lasagna", /\blasagn[ae]\b/],
  ["pizzoccheri", /\bpizzoccheri\b/],
  ["panzerotti", /\bpanzerott[oi]\b/],
  ["focaccia", /\bfocacci[ae]\b/],
  ["lampredotto", /\blampredotto\b/],
  ["bistecca alla fiorentina", /\bbistecca\s+(?:alla\s+)?fiorentina\b/],
  ["arrosticini", /\barrosticin[io]\b/],
  // Sud e mare
  ["parmigiana", /\bparmigiana\b/],
  ["spaghetti alle vongole", /\b(?:spaghett[io]|linguin[ei]|vermicell[io])\s+(?:alle|con\s+le)\s+vongole\b/],
  ["frittura di pesce", /\bfrittura\s+di\s+(?:pesce|paranza|calamari)\b|\bfritto\s+misto\b/],
  ["polpo", /\bpolpo\b/],
  ["baccalà", /\bbaccala\b/],
  ["tartare", /\btartare\b/],
  ["crudo di pesce", /\bcrud[oi]\s+di\s+pesce\b/],
  ["arancini", /\barancin[ie]\b/],
  ["cannolo", /\bcannol[oi]\b/],
  // Dolci
  ["tiramisù", /\btiramis[uù]\b/],
  ["cheesecake", /\bcheese\s*cake\b/],
  ["bombolone", /\bbombolon[ei]\b/],
  ["sfogliatella", /\bsfogliatell[ae]\b/],
  ["panna cotta", /\bpanna\s*cotta\b/],
  ["babà", /\bbaba\b(?!\s+(?:g|gh)an)/],
  ["crostata", /\bcrostat[ae]\b/],
  // Altre cucine
  ["ramen", /\bramen\b/],
  ["gyoza", /\bgyoz[ae]\b/],
  ["dim sum", /\bdim\s*sum\b/],
  ["hummus", /\bhummus\b/],
  ["falafel", /\bfalafel\b/],
  ["tacos", /\btacos?\b/],
  ["pad thai", /\bpad\s*thai\b/],
  ["pastrami", /\bpastrami\b/],
  // Da bere (bar e cocktail bar)
  ["negroni", /\bnegroni\b/],
];

// Frase che critica, nega o confronta: "la carbonara non era un granché", "supplì freddi", "carbonara ok ma
// nulla di speciale", "la migliore resta quella di Roscioli" (revisore 20/11). Meglio perdere un piatto buono
// che mostrarne uno con una frase contro.
const CRITICA = /\b(?:purtroppo|peccato|pero|ma|unic[ao]\s+pecca|delud|delusion|scott[aoie]\b|insipid|sciap|gommos|bruciat|cott[aoie]\s+troppo|crud[ao]\s+dentro|salat[aoie]|unt[aoie]\b|fredd[aoie]|pessim|scars[aoie]|mediocr|banal|normal[ei]|nulla|niente|non\b|nemmeno|neanche|neppure|senza\s+infamia|evitate|evitare|sconsigli|mai\s+piu|cosi\s+cosi|nella\s+media|sotto\s+le\s+aspettative|aspettativ|un\s+po'?\s+(?:troppo|poco)|troppo|poco|meno|migliore|migliori|meglio|peggio|peggiore|altrove|rispetto|invece|resta\s+quell|caro|car[ie]\b|esagerat|mi\s+aspettavo|pensavo|vegan[aoie]|vegetarian[aoie]|anche|tuttavia|mica|nessun|pesant|asciutt|grumos|slegat|finit[aoie]\b|esaurit|buona\s+fortuna|but|not|never|too|though|bland|overcooked|salty|cold|disappoint|average|mediocre)\b/;
// E deve dire che è buono: un piatto solo nominato ("In menù c'è anche la carbonara", "abbiamo preso
// amatriciana e cacio e pepe") non è un consiglio (revisore 20/11).
const POSITIVA = /\b(?:ottim|buon|squisit|delizios|eccezional|perfett|top\b|super\b|memorabil|da\s+provare|consigl|imperdibil|spettacol|fantastic|strepitos|favolos|divin|incredibil|cremos|sublim|da\s+applausi|da\s+manuale|da\s+urlo|eccellent|sontuos|meraviglios|stupend|fenomenal|squisitezza|great|amazing|delicious|excellent|perfect|must)/;

/** Minuscolo e senza accenti: "Supplì" e "suppli", "Tiramisù" e "tiramisu" contano uguale. */
function piano(t: string): string {
  return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’`]/g, "'");
}

// Frasi intere: si spezza solo su punto, esclamativo e "…" finale. Domande e puntini sospensivi restano nella
// frase e poi la scartano ("Carbonara ottima? Direi di no", "Ottima carbonara... se ti piace la colla": revisore 2, 20/11).
function frasi(testo: string): string[] {
  return testo
    .replace(/\s+/g, " ")
    .split(/(?<=[^.][.!]|…)\s+/)
    .map((f) => f.trim())
    .filter((f) => f.length >= 8);
}

// Pezzi della frase tra virgole, due punti e punti e virgola: piatto e lode devono stare nello stesso pezzo
// ("Abbiamo preso carbonara e amatriciana: amatriciana ottima" loda l'amatriciana, non la carbonara).
function pezzi(frase: string): string[] {
  // Le parentesi sono un pezzo a sé ("filetti di baccalà IMPERDIBILI"), e il resto si legge senza di loro
  // ("Rigatoni con la pajata e bollito (fuori menù) eccezionali").
  const dentro = [...frase.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]);
  const fuori = frase.replace(/\([^)]*\)/g, " ");
  return [...fuori.split(/[,;:]|\s[-–]\s/), ...dentro].map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean);
}
// Un pezzo che è solo una lode ("Supplì filante, buonissimo"): vale per il pezzo prima.
const SOLO_LODE = /^(?:(?:davvero|molto|proprio|veramente|semplicemente|assolutamente|tutto)\s+)?(?:ottim|buon|squisit|delizios|eccezional|perfett|top|super|memorabil|imperdibil|spettacolar|fantastic|strepitos|favolos|divin|sublim|eccellent|stupend|fenomenal)\w*[\s!.]*$/;

// Una variante non è il piatto: "supplì cacio e pepe", "pizza cacio e pepe", "gelato al tiramisù", "carbonara di mare".
const VARIANTE = /\b(?:gelat|gusto|pizz|suppl|di\s+mare|di\s+pesce|di\s+zucchin|di\s+verdur|vegan|vegetarian|rivisitat|gourmet|crema\s+al|torta\s+al)/;
// Parole che sono anche nomi propri ("Ottima cena da Polpo e Pesce"): valgono solo scritte in minuscolo.
const SOLO_MINUSCOLO = new Set(["polpo", "pinsa"]);
const senzaAccenti = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’`]/g, "'");

/** Il pezzo di frase che loda proprio questo piatto, o null. */
function lode(frase: string, piatto: string, re: RegExp): boolean {
  const tutta = piano(frase);
  if (/[?]|\.\.|…./.test(frase) || CRITICA.test(tutta) || /n't\b/.test(tutta)) return false;
  const pz = pezzi(frase);
  return pz.some((pezzo, i) => {
    const x = piano(pezzo);
    const m = x.match(re);
    if (!m) return false;
    // Maiuscolo solo a inizio frase ("Polpo ottimo"); in mezzo è un nome ("cena da Polpo e Pesce").
    if (SOLO_MINUSCOLO.has(piatto) && !re.test(senzaAccenti(pezzo)) && !(i === 0 && m.index === 0)) return false;
    const resto = x.slice(0, m.index) + " " + x.slice((m.index ?? 0) + m[0].length);
    // Un altro piatto nello stesso pezzo: non si sa quale dei due è lodato.
    if (PIATTI.some(([altro, r2]) => altro !== piatto && r2.test(resto))) return false;
    if (VARIANTE.test(resto)) return false;
    return POSITIVA.test(x) || (pz[i + 1] != null && SOLO_LODE.test(piano(pz[i + 1])));
  });
}

const MAX_PROVA = 150;

/** La prova: la frase intera se corta; altrimenti un pezzo intorno al piatto, tagliato a fine parola. */
function prova(frase: string, re: RegExp): string {
  const f = frase.replace(/^[^\p{L}\p{N}"“«]+/u, "").trim();
  if (f.length <= MAX_PROVA) return f;
  const m = piano(f).match(re);
  const at = m?.index ?? 0;
  let start = Math.max(0, at - 60);
  if (start > 0) start = f.indexOf(" ", start) + 1;
  let fine = Math.min(f.length, start + MAX_PROVA);
  if (fine < f.length) fine = f.lastIndexOf(" ", fine);
  return `${start > 0 ? "…" : ""}${f.slice(start, fine).replace(/[\s,;:–-]+$/, "")}${fine < f.length ? "…" : ""}`;
}

export function daOrdinare(
  reviews: { text?: string | null; rating?: number | null }[] | null | undefined,
  nomeLocale?: string | null,
): DaOrdinare | null {
  const lette = (reviews ?? []).filter((r) => typeof r.text === "string" && r.text.trim().length > 0);
  if (lette.length < 2) return null;
  const nome = piano(nomeLocale ?? "");
  let best: { piatto: string; n: number; prova: string; primo: number } | null = null;
  for (const [piatto, re] of PIATTI) {
    // Il piatto che dà il nome al locale non dice cosa ordinare ("Trapizzino", "Supplì Roma").
    if (nome && re.test(nome)) continue;
    let n = 0;
    let p: string | null = null;
    let primo = Infinity;
    lette.forEach((r, i) => {
      if (r.rating != null && r.rating < 4) return;
      const buona = frasi(r.text!).find((f) => lode(f, piatto, re));
      if (!buona) return;
      n++;
      if (p == null) { p = prova(buona, re); primo = i; }
    });
    // A pari numero vince il piatto della recensione che viene prima (Google le ordina per pertinenza).
    if (n >= 2 && p != null && (!best || n > best.n || (n === best.n && primo < best.primo))) best = { piatto, n, prova: p, primo };
  }
  return best ? { piatto: best.piatto, n: best.n, di: lette.length, prova: best.prova } : null;
}
