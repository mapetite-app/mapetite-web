// Controlli delle regole di ordinamento della ricerca (nessuna chiamata, nessun costo).
//   node --experimental-strip-types scripts/e2e/regole-ricerca.mjs
import { demoteOffType } from "../../src/lib/off-type.ts";
import { demoteMainstream } from "../../src/lib/mainstream.ts";
import { getCategoryEmoji } from "../../src/lib/emoji.ts";
import { namedCity, demoteOtherCity, withDistrict, cityNear, isOtherCity, namedOtherCity, ambiguousDistrict, districtCity } from "../../src/lib/named-city.ts";
import { refineCategory } from "../../src/lib/refine-category.ts";
import { videoSourceOf, findVideoLink } from "../../src/lib/video-caption.ts";
import { hasEnglish } from "../../src/lib/italian-check.ts";
import { dedupeSamePlace } from "../../src/lib/dedupe-places.ts";
import { coherentLevel } from "../../src/lib/match-coherence.ts";
import { filtraSalvatiNaturale } from "../../src/lib/cerca-salvati.ts";

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

// Città nominata senza Haiku (14/10, visto con Google vero): "a Milano" con la mappa su Roma mescolava 3 bar di Roma.
ok(namedCity("cocktail bar nascosto a Milano per un appuntamento") === "Milano", "città: 'a Milano' riconosciuta");
ok(namedCity("trattoria di cucina romana") === null && namedCity("cotoletta alla milanese") === null, "città: 'romana', 'milanese' non sono città");
ok(namedCity("tra Roma e Milano") === null, "città: due città nominate, nessuna scelta");
ok(namedCity("trattoria a Trastevere") === null, "città: un quartiere non è una città (resta la mappa)");
{
  const a = (name, address) => ({ name, address });
  const milano = [a("White Rabbit", "Via Garigliano, 4, 20159 Milano MI, Italia"), a("The Race Club Roma", "Via Labicana, 52, 00184 Roma RM, Italia"), a("1930", "Via E. de Amicis, 22, 20123 Milano MI, Italia"), a("Vice", "Corso di Porta Romana, 123, 20122 Milano MI, Italia"), a("Jerry Thomas", "Vicolo Cellini, 30, 00186 Roma RM, Italia")];
  const r = demoteOtherCity("Milano", milano);
  ok(r.places.slice(-2).map((x) => x.name).join(",") === "The Race Club Roma,Jerry Thomas" && r.demoted.length === 2, "città: i bar di Roma vanno in fondo a 'a Milano', mai esclusi");
  ok(demoteOtherCity("Roma", milano).demoted.length === 0, "città: se quasi tutti sono fuori città non si tocca nulla");
  ok(demoteOtherCity("Milano", [a("Senza indirizzo", null), ...milano.slice(0, 1)]).demoted.length === 0, "città: un locale senza indirizzo resta");
}

// Tipo "bar" generico con cocktail_bar tra i tipi Google (14/10): The Doping Milan aveva 🍺 in "cocktail bar a Milano".
ok(refineCategory("bar", ["bar", "cocktail_bar", "point_of_interest"]) === "cocktail_bar", "categoria: bar segnato anche cocktail_bar da Google → cocktail bar");
ok(refineCategory("bar", ["bar", "wine_bar", "lounge_bar"]) === "bar", "categoria: bar con wine_bar resta bar");
ok(refineCategory("bar", ["bar", "cafe", "cocktail_bar"]) === "bar", "categoria: bar che è anche caffetteria resta bar (non va in fondo a 'colazione')");
ok(refineCategory("bar", ["bar", "point_of_interest"]) === "bar" && refineCategory("restaurant", ["restaurant", "cocktail_bar"]) === "restaurant" && refineCategory(null, null) === null, "categoria: solo il 'bar' generico cambia, gli altri tipi restano");

// Video TikTok/YouTube (14/10): solo link di video veri; il server non deve chiamare altri indirizzi.
ok(videoSourceOf("https://vm.tiktok.com/ZMabc123/") === "TikTok" && videoSourceOf("https://www.tiktok.com/@mario/video/123") === "TikTok", "video: link TikTok riconosciuti");
ok(videoSourceOf("https://www.youtube.com/shorts/abcDEF") === "YouTube" && videoSourceOf("https://youtu.be/abc") === "YouTube", "video: Shorts e youtu.be riconosciuti");
ok(videoSourceOf("https://www.instagram.com/reel/ABC/") === null && videoSourceOf("https://evil.com/tiktok.com") === null && videoSourceOf("https://tiktok.com.evil.com/x") === null && videoSourceOf("file:///etc/passwd") === null && videoSourceOf("https://www.youtube.com/watch?v=x") === null, "video: Instagram, altri siti e video lunghi di YouTube esclusi");
ok(findVideoLink("Guarda questo video su TikTok https://vm.tiktok.com/ZMabc123/.") === "https://vm.tiktok.com/ZMabc123/", "video: link trovato nel testo condiviso");

