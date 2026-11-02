// Controlli dei nomi sui pin dopo una ricerca (nessuna chiamata, nessun costo).
//   node --experimental-strip-types scripts/e2e/etichette-pin.mjs
import { labelsToHide, pinName, posizionaEtichette } from "../../src/lib/pin-labels.ts";

let failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`); if (!cond) failed++; };
const pin = (id, lat, lng, name = "Trattoria da Augusto") => ({ id, lat, lng, name });

// Trastevere (12/10, ricerca vera): Da Augusto e Hostaria Da Corrado a ~60 m, a zoom 16.
const vicini = [pin("augusto", 41.88947, 12.46972), pin("corrado", 41.88962, 12.46913, "Hostaria Da Corrado")];
{ const lati = posizionaEtichette(vicini.map((p) => ({ ...p, size: 36, label: p.name })), 16);
  ok(lati.augusto === "sotto" && lati.corrado && lati.corrado !== "sotto", `due pin vicini: il primo in lista ha il nome sotto, il secondo lo sposta di lato invece di coprirlo (${JSON.stringify(lati)})`); }
const sovrapposti = [pin("uno", 41.8895, 12.47, "Primo locale"), pin("due", 41.88951, 12.47001, "Secondo locale"), pin("tre", 41.88952, 12.46999, "Terzo locale")];
ok(labelsToHide(sovrapposti, 15).has("due") && labelsToHide(sovrapposti, 15).has("tre") && !labelsToHide(sovrapposti, 15).has("uno"), "pin uno sopra l'altro: resta solo il nome del primo in lista");
ok(labelsToHide([sovrapposti[1], sovrapposti[0]], 15).has("uno"), "vince sempre il più in alto nell'ordine dato");
// Un segnalino senza nome (gruppo, salvato) è un ostacolo: il nome non ci finisce sopra.
{ const lati = posizionaEtichette([
    { id: "ostacolo", lat: 41.8895, lng: 12.47, size: 36 },
    { id: "nome", lat: 41.88962, lng: 12.47, size: 36, label: "Rooftop Tre" },
  ], 16);
  ok(lati.nome == null || lati.nome !== "sotto", `il nome non copre il segnalino che sta sotto (${JSON.stringify(lati)})`); }
// Nome fisso (selezionato, prime card): resta sempre, anche se tocca qualcosa.
{ const lati = posizionaEtichette(sovrapposti.map((p, i) => ({ ...p, size: 44, label: p.name, fixed: i < 2 })), 15);
  ok(!!lati.uno && !!lati.due && lati.tre == null, `nomi fissi sempre in vista, gli altri nascosti (${JSON.stringify(lati)})`); }
ok(labelsToHide(vicini, 19).size === 0, "avvicinando la mappa tornano entrambi i nomi");
const lontani = [pin("a", 41.889, 12.469), pin("b", 41.895, 12.48), pin("c", 41.9, 12.49)];
ok(labelsToHide(lontani, 15).size === 0, "pin lontani: tutti i nomi in vista");
ok(labelsToHide([pin("solo", 41.9, 12.49)], 10).size === 0, "un solo pin: nome sempre in vista");

// Nome corto sul pin (18/10): l'insegna senza la descrizione aggiunta da Google.
ok(pinName("La Sora Cencia – Trattoria tipica romana a Trastevere") === "La Sora Cencia", "pin: nome senza la descrizione dopo il trattino");
ok(pinName("Pigato Milano | Clubhouse Sandwich and Fine Drinks") === "Pigato Milano", "pin: nome senza la descrizione dopo la barra");
ok(pinName("L'Uliveto Roof Garden - Ristorante panoramico") === "L'Uliveto Roof Garden", "pin: trattino corto con spazi");
ok(pinName("Trattoria da Augusto") === "Trattoria da Augusto" && pinName("Drinc-Bar") === "Drinc-Bar", "pin: nomi senza descrizione restano interi");

console.log(failed ? `\n${failed} controlli falliti` : "\nTUTTO OK");
process.exit(failed ? 1 : 0);
