// Controlli della lettura dei link di Google Maps (nessuna chiamata, nessun costo).
//   node --experimental-strip-types scripts/e2e/maps-link.mjs
import { extractMapsLinks, parseMapsUrl, isShortMapsLink, isGoogleMapsLink } from "../../src/lib/maps-link.ts";

let failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`); if (!cond) failed++; };

// Testo tipico del "Condividi" di Google Maps su Android.
const android = "Roscioli Salumeria con Cucina\nVia dei Giubbonari, 21, 00186 Roma RM\nhttps://maps.app.goo.gl/AbCdEf12345";
ok(JSON.stringify(extractMapsLinks(android)) === JSON.stringify(["https://maps.app.goo.gl/AbCdEf12345"]), "estrae il link corto dal testo condiviso");

const many = "https://maps.app.goo.gl/AAA111\nhttps://maps.app.goo.gl/BBB222.\nciao https://example.com/x\nhttps://maps.app.goo.gl/AAA111";
ok(extractMapsLinks(many).length === 2, "più link (uno per riga), senza doppioni e senza link non Google");

ok(extractMapsLinks("https://www.google.com.evil.net/maps/place/X").length === 0, "host che finge di essere Google: scartato");
ok(extractMapsLinks("https://evil.com/?u=https://maps.google.com").length === 0, "link Google dentro un altro sito: scartato");
ok(!isShortMapsLink(new URL("http://maps.app.goo.gl/AAA")), "link corto solo in https");
ok(!isShortMapsLink(new URL("https://goo.gl/abc")), "goo.gl senza /maps: non si segue");
ok(isShortMapsLink(new URL("https://goo.gl/maps/abc")), "goo.gl/maps: si segue");
ok(isGoogleMapsLink(new URL("https://www.google.it/maps/place/X/@41.9,12.4,17z")), "google.it/maps riconosciuto");

const full = "https://www.google.com/maps/place/Roscioli+Salumeria+con+Cucina/@41.8937,12.4723,17z/data=!3m1!4b1!4m6!3m5!1s0x132f604f3b0b3b3b:0x1a2b3c4d5e6f7a8b!8m2!3d41.8936529!4d12.4725118!16s%2Fg%2F1tf_8b8x?entry=ttu";
const p1 = parseMapsUrl(full);
ok(p1.name === "Roscioli Salumeria con Cucina", `nome dal percorso /maps/place/ (${p1.name})`);
ok(p1.lat === 41.8936529 && p1.lng === 12.4725118, `coordinate del locale da !3d!4d, non dal centro mappa (${p1.lat},${p1.lng})`);
ok(p1.placeId === null, "nessun Place ID inventato (0x...:0x... non è un Place ID)");

const p2 = parseMapsUrl("https://www.google.com/maps/place/Caff%C3%A8+Sant'Eustachio/@41.8983,12.4753,17z");
ok(p2.name === "Caffè Sant'Eustachio" && p2.lat === 41.8983 && p2.lng === 12.4753, "senza !3d!4d usa @lat,lng; nome con accenti");

const p3 = parseMapsUrl("https://www.google.com/maps/search/?api=1&query=Bar+Rossi&query_place_id=ChIJN1t_tDeuEmsRUsoyG83frY4");
ok(p3.placeId === "ChIJN1t_tDeuEmsRUsoyG83frY4" && p3.name === "Bar Rossi", "query_place_id letto");

const p4 = parseMapsUrl("https://maps.google.com/?q=place_id:ChIJN1t_tDeuEmsRUsoyG83frY4");
ok(p4.placeId === "ChIJN1t_tDeuEmsRUsoyG83frY4", "q=place_id: letto");

const p5 = parseMapsUrl("https://maps.google.com/?q=Bar+Rossi,+Via+Roma+1,+Milano&ftid=0x4786c1:0x1234");
ok(p5.name === "Bar Rossi" && p5.lat === null && p5.query === "Bar Rossi, Via Roma 1, Milano", "q=nome,indirizzo senza coordinate: nome sì, coordinate no");

const p6 = parseMapsUrl("https://maps.google.com/?q=41.9,12.5");
ok(p6.lat === 41.9 && p6.lng === 12.5 && p6.name === null, "q=lat,lng: coordinate, nessun nome");

const consent = "https://consent.google.com/ml?continue=" + encodeURIComponent(full) + "&gl=IT&hl=it";
const p7 = parseMapsUrl(consent);
ok(p7.name === "Roscioli Salumeria con Cucina" && p7.lat === 41.8936529, "pagina del consenso cookie: legge il link dentro 'continue'");

const p8 = parseMapsUrl("https://www.google.com/maps/place/X/@0,0,3z");
ok(p8.lat === null, "coordinate 0,0 scartate");

console.log(failed === 0 ? "\nTUTTO OK" : `\n${failed} CONTROLLI FALLITI`);
process.exit(failed === 0 ? 0 : 1);