// Verdetti in italiano (14/10): "vibe lounge", "food pairings", "vista breathtaking" visti in memoria.
ok(hasEnglish("Cocktail ben fatti, food pairings, vibe lounge e curato.") && hasEnglish("vista breathtaking") && hasEnglish("cocktail handmade curati"), "italiano: parole inglesi copiate dalle recensioni riconosciute");
ok(!hasEnglish("Drink di qualità e staff professionale in una location piacevole.") && !hasEnglish("Rooftop con cocktail e brunch, atmosfera lounge") && !hasEnglish("Vista mozzafiato, servizio attento"), "italiano: i prestiti entrati nell'italiano (drink, staff, location, rooftop…) vanno bene");

// Quartiere senza città (15/10): "trattoria Monti" dava solo "Trattoria Monti Roma".
ok(withDistrict("trattoria Monti", "Monti") === "trattoria quartiere Monti" && withDistrict("bar rione Monti", "Monti") === "bar rione Monti" && withDistrict("aperitivo centro storico", "centro storico") === "aperitivo zona centro storico" && withDistrict("bar Pigneto", "Trastevere") === "bar Pigneto", "quartiere: 'quartiere X' davanti al nome, una volta sola");
ok(cityNear(41.8986, 12.4769) === "Roma" && cityNear(45.45, 9.18) === "Milano" && cityNear(43.0, 12.0) === null, "città della mappa: Roma, Milano, nessuna lontano dalle città note");

// Zona ambigua (decisione 13a, 16/10): solo un quartiere senza città prende la città della mappa.
ok(ambiguousDistrict("trattoria a Monti", "Monti") && ambiguousDistrict("aperitivo in centro", "centro"), "zona: 'Monti' e 'centro' da soli sono ambigui → contesto della città della mappa");
ok(!ambiguousDistrict("trattoria a Monti Roma", "Monti") && !ambiguousDistrict("trattoria a Monti", "Monti, Roma") && !ambiguousDistrict("trattoria a Brera", "Brera, Milano"), "zona: con la città scritta non c'è ambiguità");
ok(isOtherCity("Parma") && isOtherCity("a Forli") && isOtherCity("L’Aquila") && !isOtherCity("Monti") && !isOtherCity("Trieste") && !isOtherCity("Lodi"), "zona: Parma, Forlì, L'Aquila sono città; Monti no; Trieste e Lodi restano zone di Roma e Milano");
ok(!ambiguousDistrict("trattoria a Parma", "Parma") && namedOtherCity("trattoria tipica a Parma") === "Parma" && namedOtherCity("pranzo sul prato") === null && namedOtherCity("trattoria a Monti") === null, "zona: 'a Parma' è un'altra città (niente 'quartiere Parma Roma'), 'prato' senza 'a' non è Prato");
ok(!ambiguousDistrict("trattoria a Monti", null) && !ambiguousDistrict("pizza", ""), "zona: senza zona nessun contesto aggiunto");
{
  // Come route.ts costruisce il testo per Google con un quartiere ambiguo e la mappa su Roma.
  const testo = (q, zona, lat, lng) => {
    if (!ambiguousDistrict(q, zona)) return q;
    const city = districtCity(zona, q) ?? cityNear(lat, lng);
    const t = withDistrict(q, zona);
    return city && !namedCity(t) ? `${t} ${city}` : t;
  };
  ok(testo("trattoria Monti", "Monti", 41.8986, 12.4769) === "trattoria quartiere Monti Roma" && testo("trattoria Parma", "Parma", 41.8986, 12.4769) === "trattoria Parma" && testo("aperitivo Isola", "Isola", 45.48, 9.19) === "aperitivo quartiere Isola Milano", "zona: 'Monti' con la mappa su Roma → Roma; 'Parma' resta Parma; 'Isola' con la mappa su Milano → Milano");
}

// 17/10 (eventi veri del 16/10 sera): "bar cozy a Moscova" con la mappa su Roma dava bar di Roma.
{
  const testo = (q, zona, lat, lng) => { const city = districtCity(zona, q) ?? cityNear(lat, lng); const t = withDistrict(q, zona); return city && !namedCity(t) ? `${t} ${city}` : t; };
  ok(testo("bar cozy Moscova", "Moscova", 41.8986, 12.4769) === "bar cozy quartiere Moscova Milano", "quartiere: 'Moscova' con la mappa su Roma → Milano");
  ok(testo("trattoria Trastevere", "Trastevere", 45.464, 9.19) === "trattoria quartiere Trastevere Roma", "quartiere: 'Trastevere' con la mappa su Milano → Roma");
  ok(districtCity("Porta Ticinese") === "Milano" && districtCity("Colonne di San Lorenzo") === "Milano" && districtCity("San Lorenzo") === "Roma", "quartiere: i nomi più lunghi vincono (Colonne di San Lorenzo è Milano, San Lorenzo è Roma)");
  ok(districtCity("centro") === null && districtCity("Duomo") === null && districtCity("Trieste") === null, "quartiere: 'centro', 'Duomo', 'Trieste' restano alla città della mappa");
  ok(districtCity(null, "cena romantica a campo de' fiori") === "Roma" && districtCity("NoLo") === "Milano", "quartiere: anche dalla frase (Campo de' Fiori) e con maiuscole (NoLo)");
}

