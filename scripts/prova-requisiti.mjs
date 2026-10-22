// Collaudo dei "✓ terrazza" (doppia chiave, 23/10): frasi di prova → regole (src/lib/prova-requisito.ts)
// → conferma dell'AI (src/lib/conferma-prove.ts, la STESSA funzione della produzione). Nessuna chiamata
// Google, nessuna scrittura nel database.
//   ANTHROPIC_API_KEY=$MAPETITE_ANTHROPIC_KEY node --experimental-strip-types --no-warnings scripts/prova-requisiti.mjs casi.json
// casi.json: [{ "r": "terrazza", "frase": "…", "atteso": false, "nome": "Da Mario" (facoltativo), "voto": 5 (facoltativo),
//   "recensione": "testo intero, se la frase è un pezzo di una recensione più lunga" (facoltativo) }]
// In produzione arrivano all'AI al massimo 3 requisiti per locale e 12 locali per ricerca: qui i casi
// vanno a gruppi di 12, come una ricerca piena.
import { readFileSync } from "fs";
const { requisitiProvati } = await import("../src/lib/prova-requisito.ts");
const { confermaProve } = await import("../src/lib/conferma-prove.ts");

const casi = JSON.parse(readFileSync(process.argv[2], "utf8"));

// 1. Regole, come nel primo tempo della ricerca: la richiesta nomina il requisito.
const conCandidato = casi.map((c, i) => {
  const testo = c.recensione ?? c.frase;
  const [cand] = requisitiProvati([c.r], `ristorante ${c.r}`, [{ text: testo, rating: c.voto ?? 5 }], c.nome ?? "");
  return { ...c, i, cand: cand ?? null };
});

// 2. AI: a gruppi di 12 locali (una ricerca), ognuno con il suo candidato.
const confermati = new Set();
const daAI = conCandidato.filter((c) => c.cand);
for (let k = 0; k < daAI.length; k += 12) {
  const batch = daAI.slice(k, k + 12);
  const out = await confermaProve(Object.fromEntries(batch.map((c) => [`T${c.i}`, [c.cand]])), Object.fromEntries(batch.map((c) => [`T${c.i}`, c.nome ?? `Osteria ${c.i}`])));
  for (const c of batch) if (out[`T${c.i}`]?.length) confermati.add(c.i);
}

let falsi = 0, veri = 0, persi = 0;
for (const c of conCandidato) {
  const si = confermati.has(c.i);
  const esito = si === c.atteso ? "ok   " : si ? "FALSO" : "perso";
  if (si && !c.atteso) falsi++;
  if (si && c.atteso) veri++;
  if (!si && c.atteso) persi++;
  console.log(`${esito} ✓${si ? "sì" : "no"} (regole: ${c.cand ? "sì" : "no"}) [${c.r}] ${c.frase}`);
}
const attesiNo = casi.filter((c) => !c.atteso).length;
console.log(`\nFalsi ✓: ${falsi} su ${attesiNo} frasi che non devono dare ✓ · veri: ${veri} su ${casi.length - attesiNo} · persi: ${persi}`);
process.exit(falsi > 0 ? 1 : 0);
