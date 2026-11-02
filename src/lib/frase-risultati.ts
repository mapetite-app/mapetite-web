// Frase sopra i risultati (revisore del 1/11: "manca la riga editoriale", come "Rome essentials" di
// Places). Costruita SOLO da dati veri, senza chiamate in più e senza AI che scrive testo libero:
// - quanti posti si vedono, il tipo e la zona che la ricerca ha capito;
// - quante recensioni confermano un requisito della richiesta (i "✓" già sulle card);
// - quanti sono poco conosciuti (💎: voto e numero di recensioni Google);
// - se i locali molto famosi sono stati messi da parte (regola sul numero di recensioni).
// Mai un aggettivo della richiesta attribuito a tutti i posti ("Dieci ristoranti romantici"): si dice
// solo quanti lo confermano. VISIONE: "L'app non deve mai inventare niente".

export type DatiFrase = {
  n: number;
  categoria?: string | null;
  zona?: string | null;
  vicino?: boolean;
  simileA?: string | null;
  // Requisiti confermati dalle recensioni (dalle card): nome → in quanti posti.
  requisiti?: Record<string, number>;
  gemme?: number;
  famosiDaParte?: number;
  // Verdetti ancora in arrivo: i conteggi dalle recensioni non sono finiti, non si mostrano.
  inArrivo?: boolean;
  // I posti in lista (dati Google): il tipo capito ("ristoranti") si scrive solo se lo sono tutti.
  posti?: { name: string; category: string | null; types?: string[] | null }[];
};

const NUMERI = ["", "Un", "Due", "Tre", "Quattro", "Cinque", "Sei", "Sette", "Otto", "Nove", "Dieci", "Undici", "Dodici", "Tredici", "Quattordici", "Quindici", "Sedici", "Diciassette", "Diciotto", "Diciannove", "Venti"];

// Tipo capito dalla ricerca (parola italiana) → singolare, plurale, genere. Fuori elenco: "posti".
// Ogni voce ha la sua prova sui dati Google del posto (tipi o nome): "Dieci ristoranti" solo se lo sono
// tutti e dieci. Con un cocktail bar in mezzo a una ricerca di ristoranti si dice "posti".
const NOMI: Record<string, [string, string, "m" | "f"]> = {
  ristorante: ["ristorante", "ristoranti", "m"],
  trattoria: ["trattoria", "trattorie", "f"],
  osteria: ["osteria", "osterie", "f"],
  pizzeria: ["pizzeria", "pizzerie", "f"],
  enoteca: ["enoteca", "enoteche", "f"],
  bar: ["bar", "bar", "m"],
  "cocktail bar": ["cocktail bar", "cocktail bar", "m"],
  "wine bar": ["wine bar", "wine bar", "m"],
  pub: ["pub", "pub", "m"],
  birreria: ["birreria", "birrerie", "f"],
  gelateria: ["gelateria", "gelaterie", "f"],
  pasticceria: ["pasticceria", "pasticcerie", "f"],
  caffè: ["caffè", "caffè", "m"],
  caffetteria: ["caffetteria", "caffetterie", "f"],
  bistrot: ["bistrot", "bistrot", "m"],
  braceria: ["braceria", "bracerie", "f"],
  hamburgeria: ["hamburgeria", "hamburgerie", "f"],
  rooftop: ["rooftop", "rooftop", "m"],
  forno: ["forno", "forni", "m"],
  locale: ["locale", "locali", "m"],
};

