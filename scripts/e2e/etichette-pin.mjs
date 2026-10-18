// Controlli dei nomi sui pin dopo una ricerca (nessuna chiamata, nessun costo).
//   node --experimental-strip-types scripts/e2e/etichette-pin.mjs
import { labelsToHide, pinName } from "../../src/lib/pin-labels.ts";

let failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`); if (!cond) failed++; };
const pin = (id, lat, lng, name = "Trattoria da Augusto") => ({ id, lat, lng, name });

// Trastevere (12/10, ricerca vera): Da Augusto e Hostaria Da Corrado a ~60 m, a zoom 16.
const vicini = [pin("augusto", 41.88947, 12.46972), pin("corrado", 41.88962, 12.46913, "Hostaria Da Corrado")];
ok(labelsToHide(vicini, 16).has("corrado") && !labelsToHide(vicini, 16).has("augusto"), "due pin vicini: resta il nome del primo in lista");
ok(labelsToHide(vicini, 19).size === 0, "avvicinando la mappa tornano entrambi i nomi");
ok(labelsToHide([vicini[1], vicini[0]], 16).has("augusto"), "vince sempre il più in alto nell'ordine dato");
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
