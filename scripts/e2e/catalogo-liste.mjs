// Controlli delle regole "posti delle liste dal catalogo, prima di Google" (proposta 38). Nessuna chiamata, nessun costo.
//   node --experimental-strip-types scripts/e2e/catalogo-liste.mjs
import { catalogKey, sameCatalogName, cityOfList, areaFor, ilikePattern, pickUnique } from "../../src/lib/catalogo-match.ts";

let failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`); if (!cond) failed++; };
// Come cityFromAddress (src/lib/city.ts) per gli indirizzi "…, 00186 Roma RM": basta per i casi qui sotto.
const cityOf = (a) => a?.match(/\d{5}\s+([^,]+?)(?:\s+[A-Z]{2})?(?:,|$)/)?.[1] ?? null;
const pl = (id, name, lat, lng, gid = `ChIJ${id}xxxxxxxxxx`, address = "Via X 1, 00186 Roma RM") => ({ id, name, lat, lng, google_place_id: gid, address });
const ROMA = areaFor({ citta: "Roma" });

// Normalizzazione prudente
ok(sameCatalogName("Trattoria Da Enzo", "Da Enzo"), "\"Trattoria Da Enzo\" ≈ \"Da Enzo\" (tipo scritto da una parte sola, nome di due parole)");
ok(sameCatalogName("Ristorante Roscioli", "Roscioli Restaurant"), "ristorante ≈ restaurant");
ok(sameCatalogName("Caffè Sant'Eustachio", "Sant’Eustachio Il Caffè"), "accenti, apostrofi e articolo: stesso nome");
ok(!sameCatalogName("Bar Rossi", "Pasticceria Rossi"), "tipi diversi (bar e pasticceria): non è lo stesso posto");
ok(!sameCatalogName("Rossi", "Pasticceria Rossi"), "nome di una parola sola e tipo da una parte sola: nel dubbio no");
ok(!sameCatalogName("Da Enzo al 29", "Da Enzo"), "parole in più (\"al 29\"): non è lo stesso nome");
ok(sameCatalogName("Armando al Pantheon", "Armando al Pantheon"), "stesso nome identico");
ok(catalogKey("Bar") === null && catalogKey("Pizza Re") === null && catalogKey("La") === null, "nomi troppo generici (\"Bar\", \"Pizza Re\", \"La\"): nessuna chiave, si va a Google");
ok(ilikePattern("Caffè Greco") === "gr_c_", `ricerca nel database con le vocali jolly (${ilikePattern("Caffè Greco")})`);

// Città della lista
ok(cityOfList("Roma da provare") === "Roma" && cityOfList("Cene a Milan") === "Milano", "città dal nome della lista (anche in inglese)");
ok(cityOfList("Want to go") === null && cityOfList("Roma e Milano") === null, "lista senza città, o con due città: zona incerta");

// Zona dai posti della stessa lista
const a1 = areaFor({ punti: [{ lat: 41.90, lng: 12.47 }, { lat: 41.89, lng: 12.49 }] });
ok(a1?.tipo === "box" && a1.minLat < 41.89 && a1.maxLat > 41.90, "zona dai posti già trovati della lista, se stanno vicini");
ok(areaFor({ punti: [{ lat: 41.9, lng: 12.47 }, { lat: 45.46, lng: 9.19 }] }) === null, "posti tra Roma e Milano nella stessa lista: nessuna zona, si va a Google");
ok(areaFor({}) === null, "senza città né posti: nessuna zona");
ok(areaFor({ citta: "Bologna" })?.tipo === "citta", "altra città: si confronta la città dell'indirizzo");

// Corrispondenza unica
const enzo = pl("a1", "Da Enzo al 29", 41.888, 12.476);
ok(pickUnique("Trattoria Da Enzo al 29", [enzo], ROMA, cityOf)?.id === "a1", "un solo locale con quel nome a Roma: preso dal catalogo");
ok(pickUnique("Da Enzo al 29", [enzo, pl("a2", "Da Enzo al 29", 41.91, 12.50)], ROMA, cityOf) === null, "omonimi nella stessa città (due punti lontani): Google");
ok(pickUnique("Da Enzo al 29", [enzo, { ...enzo, id: "a3", google_place_id: null, lat: 41.8881 }], ROMA, cityOf)?.id === "a1", "stesso locale due volte nel catalogo (con e senza Place ID, vicini): conta una volta");
ok(pickUnique("Da Enzo al 29", [{ ...enzo, google_place_id: null }], ROMA, cityOf) === null, "locale nel catalogo senza Place ID Google: non verificato, Google");
ok(pickUnique("Da Enzo al 29", [pl("m1", "Da Enzo al 29", 45.46, 9.19)], ROMA, cityOf) === null, "stesso nome ma a Milano, lista di Roma: no");
ok(pickUnique("Da Enzo al 29", [enzo], null, cityOf) === null, "zona ignota: mai dal catalogo");
ok(pickUnique("Da Enzo al 29", [enzo], ROMA, cityOf, false) === null, "lettura dal database fermata al limite (forse altri omonimi): Google");
ok(pickUnique("Bar Rossi", [pl("r1", "Pasticceria Rossi", 41.9, 12.48)], ROMA, cityOf) === null, "\"Bar Rossi\" non diventa \"Pasticceria Rossi\"");
const bo = areaFor({ citta: "Bologna" });
ok(pickUnique("Trattoria Anna Maria", [pl("b1", "Trattoria Anna Maria", 44.49, 11.34, "ChIJb1xxxxxxxxxx", "Via Belle Arti 17, 40126 Bologna BO")], bo, cityOf)?.id === "b1", "altra città dall'indirizzo: Bologna con Bologna sì");
ok(pickUnique("Trattoria Anna Maria", [pl("b2", "Trattoria Anna Maria", 41.9, 12.48, "ChIJb2xxxxxxxxxx", "Via Bologna 3, 00161 Roma RM")], bo, cityOf) === null, "\"Via Bologna\" a Roma non è Bologna");

process.exit(failed === 0 ? 0 : 1);
