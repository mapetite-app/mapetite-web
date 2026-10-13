// Controlli di "turistici v2" (src/lib/mainstream.ts) e delle richieste di stellato
// (src/lib/michelin.ts) con dati finti: nessuna chiamata, nessun costo.
//   node --experimental-strip-types scripts/test-mainstream.mjs
import { demoteMainstream, touristScore } from "../src/lib/mainstream.ts";
import { wantsMichelin, michelinGoogleQuery, promoteMichelin } from "../src/lib/michelin.ts";

let failed = 0;
const ok = (cond, msg, extra = "") => { console.log(`${cond ? "PASS" : "FAIL"}  ${msg}${!cond && extra ? `\n      → ${extra}` : ""}`); if (!cond) failed++; };

// Recensioni finte: [testo tradotto in italiano, lingua originale, testo originale opzionale].
const place = (name, userRatingCount, reviews = null, rating = 4.5) => ({
  name,
  userRatingCount,
  rating,
  reviewTexts: reviews ? reviews.map((r) => r[0]) : null,
  reviewOrigins: reviews ? reviews.map((r) => ({ lang: r[1], text: r[2] ?? null })) : null,
});
const it = (t) => [t, "it"];
const en = (t, orig) => [t, "en", orig];
const Q = "trattoria autentica non turistica a Trastevere";
const normali = [place("A", 900, [it("Buona"), it("Ottima"), it("Bene")]), place("B", 1200, [it("Buona"), it("Ottima"), it("Bene")]), place("C", 700, [it("Buona"), it("Ottima"), it("Bene")]), place("D", 1500, [it("Buona"), it("Ottima"), it("Bene")])];
const ultimo = (r) => r.places.at(-1)?.name;

