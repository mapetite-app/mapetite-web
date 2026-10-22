// Ricerche di prova (docs/autonomia/TEST-RICERCHE.md) con Google e Haiku veri, nello stesso
// percorso del telefono: primo tempo (dati Google) + verdetti a gruppi + riordino per "alto/basso".
// Avvio: GOOGLE_FIXTURES=scripts/fixtures ANTHROPIC_API_KEY=$MAPETITE_ANTHROPIC_KEY npm run dev
// Solo risposte salvate, mai Google vero: aggiungi GOOGLE_FIXTURES_ONLY=1 all'avvio.
// poi:   node scripts/ricerche-vere.mjs [numeri separati da virgola]   (es. 3,6)
// Con GOOGLE_FIXTURES la seconda volta la risposta Google si legge dal disco: nessuna quota consumata.
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ROMA = [41.8986, 12.4769], MILANO = [45.4642, 9.19];
const CASI = [
  [1, "rooftop a Roma divertente", ROMA],
  [2, "ristorante romantico su un rooftop per andare con la mia fidanzata", ROMA],
  [3, "trattoria autentica non turistica a Trastevere", ROMA],
  [4, "colazione buona vicino a me", [41.8955, 12.4923]],
  [5, "cocktail bar elegante per un appuntamento", ROMA],
  [6, "aperitivo sui Navigli non turistico", MILANO],
  [7, "ristorante romantico con terrazza a Milano per un anniversario", MILANO],
  [8, "trattoria milanese autentica con cotoletta", MILANO],
  [9, "cocktail bar nascosto a Milano per un appuntamento", MILANO],
  [10, "brunch buono a Isola nel weekend", MILANO],
  // Prove extra (non in TEST-RICERCHE): da avviare solo scegliendole per numero.
  [11, "bar cozy a Moscova raggiungibile a piedi", ROMA], // 17/10: quartiere di Milano con la mappa su Roma
  [12, "pizzeria napoletana non turistica a Roma", ROMA],
  [13, "enoteca con vini naturali a Monti", ROMA],
  [14, "ristorante vegano carino per una cena con amici a Milano", MILANO],
  [15, "posto tranquillo per lavorare al pc con un buon caffè", MILANO],
  [16, "wine bar tranquillo", ROMA], // 16/10 sera, Lorenzo: 1 solo risultato con la mappa su Roma
  [17, "pasticceria siciliana", ROMA], // 16/10 sera, Lorenzo
  [18, "enoteca con piattini da condividere", ROMA], // 16/10 sera, Lorenzo
  [19, "posto carino per un pranzo di lavoro", ROMA],
  [20, "trattoria a Trastevere", ROMA], // 18/10: senza "non turistico", il più famoso non deve aprire la lista
];
const scelti = new Set(process.argv[2] ? process.argv[2].split(",").map(Number) : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
const post = (path, body) => fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

for (const [n, query, [lat, lng]] of CASI) {
  if (!scelti.has(n)) continue;
  const t0 = Date.now();
  const fast = await post("/api/search", { query, source: "world", searchIntent: "natural", phase: "fast", lat, lng });
  const tFast = Date.now() - t0;
  let risultati = fast.risultati ?? [];
  const gruppi = fast.sintesi_pendente?.gruppi ?? [];
  const replies = await Promise.all(gruppi.map((g) => post("/api/search/synthesis", { query, places: g.places, token: g.token }).catch(() => null)));
  const tAll = Date.now() - t0;
  const dettagli = Object.assign({}, ...replies.map((r) => r?.dettagli ?? {}));
  const livelli = Object.assign({}, ...replies.map((r) => r?.livelli ?? {}));
  const esclusi = new Set(replies.flatMap((r) => r?.esclusi ?? []));
  const aside = new Set([...(fast.da_parte?.turistici ?? []), ...(fast.da_parte?.fuori_tema ?? []), ...(fast.da_parte?.fuori_zona ?? [])]);
  const tolti = risultati.filter((p) => esclusi.has(p.id));
  risultati = risultati.filter((p) => !esclusi.has(p.id));
  if (risultati.length === 0) risultati = fast.risultati ?? [];
  const rank = (p) => aside.has(p.name) ? 3 : livelli[p.id] === "alto" ? 0 : livelli[p.id] === "basso" ? 2 : 1;
  risultati = risultati.map((p, i) => ({ p, i })).sort((a, b) => rank(a.p) - rank(b.p) || a.i - b.i).map((x) => x.p);
  console.log(`\n== ${n}: ${query}  (prima card ${(tFast / 1000).toFixed(1)} s, verdetti ${(tAll / 1000).toFixed(1)} s)`);
  console.log("   capito:", JSON.stringify(fast.filtri_usati), "| da parte:", JSON.stringify(fast.da_parte ?? {}));
  for (const p of risultati.slice(0, 7)) {
    const d = dettagli[p.id] ?? {};
    console.log(`- [${livelli[p.id] ?? "?"}] ${p.name} | ${p.category} | ${p.rating} (${p.userRatingCount}) | ${(p.address ?? "").slice(0, 35)}`);
    console.log(`     V: ${d.verdict ?? "—"}\n     M: ${d.matchReason ?? "—"}${d.requisiti?.length ? `\n     ✓ ${d.requisiti.map((x) => `${x.r} «${x.prova}»`).join(" | ")}` : ""}`);
  }
  if (tolti.length) console.log("   esclusi:", tolti.map((p) => p.name).join(", "));
}
