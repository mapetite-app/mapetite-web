// Controlli delle regole di ordinamento della ricerca (nessuna chiamata, nessun costo).
//   node --experimental-strip-types scripts/e2e/regole-ricerca.mjs
import { demoteOffType } from "../../src/lib/off-type.ts";
import { demoteMainstream } from "../../src/lib/mainstream.ts";
import { getCategoryEmoji } from "../../src/lib/emoji.ts";

let failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`); if (!cond) failed++; };
const p = (name, category, userRatingCount = 500) => ({ name, category, userRatingCount });
const colazione = [p("The Irish Pub", "irish_pub"), p("Bar Rossi", "cafe"), p("Forno Campo", "bakery"), p("Caffè X", "coffee_shop"), p("Pasticceria Y", "pastry_shop")];

ok(demoteOffType("colazione buona vicino a me", colazione).places.at(-1)?.name === "The Irish Pub", "colazione: il pub irlandese va in fondo");
ok(demoteOffType("colazione e poi una birra", colazione).demoted.length === 0, "colazione + birra: il pub resta");
ok(demoteOffType("pizza a Roma", colazione).demoted.length === 0, "richiesta senza tipo chiaro: nessuno spostamento");
ok(demoteOffType("cocktail bar elegante", [p("Flumen cocktail house", "pub"), p("A", "cocktail_bar"), p("B", "cocktail_bar"), p("C", "bar")]).demoted.length === 0, "cocktail: un 'pub' che si chiama cocktail house resta");
ok(demoteOffType("ristorante romantico su un rooftop", [p("Terrazza Les Étoiles", "bar"), p("A", "restaurant"), p("B", "restaurant"), p("C", "restaurant")]).demoted.length === 0, "ristorante su terrazza con tipo 'bar' resta");
ok(demoteOffType("cocktail bar", [p("Pub 1", "pub"), p("Pub 2", "pub"), p("Pub 3", "pub"), p("A", "cocktail_bar")]).demoted.length === 0, "quasi tutti fuori tema: nessuno spostamento (forse il tipo è capito male)");
const trastevere = [p("Da Enzo", "restaurant", 10239), p("A", "restaurant", 3900), p("B", "restaurant", 2000), p("C", "restaurant", 4100), p("D", "restaurant", 3000)];
ok(demoteMainstream("trattoria autentica non turistica a Trastevere", trastevere).places.at(-1)?.name === "Da Enzo", "non turistico: Da Enzo in fondo");
ok(demoteMainstream("trattoria a Trastevere", trastevere).demoted.length === 0, "richiesta normale: Da Enzo resta");

// Emoji (src/lib/emoji.ts): visto dal vivo il 13/10 sera, un cocktail bar con "Restaurant" nel nome aveva 🍝.
ok(getCategoryEmoji("cocktail_bar", "The Vista Rooftop Roma | Pantheon Terrace Bar & Restaurant") === "🍸", "emoji: cocktail bar con 'Restaurant' nel nome ha 🍸");
ok(getCategoryEmoji("cocktail_bar", "Rooftop Tre") === "🍸", "emoji: cocktail bar ha 🍸");
ok(getCategoryEmoji("bar", "Rooftop Jim's Bar") === "🍺", "emoji: bar resta 🍺");
ok(getCategoryEmoji("restaurant", "Trattoria da Augusto") === "🍝", "emoji: trattoria resta 🍝");
ok(getCategoryEmoji("restaurant", "Pizzeria Ai Marmi") === "🍕", "emoji: pizzeria con tipo 'restaurant' resta 🍕");
ok(getCategoryEmoji("seafood_restaurant", "Terrazza Calabritto cocktail") === "🐟", "emoji: ristorante di pesce resta 🐟");
// Cucine e dolci (14/10): prima indiano, messicano, vegano, brunch avevano 🍝 e le pasticcerie 🥖.
ok(getCategoryEmoji("indian_restaurant", "Jaipur") === "🍛", "emoji: indiano 🍛");
ok(getCategoryEmoji("mexican_restaurant", "La Cucaracha") === "🌮", "emoji: messicano 🌮");
ok(getCategoryEmoji("middle_eastern_restaurant", "Mezè") === "🥙", "emoji: mediorientale 🥙");
ok(getCategoryEmoji("vegan_restaurant", "Rifugio Romano") === "🥗", "emoji: vegano 🥗");
ok(getCategoryEmoji("restaurant", "Panfuwa | Brunch & Café - Milano Isola") === "🥞", "emoji: brunch 🥞");
ok(getCategoryEmoji("pastry_shop", "I Dolci Di Checco Er Carettiere") === "🥐", "emoji: pasticceria 🥐");
ok(getCategoryEmoji("bakery", "Antico Forno Roscioli") === "🥖", "emoji: forno resta 🥖");
ok(getCategoryEmoji("restaurant", "Pizzeria Vegana") === "🍕", "emoji: pizzeria vegana resta 🍕");
ok(getCategoryEmoji("steak_house", "Steak & Tea") === "🥩", "emoji: steakhouse resta 🥩 (\"tea\" non conta)");

console.log(failed === 0 ? "\nTUTTO OK" : `\n${failed} CONTROLLI FALLITI`);
process.exit(failed === 0 ? 0 : 1);
