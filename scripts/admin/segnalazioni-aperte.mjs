// Proposta 82, minore (24/11): Apple vuole che le segnalazioni sui contenuti degli utenti si decidano
// entro 24 ore. Ogni sessione notturna lo lancia all'inizio; se ce n'è almeno una ancora da decidere,
// la notifica a Lorenzo lo dice per prima ("N segnalazioni da decidere in /admin/numeri").
// Sola lettura, con l'API di gestione Supabase: SUPABASE_ACCESS_TOKEN=… node scripts/admin/segnalazioni-aperte.mjs
// Non stampa mai testi, nomi o id degli utenti: solo quante sono, il tipo, il motivo e da quante ore aspettano.
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("Manca SUPABASE_ACCESS_TOKEN.");
  process.exit(2);
}
const api = "https://api.supabase.com/v1/projects";
const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const ref = process.env.SUPABASE_PROJECT_REF ?? (await (await fetch(api, { headers: h })).json()).find((p) => p.name === "mapetite")?.id;
if (!ref) {
  console.error("Progetto Supabase 'mapetite' non trovato.");
  process.exit(2);
}
const query = `select tipo, motivo, floor(extract(epoch from now() - created_at) / 3600)::int as ore
  from public.contenuti_segnalati where esito is null order by created_at limit 50`;
const r = await fetch(`${api}/${ref}/database/query/read-only`, { method: "POST", headers: h, body: JSON.stringify({ query }) });
if (!r.ok) {
  console.error(`Lettura non riuscita (${r.status}).`);
  process.exit(2);
}
const righe = await r.json();
if (righe.length === 0) {
  console.log("Segnalazioni da decidere: 0");
  process.exit(0);
}
const vecchie = righe.filter((x) => x.ore >= 20).length;
console.log(`Segnalazioni da decidere: ${righe.length}${vecchie ? ` (${vecchie} da almeno 20 ore: scadono le 24 ore di Apple)` : ""}`);
for (const x of righe) console.log(`- ${x.tipo} · ${x.motivo} · da ${x.ore} ore`);
process.exit(1);