// --- Turistici v2 ---
{
  const tanteMaBuone = place("Da Mario", 12000, [it("Trattoria di quartiere, ci vanno i romani"), it("Carbonara top"), it("Come a casa"), it("Servizio veloce"), en("Great food", "Great food")]);
  const r = demoteMainstream(Q, [tanteMaBuone, ...normali]);
  ok(r.demoted.length === 0, "tante recensioni ma italiane e 'di quartiere': NON va in fondo", JSON.stringify(r.log));
}
{
  const trappola = place("Bella Roma", 300, [
    en("Una trappola per turisti, evitate", "Tourist trap, avoid"),
    en("Classica trappola per turisti", "Classic tourist trap"),
    it("Niente di che"),
    en("Cibo nella media", "Average food"),
    en("Ok", "Ok"),
  ]);
  const r = demoteMainstream(Q, [trappola, ...normali]);
  ok(ultimo(r) === "Bella Roma", "poche recensioni ma 'tourist trap' ×2: va in fondo", JSON.stringify(r.log));
  ok(r.reasons[0] === "4 recensioni su 5 in inglese, «trappola per turisti» ×2", "motivo spiegabile per l'utente", r.reasons[0]);
}
{
  // Dati vecchi (senza originalText): si comporta come la v1 sul conteggio.
  const vecchi = [place("Da Enzo", 10239), place("A", 3900), place("B", 2000), place("C", 4100), place("D", 3000)];
  const r = demoteMainstream(Q, vecchi);
  ok(ultimo(r) === "Da Enzo" && r.demoted.length === 1, "senza lingua delle recensioni: come prima, Da Enzo (10.239) in fondo", JSON.stringify(r.log));
  ok(r.reasons[0] === "10.239 recensioni, molte più degli altri", "motivo senza lingua: il conteggio", r.reasons[0]);
}
{
  // Senza lingua, ma le recensioni (tradotte) dicono che ci vanno i romani: resta.
  const salvato = { ...place("Da Enzo", 10239), reviewTexts: ["Ci vanno i romani, si mangia come a casa", "Buonissimo"] };
  const r = demoteMainstream(Q, [salvato, place("A", 3900), place("B", 2000), place("C", 4100), place("D", 3000)]);
  ok(r.demoted.length === 0, "senza lingua ma 'ci vanno i romani': resta", JSON.stringify(r.log));
}
{
  const stranieri = place("Pasta Express", 800, [en("Buono", "Good"), en("Buono", "Good"), en("Ottimo", "Great"), ["Très bon", "fr"], en("Ok", "Ok")]);
  ok(ultimo(demoteMainstream(Q, [stranieri, ...normali])) === "Pasta Express", "5 recensioni su 5 in lingua straniera: va in fondo");
  const misto = place("Misto", 800, [en("Buono", "Good"), en("Buono", "Good"), en("Ottimo", "Great"), it("Buono"), it("Ok")]);
  ok(demoteMainstream(Q, [misto, ...normali]).demoted.length === 0, "3 su 5 in lingua straniera e niente altro: resta (nel dubbio resta)");
}
{
  const s1 = touristScore(place("X", 500, [it("Non è per niente turistico, buonissimo"), it("Ok"), it("Ok")]), false);
  ok(!s1.touristHits["turistico"] && s1.localHits["non turistico"] === 1, "'non è per niente turistico' è un segnale locale, non turistico", JSON.stringify(s1));
  const s2 = touristScore(place("X", 500, [it("In piena zona turistica ma si mangia benissimo"), it("Ok"), it("Ok")]), false);
  ok(Object.keys(s2.touristHits).length === 0, "'zona turistica' parla del quartiere: non conta", JSON.stringify(s2));
  const s3 = touristScore(place("X", 500, [en("Non è una trappola per turisti", "Not a tourist trap at all"), it("Ok"), it("Ok")]), false);
  ok(Object.keys(s3.touristHits).length === 0, "'not a tourist trap' non è un segnale turistico", JSON.stringify(s3));
  const s4 = touristScore(place("X", 500, [en("Cibo autentico", "Authentic food"), it("Cucina autentica"), it("Ok")]), false);
  ok(s4.localHits["autentico"] === 1, "'autentico' conta solo nelle recensioni scritte in italiano", JSON.stringify(s4));
}
{
  const s = touristScore(place("X", 500, [it("Nonostante sia in una delle zone più turistiche della città, dentro sembra un pub di quartiere"), it("Ok"), it("Ok")]), false);
  ok(Object.keys(s.touristHits).length === 0 && s.localHits["di quartiere"] === 1, "'zone più turistiche' non conta, 'di quartiere' sì", JSON.stringify(s));
  const s2 = touristScore(place("X", 500, [it("Essendo in un'area molto turistica mi aspettavo peggio"), it("Ok"), it("Ok")]), false);
  ok(Object.keys(s2.touristHits).length === 0, "'area molto turistica' non conta (fixture Trastevere: La Trattoria de Gli Amici)", JSON.stringify(s2));
  const tante = [it("Buona"), it("Ottima"), it("Bene"), en("Buono", "Good")];
  ok(demoteMainstream(Q, [place("Grande", 15000, tante), ...normali]).demoted.length === 0, "con la lingua: tante recensioni (italiane) da sole non bastano");
  ok(ultimo(demoteMainstream(Q, [place("Grande", 15000, [...tante, it("Caro per quello che offre")]), ...normali])) === "Grande", "tante recensioni + 'caro per quello che è': in fondo");
}
{
  const unaVolta =place("Uno", 400, [it("Un po' una trappola per turisti"), it("Buono"), it("Buono"), it("Buono"), it("Buono")]);
  ok(demoteMainstream(Q, [unaVolta, ...normali]).demoted.length === 0, "'trappola per turisti' una sola volta con recensioni italiane: resta");
}
{
  const r = demoteMainstream("trattoria a Trastevere", [place("Bella Roma", 300, [en("Trappola per turisti", "Tourist trap"), en("Trappola per turisti", "Tourist trap"), en("x", "x")]), ...normali]);
  ok(r.demoted.length === 0 && r.log.length === 0, "richiesta normale (non 'non turistica'): nessuno spostamento");
}
{
  const tutti = [1, 2, 3, 4].map((i) => place(`T${i}`, 500, [en("Trappola per turisti", "Tourist trap"), en("Trappola per turisti", "Tourist trap"), en("x", "x")]));
  ok(demoteMainstream(Q, tutti).demoted.length === 0, "tutti 'turistici': non si tocca nulla");
}
{
  const r = demoteMainstream(Q, [place("Bella Roma", 300, [en("Trappola per turisti", "Tourist trap"), en("Trappola per turisti", "Tourist trap"), en("x", "x")]), ...normali]);
  ok(r.places.length === normali.length + 1, "mai esclusioni: stesso numero di locali");
}