console.log(failed === 0 ? "\nTUTTO OK" : `\n${failed} CONTROLLI FALLITI`);
// Doppioni (visto dal vivo il 17/10 a Milano): stesso civico, due schede Google.
const dd = dedupeSamePlace([
  { name: "drinc.different", lat: 45.4753732, lng: 9.2160213, userRatingCount: 534 },
  { name: "White Rabbit", lat: 45.49, lng: 9.18, userRatingCount: 1746 },
  { name: "drinc. Cocktail & Conversation", lat: 45.4753707, lng: 9.2160187, userRatingCount: 665 },
]);
ok(dd.length === 2 && dd[0].name === "drinc. Cocktail & Conversation", "doppioni: lo stesso locale resta una volta, al primo posto, con la scheda più recensita");
ok(dedupeSamePlace([{ name: "Bar Rossi", lat: 41.9, lng: 12.5, userRatingCount: 1 }, { name: "Bar Bianchi", lat: 41.9, lng: 12.5, userRatingCount: 1 }]).length === 2, "doppioni: due locali diversi nello stesso palazzo restano entrambi");
ok(dedupeSamePlace([{ name: "Rossi", lat: 41.9, lng: 12.5, userRatingCount: 1 }, { name: "Rossi", lat: 41.91, lng: 12.5, userRatingCount: 1 }]).length === 2, "doppioni: stesso nome a 1 km sono due locali");
// Coerenza tra il perché e il livello (perché veri di Haiku, 17/10).
ok(coherentLevel("alto", "Ristorante con vista panoramica sulla città e atmosfera elegante e sofisticata, perfetto per un anniversario; le recensioni sottolineano un servizio formale e attento ai dettagli, ideale per l'occasione, ma non viene esplicitamente menzionata una terrazza.") === "medio", "coerenza: terrazza non menzionata → non più 'alto'");
ok(coherentLevel("alto", "Rooftop panoramico con vista iconografica di Milano; le uniche criticità riguardano il servizio talvolta lento, ma la location eccezionale compensa per un anniversario.") === "alto", "coerenza: una critica minore non abbassa il livello");
ok(coherentLevel("alto", "Trattoria tipica di Trastevere con buona cucina romana; le recensioni la descrivono come locale del quartiere, pur senza escludere una certa affluenza nei fine settimana.") === "alto", "coerenza: 'pur senza escludere' non abbassa");
ok(coherentLevel("alto", "Piccolo bar sui Navigli con buoni drink, anche se le recensioni non lo descrivono specificamente come non turistico.") === "medio", "coerenza: 'non lo descrivono' come requisito → medio");
ok(coherentLevel("basso", "non viene menzionata") === "basso", "coerenza: 'basso' resta basso");
// Ricerca nei salvati in linguaggio naturale (4.5): tutto nel telefono, nessun costo.
const salvati = [
  { name: "Wagyu Bar", t: "sushi_restaurant Sushi Via Tortona 3, 20144 Milano MI", tags: ["Da provare"] },
  { name: "Iyo", t: "japanese_restaurant Giapponese Via Piero della Francesca 74, 20154 Milano MI", tags: ["Già visitato"] },
  { name: "Zen", t: "japanese_restaurant Giapponese Via Urbana 10, 00184 Roma RM", tags: ["Da provare"] },
  { name: "Trattoria da Augusto", t: "italian_restaurant Ristorante italiano Piazza de' Renzi 15, 00153 Roma RM nota: carbonara top", tags: ["Già visitato"] },
  { name: "Er Caffettiere", t: "bar Bar Via Urbana 72, 00184 Roma RM", tags: [] },
];
const cerca = (q) => filtraSalvatiNaturale(salvati, q, (p) => `${p.name} ${p.t}`, (p) => p.tags).map((p) => p.name).sort().join(",");
ok(cerca("quel giapponese che avevo salvato a Milano") === "Iyo,Wagyu Bar", "salvati: 'quel giapponese che avevo salvato a Milano' → i due giapponesi di Milano (sushi compreso)");
ok(cerca("il giapponese di Milano dove sono già stato") === "Iyo" || cerca("giapponese a Milano provato") === "Iyo", "salvati: giapponese a Milano già provato → solo Iyo");
ok(cerca("sushi da provare") === "Wagyu Bar,Zen", "salvati: 'sushi da provare' → i giapponesi da provare");
ok(cerca("trattoria della carbonara") === "Trattoria da Augusto", "salvati: la nota conta ('carbonara')");
ok(cerca("bar a Roma, zona Monti") === "Er Caffettiere", "salvati: un rione che l'indirizzo non riporta non svuota il risultato");
ok(cerca("quello che avevo salvato") === "", "salvati: una frase senza niente di concreto non propone niente");
process.exit(failed === 0 ? 0 : 1);
