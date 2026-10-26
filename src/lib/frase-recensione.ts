// Senza verdetto dell'AI (credito finito, AI lenta) la card mostra una frase vera di una recensione
// (proposta 29, 26/10). Prima era l'inizio della prima recensione positiva, tagliato a metà
// ("Un luogo dove ti senti in famiglia... cucina casareccia dai sapori unici e..."): ora una frase
// intera, che dice qualcosa del posto. Solo scelta di testo vero: niente scritto da noi.

// Lodi generiche che non dicono niente del posto ("Ottimo!", "Consigliatissimo").
const VUOTA = /^(?:ottim|buon|bell|super|top|consigliat|bravissim|tutto\s+(?:ottimo|perfetto|buono)|esperienza\s+(?:fantastica|ottima|bellissima)|torneremo|ci\s+torner|grazie|eccellente|fantastic|perfett|stupend|meraviglios)\w*[\s!.]*$/i;
// Parole concrete: piatti, ambiente, servizio, prezzo. Una frase che ne ha almeno una vince.
const CONCRETA = /\b(?:carbonara|amatriciana|gricia|cacio|pasta|pizz|carciof|suppl|fritt|tiramis|vino|vini|cocktail|carne|pesce|dolc|antipast|piatt|menu|menù|porzion|prezz|conto|terrazz|tavol|sala|cortile|giardino|vista|atmosfer|ambiente|servizio|personale|cameri|propriet|titolar|signora|nonna|cuoc|chef|forno|pane|fresch|casalin|tradizional|romana|romano)\w*/i;

// Recensione in inglese (Google non sempre la traduce): solo se non c'è altro.
const INGLESE = /\b(?:the|and|was|with|were|we|our|very|food)\b/i;
const MIN = 30;
const MAX = 120;

function frasi(testo: string): string[] {
  return testo
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…])\s+|\s*\.{2,}\s*/)
    .map((f) => f.trim().replace(/^[-–•,;:\s]+/, ""))
    .filter(Boolean);
}

export function fraseDaRecensioni(reviews: { text?: string | null; rating?: number | null }[] | null | undefined): string | null {
  if (!reviews?.length) return null;
  let best: { f: string; score: number } | null = null;
  reviews.forEach((r, i) => {
    if (!r.text || (r.rating != null && r.rating < 4)) return;
    for (const f of frasi(r.text)) {
      if (f.length < MIN || f.length > MAX || VUOTA.test(f)) continue;
      // Concreta prima di tutto; poi vicina a 80 caratteri (sta in due righe della card); a pari merito la recensione prima.
      const score = (CONCRETA.test(f) ? 100 : 0) - (INGLESE.test(f) ? 300 : 0) - Math.abs(80 - f.length) / 4 - i;
      if (!best || score > best.score) best = { f, score };
    }
  });
  if (!best) return null;
  const f = (best as { f: string }).f;
  // Prima lettera maiuscola, punto finale se manca: è una citazione, resta tra virgolette.
  const pulita = f.charAt(0).toUpperCase() + f.slice(1);
  return /[.!?…]$/.test(pulita) ? pulita : `${pulita}.`;
}
