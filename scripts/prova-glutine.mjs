// Prova della proposta 91 (28/11): recensioni → regole (src/lib/glutine.ts) → conferma dell'AI (src/lib/conferma-prove.ts,
// la stessa della produzione). Zero Google, nessuna scrittura. Casi: [{"t": "recensione 5★", "ok": true|false}] o
// [{"rs": ["recensione 1", "recensione 2"], "ok": ...}]; "ok" = deve comparire il ✓.
//   ANTHROPIC_API_KEY=$MAPETITE_ANTHROPIC_KEY node --experimental-strip-types --no-warnings scripts/prova-glutine.mjs scripts/prova-glutine-casi.json $PWD
import { readFileSync } from "fs";
const root = process.argv[3];
const gl = await import(root + "/src/lib/glutine.ts");
const { confermaProve } = await import(root + "/src/lib/conferma-prove.ts");
const casi = JSON.parse(readFileSync(process.argv[2], "utf8"));
const rev = (c) => (c.rs ?? [c.t]).map((t) => ({ text: t, rating: 5 }));
const cand = {}, nomi = {};
casi.forEach((c, i) => { const g = gl.glutineDalleRecensioni(rev(c)); if (g?.candidati?.length) { cand["L"+i] = g.candidati.map((x) => ({ r: gl.R_GLUTINE, prova: x.frase, contesto: x.contesto })); nomi["L"+i] = "Locale " + i; } });
const ids = Object.keys(cand); const out = {};
for (let k = 0; k < ids.length; k += 12) Object.assign(out, await confermaProve(Object.fromEntries(ids.slice(k, k+12).map((id) => [id, cand[id]])), nomi));
let f=0,p=0,v=0;
casi.forEach((c, i) => { const g0 = gl.glutineDalleRecensioni(rev(c)); const g = gl.glutineConfermato(g0, out["L"+i] ?? []); const tick = g?.stato === "bene";
  if (tick && !c.ok) f++; if (!tick && c.ok) p++; if (tick && c.ok) v++;
  console.log(`${tick === c.ok ? "  " : "XX"} regole=${g0?.stato} finale=${g?.stato} atteso=${c.ok?"✓":"no"} | ${(c.rs ?? [c.t]).join(" || ").slice(0,150)} => «${g?.frase}»`); });
console.log(`\n✓ giusti ${v}/${casi.filter(c=>c.ok).length}, ✓ falsi ${f}/${casi.filter(c=>!c.ok).length}, persi ${p}`);
