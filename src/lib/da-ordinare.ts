// "Da ordinare" (PROPOSTE.md 51): il piatto che le recensioni Google lette nominano di più, con la prova.
// Scelta del CEO (20/11): niente AI. Un elenco di piatti veri e una regola di conteggio: zero chiamate e
// zero token, e niente può essere inventato (la prova è la frase della recensione, copiata).
// Regole: almeno 2 recensioni diverse nominano lo stesso piatto, in una frase senza critiche, da recensioni
// con almeno 4 stelle (o senza voto noto). Mai piatti generici ("pizza", "pasta", "carne") né il piatto
// che dà il nome al locale ("Trapizzino" → niente "trapizzino"). Senza prova la riga non c'è.
// Funzione pura: la usano la ricerca, il verdetto dei salvati e il giro automatico.

// `chiesto` (proposta 73): è il piatto nominato nella ricerca ("dove mangio la cacio e pepe").
export type DaOrdinare = { piatto: string; n: number; di: number; prova: string; chiesto?: true };

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
  ["tacos", /\btacos\b/],
  ["pad thai", /\bpad\s*thai\b/],
  ["pastrami", /\bpastrami\b/],
  // Da bere (bar e cocktail bar)
  ["negroni", /\bnegroni\b/],
];

// Frase che critica, nega o confronta: "la carbonara non era un granché", "supplì freddi", "carbonara ok ma
// nulla di speciale", "la migliore resta quella di Roscioli" (revisore 20/11). Meglio perdere un piatto buono
// che mostrarne uno con una frase contro.
// Due elenchi (revisore 3, 20/11): le parole brevi valgono solo intere ("ma", "non"); le radici prendono
// tutte le desinenze ("pessim" → pessima, "insipid" → insipida, "delu" → deluso, delusi).
const CRITICA_PAROLE = /\b(?:pero|ma|mica|non|nulla|niente|nessun[oa]?|nemmeno|neanche|neppure|anche|tuttavia|tranne|eccetto|salvo|invece|rispetto|altrove|troppo|poco|meno|meglio|peggio|quasi|caro|car[ie]|but|not|never|too|though|solo|except|bad|cold)\b/;
const CRITICA_RADICI = /\b(?:purtropp|peccat|unic[ao]\s+pecca|delu|insipid|sciap|gommos|bruciat|bruciacchiat|scott[aoie]|stracott|cott[aoie]\s+troppo|crud[ao]\s+dentro|salat|salatissim|unt[aoie]|untissim|fredd|tiepid|pessim|scars|mediocr|banal|normal|senza\s+infamia|evit|sconsigl|bocci|dimentic|mai\s+piu|cosi\s+cosi|nella\s+media|sotto\s+le\s+aspettative|aspettativ|un\s+po'?\s+(?:troppo|poco)|migliore|migliori|peggior|resta\s+quell|esagerat|mi\s+aspettavo|pensav|vegan|vegetarian|asciutt|grumos|slegat|finit[aoie]\b|esaurit|acid|pesant|stopposa|buona\s+fortuna|una\s+volta|a\s+detta|si\s+fa\s+per\s+dire|tra\s+virgolette|altra\s+storia|cambiat|ora\s+e\b|bland|overcook|salty|disappoint|average|mediocre|awful|terribl|horribl|salvat|in\s+realta|surgelat|se\s+ti\s+piac|se\s+vi\s+piac|se\s+ami|colla\b|panna(?!\s*cotta))/;
const critica = (x: string) => CRITICA_PAROLE.test(x) || CRITICA_RADICI.test(x) || /n't\b/.test(x) || /["“”«»']\s*(?:ottim|buon|perfett|top)/.test(x);

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


