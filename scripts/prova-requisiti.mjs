// Collaudo dei "✓ terrazza" (doppia chiave, 23/10): frasi di prova → regole (src/lib/prova-requisito.ts)
// → AI dei verdetti (stesso prompt di src/lib/haiku-synthesis.ts). Nessuna chiamata Google, nessuna
// scrittura nel database: l'AI si chiama direttamente con il prompt letto dal file.
//   ANTHROPIC_API_KEY=$MAPETITE_ANTHROPIC_KEY node --experimental-strip-types --no-warnings scripts/prova-requisiti.mjs casi.json
// casi.json: [{ "r": "terrazza", "frase": "…", "atteso": false, "nome": "Da Mario" (facoltativo), "voto": 5 (facoltativo) }]
import { readFileSync } from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const Anthropic = require("@anthropic-ai/sdk").default;
const { provaRequisito } = await import("../src/lib/prova-requisito.ts");

const casi = JSON.parse(readFileSync(process.argv[2], "utf8"));
const src = readFileSync(new URL("../src/lib/haiku-synthesis.ts", import.meta.url), "utf8");
const SYSTEM = src.match(/const MATCH_REASON_SYSTEM = `([\s\S]*?)`;/)[1];
const MODEL = src.match(/const HAIKU_MODEL = "([^"]+)"/)[1];
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// 1. Regole: la frase deve passare da sola (recensione con il voto, 5 stelle se non detto).
const conCandidato = casi.map((c, i) => ({ ...c, i, candidato: provaRequisito(c.r, [{ text: c.frase, rating: c.voto ?? 5 }], c.nome ?? "") }));
const daAI = conCandidato.filter((c) => c.candidato);

// 2. AI: a gruppi di 4 locali, come in produzione; la richiesta nomina il requisito.
const confermati = new Set();
for (let k = 0; k < daAI.length; k += 4) {
  const batch = daAI.slice(k, k + 4);
  const payload = batch.map((c) => ({ id: `T${c.i}`, name: c.nome ?? `Locale ${c.i}`, category: "restaurant", types: ["restaurant"], editorialSummary: null, reviewTexts: [c.frase], prove: [{ r: c.r, frase: c.candidato }] }));
  const query = `ristorante ${[...new Set(batch.map((c) => c.r))].join(" ")} a Roma`;
  const m = await anthropic.messages.create({ model: MODEL, max_tokens: 3000, system: SYSTEM, messages: [{ role: "user", content: `Richiesta dell'utente: ${query}\n\nLocali:\n${JSON.stringify(payload)}` }] });
  const t = m.content[0]?.type === "text" ? m.content[0].text : "[]";
  const arr = JSON.parse(t.slice(t.indexOf("["), t.lastIndexOf("]") + 1));
  for (const o of arr) for (const c of batch) if (o.id === `T${c.i}` && Array.isArray(o.prove_ok) && o.prove_ok.includes(c.r)) confermati.add(c.i);
}

let falsi = 0, veri = 0, persi = 0;
for (const c of conCandidato) {
  const si = confermati.has(c.i);
  const esito = si === c.atteso ? "ok   " : si ? "FALSO" : "perso";
  if (si && !c.atteso) falsi++;
  if (si && c.atteso) veri++;
  if (!si && c.atteso) persi++;
  console.log(`${esito} ✓${si ? "sì" : "no"} (regole: ${c.candidato ? "sì" : "no"}) [${c.r}] ${c.frase}`);
}
const attesiNo = casi.filter((c) => !c.atteso).length;
console.log(`\nFalsi ✓: ${falsi} su ${attesiNo} frasi che non devono dare ✓ · veri: ${veri} su ${casi.length - attesiNo} · persi: ${persi}`);
process.exit(falsi > 0 ? 1 : 0);