// --- Stellato / stella Michelin ---
ok(wantsMichelin("ristorante stellato dove mangiare pesce"), "capisce 'ristorante stellato'");
ok(wantsMichelin("una stella Michelin a Milano"), "capisce 'stella Michelin'");
ok(wantsMichelin("michelin roma"), "capisce 'michelin'");
ok(!wantsMichelin("cena romantica sotto un cielo stellato"), "'cielo stellato' non è una richiesta Michelin");
ok(!wantsMichelin("ristorante di pesce a Roma"), "richiesta normale: niente Michelin");
{
  const g = michelinGoogleQuery("ristorante stellato dove mangiare pesce a Roma", "ristorante pesce Roma", "seafood_restaurant");
  ok(g.queryGoogle === "ristorante pesce Roma stellato Michelin", "la query a Google tiene 'stellato Michelin' se la riscrittura l'ha tolto", g.queryGoogle);
  ok(g.includedType === "restaurant", "il tipo 'ristorante di pesce' si allarga a 'ristorante' (gli stellati sono spesso 'fine dining')", String(g.includedType));
  const g2 = michelinGoogleQuery("ristorante stellato pesce", "ristorante stellato pesce Roma", "fine_dining_restaurant");
  ok(g2.queryGoogle === "ristorante stellato pesce Roma Michelin" && g2.includedType === "restaurant", "già 'stellato': aggiunge solo 'Michelin'; anche fine dining si allarga a ristorante", JSON.stringify(g2));
  const g3 = michelinGoogleQuery("ristorante di pesce", "ristorante pesce", "seafood_restaurant");
  ok(g3.queryGoogle === "ristorante pesce" && g3.includedType === "seafood_restaurant" && g3.changed.length === 0, "richiesta normale: query e tipo invariati");
}
{
  const ps = [
    { name: "Pescheria Da Gino", editorialSummary: "Trattoria di pesce", reviewTexts: ["Buon fritto", "Cena sotto un cielo stellato in terrazza"] },
    { name: "Acquolina", editorialSummary: "Ristorante con una stella Michelin, cucina di mare creativa", reviewTexts: ["Menu degustazione"] },
    { name: "Osteria del Mare", editorialSummary: null, reviewTexts: ["Buonissimo"] },
    { name: "Pierluigi", editorialSummary: null, reviewTexts: ["Fantastico"], reviewOrigins: [{ lang: "en", text: "Deserves its Michelin star" }] },
  ];
  const r = promoteMichelin("ristorante stellato dove mangiare pesce", ps);
  ok(r.places.map((p) => p.name).join(",") === "Acquolina,Pierluigi,Pescheria Da Gino,Osteria del Mare", "in cima chi cita la stella (descrizione o recensione originale), poi gli altri nell'ordine di Google", r.places.map((p) => p.name).join(","));
  ok(r.places.length === ps.length && r.cited.length === 2, "nessun locale escluso; 'cielo stellato' non conta come citazione");
  const n = promoteMichelin("ristorante di pesce", ps);
  ok(!n.applied && n.places === ps, "richiesta normale: ordine invariato");
}

console.log(failed === 0 ? "\nTUTTO OK" : `\n${failed} CONTROLLI FALLITI`);
process.exit(failed === 0 ? 0 : 1);