// Una variante non è il piatto: "supplì cacio e pepe", "pizza cacio e pepe", "gelato al tiramisù", "carbonara di mare".
const VARIANTE = /\b(?:gelat|gusto|pizz|suppl|di\s+mare|di\s+pesce|di\s+zucchin|di\s+verdur|di\s+melanzan|di\s+ceci|di\s+lenticchi|di\s+soia|sbagliat|analcolic|vegan|vegetarian|rivisitat|gourmet|crema\s+al|torta\s+al)/;
// Parole che sono anche nomi propri ("Ottima cena da Polpo e Pesce"): valgono solo scritte in minuscolo.
const SOLO_MINUSCOLO = new Set(["polpo", "pinsa"]);
const senzaAccenti = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’`]/g, "'");

// Revisore 4 (20/11 sera): un elenco di esclusioni non si chiude mai ("terribile", "nn era buona", "come no", "🙄",
// "da Roscioli", "anni fa"...). Regola rovesciata: vale solo una frase BREVE della forma tipica di un consiglio,
// "Carbonara ottima!", "Ottima la cacio e pepe.", "Il supplì è buonissimo, croccante.": oltre al piatto al massimo
// 6 parole, tutte lodi o parole di raccordo. Niente numeri, emoji, virgolette, parentesi, "!!". Meglio la riga
// meno spesso che falsa.
const LODE_PAROLA = /^(?:ottim\w*|buon\w*|squisit\w*|delizios\w*|eccezional\w*|perfett\w*|top|super|memorabil\w*|imperdibil\w*|spettacolar\w*|fantastic\w*|strepitos\w*|favolos\w*|divin\w*|sublim\w*|eccellent\w*|stupend\w*|fenomenal\w*|cremos\w*|croccant\w*|filant\w*|saporit\w*|great|amazing|delicious|excellent|perfect|outstanding)$/;
const RACCORDO = new Set(["il", "la", "lo", "l", "i", "le", "gli", "un", "una", "uno", "e", "ed", "è", "e'", "era", "erano", "sono", "davvero", "molto", "proprio", "veramente", "assolutamente", "semplicemente", "the", "was", "is", "a", "an", "and", "really", "very", "so", "absolutely", "da", "provare", "urlo", "manuale", "applausi"]);
// Locuzioni ammesse solo intere: "da provare", "da urlo", "da manuale", "da applausi" (mai "da Roscioli").
const LOCUZIONE = /\bda\s+(?!provare\b|urlo\b|manuale\b|applausi\b)\w+/;
// Critiche, dubbi e smentite che possono stare anche nella frase DOPO ("Carbonara buonissima. Scherzo, era immangiabile.").
const SMENTITA = /\b(?:nn|no|terribil\w*|orribil\w*|scadent\w*|immangiabil\w*|sopravvalutat\w*|schif\w*|scherz\w*|vero|certo|ironi\w*|sadly|underwhelm\w*|overpric\w*|overrat\w*|undercook\w*|greasy|supposed|avoid\w*|heard|tempo|anni|prima|scorso|sarebbe|vedremo|torner\w*|lontan\w*|dett[oai]|dic\w*|secondo|raccont\w*|parlat\w*|sentit\w*|lett[oai]|famos\w*|celebr\w*|leggendari\w*|tutti|sogn\w*)\b|tutt'altro|altro che|come no/;

/** La frase loda proprio questo piatto, nella forma breve di un consiglio, e la frase dopo non la smentisce. */
function lode(frase: string, piatto: string, re: RegExp, dopo = ""): boolean {
  // Solo lettere, spazi e la punteggiatura semplice: niente cifre ("5/10"), emoji ("🙄"), virgolette, parentesi.
  if (!/^[\p{L}\s.,!:;'’&+-]+$/u.test(frase) || /!!|\?|\.\.|…/.test(frase)) return false;
  const tutta = piano(frase);
  if (critica(tutta) || SMENTITA.test(tutta) || LOCUZIONE.test(tutta)) return false;
  const dp = piano(dopo);
  if (dp && (critica(dp) || SMENTITA.test(dp) || /\?|!!/.test(dopo))) return false;
  // Un pezzo tra virgole basta ("Negroni perfetto, barman bravissimo"; "Pizza margherita e supplì, ottimo il supplì"):
  // i controlli di critica e "sentito dire" sopra valgono per tutta la frase.
  // I pezzi DOPO quello del piatto devono essere lodi anche loro ("…, barman bravissimo"): "Carbonara ottima, nei sogni" no.
  const pz = frase.split(/[,;:]|\s[-–]\s/);
  const loda = (t: string) => piano(t).split(/[\s.,!:;'&+-]+/).some((w) => LODE_PAROLA.test(w) || /^(?:brav\w*|gentil\w*|cordial\w*|fresc\w*|freschissim\w*|abbondant\w*)$/.test(w));
  return pz.some((pezzo, i) => {
    if (!pz.slice(i + 1).every((d) => !d.trim() || loda(d))) return false;
    const x = piano(pezzo).trim();
    const m = x.match(re);
    if (!m) return false;
    // Maiuscolo solo a inizio frase ("Polpo ottimo"); in mezzo è un nome ("cena da Polpo e Pesce").
    if (SOLO_MINUSCOLO.has(piatto) && !re.test(senzaAccenti(pezzo)) && !(i === 0 && x.replace(/^[^a-z]+/, "").search(re) === 0)) return false;
    const resto = (x.slice(0, m.index) + " " + x.slice((m.index ?? 0) + m[0].length)).split(/[\s.,!:;'&+-]+/).filter(Boolean);
    if (resto.length > 6) return false;
    if (!resto.every((w) => RACCORDO.has(w) || LODE_PAROLA.test(w))) return false;
    return resto.some((w) => LODE_PAROLA.test(w)) || /\bda\s+(?:provare|urlo|manuale|applausi)\b/.test(x);
  });
}

// Circa due righe e mezza a 390 px (revisore 3: a 150 caratteri la citazione andava su 4 righe).
const MAX_PROVA = 110;

/** La prova: la frase intera se corta; altrimenti un pezzo intorno al piatto, tagliato a fine parola. */
function prova(frase: string, re: RegExp): string {
  const f = frase.replace(/^[^\p{L}\p{N}"“«]+/u, "").trim();
  if (f.length <= MAX_PROVA) return f;
  const m = piano(f).match(re);
  const at = m?.index ?? 0;
  let start = Math.max(0, at - 40);
  if (start > 0) start = f.indexOf(" ", start) + 1;
  let fine = Math.min(f.length, start + MAX_PROVA);
  if (fine < f.length) fine = f.lastIndexOf(" ", fine);
  return `${start > 0 ? "…" : ""}${f.slice(start, fine).replace(/[\s,;:–-]+$/, "")}${fine < f.length ? "…" : ""}`;
}

/**
 * Proposta 73: il piatto dell'elenco nominato nella frase della ricerca ("dove mangio la cacio e pepe a Testaccio"
 * → "cacio e pepe"), o null. Solo un piatto: con due o più ("carbonara o amatriciana") non si sceglie per la persona.
 * Una variante ("pizza cacio e pepe", "gelato al tiramisù") non è il piatto.
 */
export function piattoNellaRichiesta(richiesta: string | null | undefined): string | null {
  const q = piano(richiesta ?? "");
  if (!q.trim()) return null;
  const trovati = PIATTI.filter(([, re]) => re.test(q));
  if (trovati.length !== 1) return null;
  const [piatto, re] = trovati[0];
  const m = q.match(re)!;
  // La variante si guarda solo accanto al piatto (due parole prima, tre dopo): "pizzeria con supplì" chiede i supplì,
  // "pizza cacio e pepe" no. "Pizzeria" non è una variante; "pizza bianca" e "pizza fritta" contengono "pizza" da sé.
  const prima = q.slice(0, m.index).trim().split(/\s+/).slice(-2).join(" ");
  const dopo = q.slice((m.index ?? 0) + m[0].length).trim().split(/\s+/).slice(0, 3).join(" ");
  const accanto = `${prima} ${dopo}`.replace(/\bpizzeri\w*/g, " ");
  if (VARIANTE.test(accanto) && !/^pizz/.test(piatto)) return null;
  return piatto;
}

export function daOrdinare(
  reviews: { text?: string | null; rating?: number | null }[] | null | undefined,
  nomeLocale?: string | null,
  // Proposta 73: il piatto chiesto nella ricerca. Se almeno 2 recensioni lette lo lodano, vince lui
  // (anche se un altro piatto ne ha di più): è la conferma di quello che la persona ha chiesto.
  piattoChiesto?: string | null,
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
      // Solo con il voto noto, da 4 o 5 stelle (revisore 4: senza voto il filtro non valeva).
      if (r.rating == null || r.rating < 4) return;
      const fr = frasi(r.text!);
      const at = fr.findIndex((f, k) => lode(f, piatto, re, fr[k + 1] ?? ""));
      const buona = at >= 0 ? fr[at] : undefined;
      if (!buona) return;
      n++;
      if (p == null) { p = prova(buona, re); primo = i; }
    });
    // A pari numero vince il piatto della recensione che viene prima (Google le ordina per pertinenza).
    if (n >= 2 && p != null && piatto === piattoChiesto) return { piatto, n, di: lette.length, prova: p, chiesto: true };
    if (n >= 2 && p != null && (!best || n > best.n || (n === best.n && primo < best.primo))) best = { piatto, n, prova: p, primo };
  }
  return best ? { piatto: best.piatto, n: best.n, di: lette.length, prova: best.prova } : null;
}