type Posto = { name: string; category: string | null; types?: string[] | null };
const tipi = (p: Posto) => [p.category ?? "", ...(p.types ?? [])];
const ha = (p: Posto, re: RegExp) => tipi(p).some((t) => re.test(t));
const PROVA: Record<string, (p: Posto) => boolean> = {
  ristorante: (p) => ha(p, /^(.+_)?restaurant$|^steak_house$|^bistro$|^diner$/) && !ha(p, /^(bar|cocktail_bar|wine_bar|pub|cafe|coffee_shop)$/),
  trattoria: (p) => /\btrattoria\b/i.test(p.name),
  osteria: (p) => /\b(osteria|hostaria|ostaria)\b/i.test(p.name),
  pizzeria: (p) => ha(p, /^pizza_restaurant$/) || /\bpizzeria\b/i.test(p.name),
  enoteca: (p) => ha(p, /^wine_bar$/) || /\benoteca\b/i.test(p.name),
  bar: (p) => ha(p, /^(bar|cocktail_bar|wine_bar|lounge_bar|pub|bar_and_grill)$/),
  "cocktail bar": (p) => ha(p, /^cocktail_bar$/),
  "wine bar": (p) => ha(p, /^wine_bar$/),
  pub: (p) => ha(p, /^pub$/),
  birreria: (p) => ha(p, /^(pub|brewery|brewpub|beer_garden)$/),
  gelateria: (p) => ha(p, /^ice_cream_shop$/),
  pasticceria: (p) => ha(p, /^(pastry_shop|cake_shop|bakery|dessert_shop)$/),
  caffè: (p) => ha(p, /^(cafe|coffee_shop)$/),
  caffetteria: (p) => ha(p, /^(cafe|coffee_shop)$/),
  bistrot: (p) => ha(p, /^bistro$/),
  braceria: (p) => ha(p, /^(barbecue_restaurant|steak_house)$/),
  hamburgeria: (p) => ha(p, /^hamburger_restaurant$/),
  rooftop: (p) => /\b(rooftop|roof)\b/i.test(p.name),
  forno: (p) => ha(p, /^bakery$/),
  locale: () => true,
};

function nome(n: number, categoria: string | null | undefined, posti: Posto[] | undefined): { parola: string; genere: "m" | "f" } {
  const k = (categoria ?? "").trim().toLowerCase();
  const voce = NOMI[k];
  if (!voce || !posti || posti.length !== n || !posti.every(PROVA[k] ?? (() => false))) return { parola: n === 1 ? "posto" : "posti", genere: "m" };
  return { parola: n === 1 ? voce[0] : voce[1], genere: voce[2] };
}

function quanti(n: number, genere: "m" | "f"): string {
  if (n === 1) return genere === "f" ? "Una" : "Un";
  return NUMERI[n] ?? String(n);
}

// Zona scritta come la dice la ricerca ("Trastevere", "Roma"): solo lettere, spazi e apostrofi.
function zonaPulita(z: string | null | undefined): string | null {
  const t = (z ?? "").trim();
  return t && t.length <= 40 && /^[\p{L}' .-]+$/u.test(t) ? t : null;
}

export function fraseRisultati(d: DatiFrase): { titolo: string; dettaglio: string | null } | null {
  if (d.n <= 0) return null;
  const { parola, genere } = d.simileA ? { parola: d.n === 1 ? "posto" : "posti", genere: "m" as const } : nome(d.n, d.categoria, d.posti);
  const zona = zonaPulita(d.zona);
  const dove = d.simileA ? ` come ${d.simileA}` : d.vicino ? " vicino a te" : zona ? ` a ${zona}` : "";
  const titolo = `${quanti(d.n, genere)} ${parola}${dove}`;
  const pezzi: string[] = [];
  if (!d.inArrivo && d.requisiti) {
    const [r, k] = Object.entries(d.requisiti).sort((a, b) => b[1] - a[1])[0] ?? [];
    if (r && k && k > 0) pezzi.push(`${r} secondo le recensioni: ${k} su ${d.n}`);
  }
  if ((d.gemme ?? 0) > 0) {
    const g = d.gemme as number;
    pezzi.push(g === d.n && d.n > 1 ? `tutti poco conosciut${genere === "f" ? "e" : "i"}` : `${g} poco conosciut${g === 1 ? (genere === "f" ? "a" : "o") : genere === "f" ? "e" : "i"}`);
  }
  if ((d.famosiDaParte ?? 0) > 0) pezzi.push("senza i locali più famosi");
  // Ogni pezzo resta intero su una riga (spazi non divisibili): si va a capo solo tra un pezzo e l'altro.
  const dettaglio = pezzi.slice(0, 2).map((x) => x.replace(/ /g, " ")).join(" · ");
  return { titolo, dettaglio: dettaglio ? dettaglio.charAt(0).toUpperCase() + dettaglio.slice(1) : null };
}
