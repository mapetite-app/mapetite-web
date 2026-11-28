import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { cityFromAddress } from "@/lib/city";
import { ZONE, metri } from "@/lib/gusti";
import { MAX_AL_GIORNO, MAX_VOTANTI, PERSONE_MAX, PERSONE_MIN, RISPOSTE_FINO_MS, TAVOLO_GIORNI, UUID_RE, type Tavolo, type VotoPosto, type VotoStato } from "@/lib/voto-gruppo";

// "Manda al gruppo" (proposta 56), lato server. Tabelle voti_gruppo e voti_gruppo_voti (migrazione
// 20261121c): RLS senza policy, si leggono e si scrivono solo qui con la chiave di servizio.
// Dei locali si salvano solo gli UUID del catalogo; nome, zona e verdetto si leggono ogni volta da
// "places" e "place_synthesis" (come /locali/<id>). Nessuna chiamata a Google o all'AI.

export const VOTANTE_COOKIE = "mapetite_votante";

// Solo in sviluppo con E2E_FAKE_USER (giro automatico): sondaggi in memoria del server, niente database.
// I posti arrivano dal telefono già con nome e verdetto (solo qui: in produzione si leggono dal catalogo).
const dev = () => process.env.NODE_ENV === "development" && !!process.env.E2E_FAKE_USER;
type Finto = { codice: string; creatoDa: string; posti: VotoPosto[]; chiudeAlle: string; creato: string; voti: Map<string, { nome: string; posto: string }>; tavolo?: Tavolo | null; presenze?: Map<string, { nome: string; ciSono: boolean }> };
const g = globalThis as unknown as { __votiGruppoFinti?: Map<string, Finto> };
const finti = (): Map<string, Finto> => (g.__votiGruppoFinti ??= new Map<string, Finto>());

/** Codice del link: 18 caratteri casuali (circa 107 bit), non si indovina. */
export function nuovoCodice(): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const b = randomBytes(18);
  return Array.from(b, (x) => alfabeto[x % alfabeto.length]).join("");
}

/** Id del telefono che vota (cookie): casuale, mai legato a una persona. */
export function nuovoVotante(): string {
  return randomBytes(18).toString("base64url");
}

// Limitatore per indirizzo IP (come /api/prova-reel, in memoria della singola istanza): un freno, non un tetto.
const PER_ORA = { crea: 20, vota: 60 } as const;
const visti = new Map<string, number[]>();
export function permesso(azione: keyof typeof PER_ORA, chiave: string, now = Date.now()): boolean {
  const k = `${azione}|${chiave}`;
  const recenti = (visti.get(k) ?? []).filter((t) => now - t < 3_600_000);
  if (recenti.length >= PER_ORA[azione]) { visti.set(k, recenti); return false; }
  recenti.push(now);
  visti.set(k, recenti);
  if (visti.size > 5000) for (const [kk, ts] of visti) if (ts.every((t) => now - t >= 3_600_000)) visti.delete(kk);
  return true;
}

// Zona da mostrare: il quartiere se il locale è a due passi da uno noto (Roma, Milano), se no la città.
export function zonaDi(p: { lat: number | null; lng: number | null; address: string | null }): string | null {
  if (p.lat != null && p.lng != null) {
    let best: string | null = null;
    let bestM = 800;
    for (const z of ZONE) { const m = metri(z, { lat: p.lat, lng: p.lng }); if (m < bestM) { bestM = m; best = z.nome; } }
    if (best) return best;
  }
  return cityFromAddress(p.address);
}

// Dopo 30 giorni il voto non c'è più (nomi e id dei telefoni si cancellano: migrazione 20261121d).
const DURATA_MS = 30 * 86_400_000;
export function scaduto(creato: string, now: Date): boolean {
  return now.getTime() - new Date(creato).getTime() > DURATA_MS;
}

export type PostoInArrivo = { id: string; nome: string; categoria: string | null; indirizzo: string | null; lat: number | null; lng: number | null; verdetto: string | null };

/** Crea il sondaggio. "troppi" = tetto di MAX_AL_GIORNO in 24 ore raggiunto. */
export async function creaVoto(utente: string, posti: string[], chiudeAlle: Date, fintiPosti?: PostoInArrivo[]): Promise<string | "troppi" | "errore"> {
  const codice = nuovoCodice();
  if (dev()) {
    // Il tetto dei 10 al giorno è nel database (crea_voto_gruppo): qui no, il giro gira più volte di fila.
    finti().set(codice, {
      codice, creatoDa: utente, chiudeAlle: chiudeAlle.toISOString(), creato: new Date().toISOString(), voti: new Map(),
      posti: (fintiPosti ?? []).map((p) => ({ id: p.id, gid: UUID_RE.test(p.id) ? null : p.id, nome: p.nome, categoria: p.categoria, zona: zonaDi({ lat: p.lat, lng: p.lng, address: p.indirizzo }), lat: p.lat, lng: p.lng, verdetto: p.verdetto })),
    });
    return codice;
  }
  const { data, error } = await createAdminClient().rpc("crea_voto_gruppo", {
    p_utente: utente, p_codice: codice, p_posti: posti, p_chiude: chiudeAlle.toISOString(), p_tetto: MAX_AL_GIORNO,
  });
  if (error) { console.error(`[voto] creazione non riuscita ${error.code ?? ""} ${error.message}`); return "errore"; }
  return data ? codice : "troppi";
}

// Riassunto delle risposte a "Ci sei?": chi ha risposto (nome e sì/no) e quanti hanno votato senza rispondere.
function riassunto(votanti: string[], presenze: { votante: string; nome: string; ciSono: boolean }[], votante: string | null) {
  const risposto = new Set(presenze.map((p) => p.votante));
  return {
    presenze: presenze.map((p) => ({ nome: p.nome, ciSono: p.ciSono })),
    miaPresenza: votante ? presenze.find((p) => p.votante === votante)?.ciSono ?? null : null,
    senzaRisposta: votanti.filter((v) => !risposto.has(v)).length,
  };
}

/** Lo stato del sondaggio per chi guarda. null = non esiste. */
export async function leggiVoto(codice: string, viewer: string | null, votante: string | null, now = new Date()): Promise<VotoStato | null | "errore"> {
  if (dev()) {
    const f = finti().get(codice);
    if (!f || scaduto(f.creato, now)) return null;
    const voti = [...f.voti.values()];
    return {
      codice, chiudeAlle: f.chiudeAlle, chiuso: new Date(f.chiudeAlle) <= now, sonoIo: viewer === f.creatoDa, posti: f.posti,
      voti, mioVoto: votante ? f.voti.get(votante)?.posto ?? null : null, pieno: f.voti.size >= MAX_VOTANTI && !(votante && f.voti.has(votante)),
      tavolo: f.tavolo ?? null,
      ...riassunto([...f.voti.keys()], [...(f.presenze ?? new Map()).entries()].map(([k, x]) => ({ votante: k, ...x })), votante),
    };
  }
  const admin = createAdminClient();
  type Riga = { id: string; creato_da: string; posti: string[]; chiude_alle: string; created_at: string; tavolo_posto?: string | null; tavolo_alle?: string | null; tavolo_persone?: number | null };
  let { data: v, error } = await admin.from("voti_gruppo").select("id, creato_da, posti, chiude_alle, created_at, tavolo_posto, tavolo_alle, tavolo_persone").eq("codice", codice).maybeSingle<Riga>();
  // Migrazione 20261128b non ancora applicata: il voto si apre lo stesso, senza "Chi viene?".
  if (error?.code === "42703") ({ data: v, error } = await admin.from("voti_gruppo").select("id, creato_da, posti, chiude_alle, created_at").eq("codice", codice).maybeSingle<Riga>());
  if (error) { console.error(`[voto] lettura non riuscita ${error.code ?? ""} ${error.message}`); return "errore"; }
  if (!v || scaduto(v.created_at, now)) return null;
  const [{ data: luoghi, error: lErr }, { data: righe, error: vErr }, { data: pres, error: pErr }] = await Promise.all([
    admin.from("places").select("id, name, category, address, lat, lng, google_place_id").in("id", v.posti),
    admin.from("voti_gruppo_voti").select("votante, nome, posto, updated_at").eq("voto_id", v.id).order("updated_at", { ascending: true }).order("votante", { ascending: true }).limit(MAX_VOTANTI),
    v.tavolo_alle
      ? admin.from("voti_gruppo_presenze").select("votante, nome, ci_sono, updated_at").eq("voto_id", v.id).order("updated_at", { ascending: true }).order("votante", { ascending: true }).limit(MAX_VOTANTI)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (pErr) console.error(`[voto] lettura presenze non riuscita ${pErr.message}`);
  if (lErr || vErr) { console.error(`[voto] lettura posti/voti non riuscita ${(lErr ?? vErr)?.message}`); return "errore"; }
  type L = { id: string; name: string; category: string | null; address: string | null; lat: number | null; lng: number | null; google_place_id: string | null };
  const perId = new Map((luoghi as L[] ?? []).map((l) => [l.id, l]));
  const gids = [...perId.values()].flatMap((l) => (l.google_place_id ? [l.google_place_id] : []));
  // Il verdetto già in cache (place_synthesis), come la pagina pubblica del locale: mai scritto qui.
  const verdetti = new Map<string, string>();
  if (gids.length > 0) {
    const { data: s, error: sErr } = await admin.from("place_synthesis").select("place_id, verdict").in("place_id", gids);
    if (sErr) console.error(`[voto] lettura verdetti non riuscita ${sErr.message}`);
    for (const r of (s ?? []) as { place_id: string; verdict: string | null }[]) if (r.verdict?.trim()) verdetti.set(r.place_id, r.verdict.trim());
  }
  const posti: VotoPosto[] = v.posti.flatMap((id) => {
    const l = perId.get(id);
    return l ? [{ id, gid: l.google_place_id, nome: l.name, categoria: l.category, zona: zonaDi(l), lat: l.lat, lng: l.lng, verdetto: l.google_place_id ? verdetti.get(l.google_place_id) ?? null : null }] : [];
  });
  const voti = ((righe ?? []) as { votante: string; nome: string; posto: string }[]);
  return {
    codice, chiudeAlle: v.chiude_alle, chiuso: new Date(v.chiude_alle) <= now, sonoIo: viewer === v.creato_da, posti,
    voti: voti.map((r) => ({ posto: r.posto, nome: r.nome })),
    mioVoto: votante ? voti.find((r) => r.votante === votante)?.posto ?? null : null,
    pieno: voti.length >= MAX_VOTANTI && !(votante && voti.some((r) => r.votante === votante)),
    tavolo: v.tavolo_alle && v.tavolo_posto && v.tavolo_persone ? { posto: v.tavolo_posto, alle: v.tavolo_alle, persone: v.tavolo_persone } : null,
    ...riassunto(voti.map((r) => r.votante), ((pres ?? []) as { votante: string; nome: string; ci_sono: boolean }[]).map((r) => ({ votante: r.votante, nome: r.nome, ciSono: r.ci_sono })), votante),
  };
}

export type EsitoVoto = "ok" | "nessuno" | "chiuso" | "posto" | "pieno" | "errore";

export async function vota(codice: string, votante: string, nome: string, posto: string, now = new Date()): Promise<EsitoVoto> {
  if (dev()) {
    const f = finti().get(codice);
    if (!f) return "nessuno";
    if (new Date(f.chiudeAlle) <= now) return "chiuso";
    if (!f.posti.some((p) => p.id === posto)) return "posto";
    if (!f.voti.has(votante) && f.voti.size >= MAX_VOTANTI) return "pieno";
    f.voti.delete(votante); // il voto cambiato va in fondo, come l'ultimo arrivato
    f.voti.set(votante, { nome, posto });
    return "ok";
  }
  // In produzione i posti sono UUID del catalogo: altro testo è un posto che non è nel voto (400, non 500).
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(posto)) return "posto";
  const { data, error } = await createAdminClient().rpc("vota_gruppo", { p_codice: codice, p_votante: votante, p_nome: nome, p_posto: posto, p_tetto: MAX_VOTANTI });
  if (error) { console.error(`[voto] voto non riuscito ${error.code ?? ""} ${error.message}`); return "errore"; }
  return (["ok", "nessuno", "chiuso", "posto", "pieno"] as const).find((x) => x === data) ?? "errore";
}

export type EsitoTavolo = "ok" | "nessuno" | "tuo" | "aperto" | "posto" | "quando" | "errore";

/** Chi ha proposto fissa (o cambia) il tavolo prenotato sul posto vincitore. */
export async function segnaTavolo(codice: string, utente: string, posto: string, alle: Date, persone: number, now = new Date()): Promise<EsitoTavolo> {
  if (!Number.isInteger(persone) || persone < PERSONE_MIN || persone > PERSONE_MAX) return "quando";
  if (dev()) {
    const f = finti().get(codice);
    if (!f || scaduto(f.creato, now)) return "nessuno";
    if (f.creatoDa !== utente) return "tuo";
    if (new Date(f.chiudeAlle) > now) return "aperto";
    if (!f.posti.some((p) => p.id === posto)) return "posto";
    if (alle.getTime() < now.getTime() - 3_600_000 || alle.getTime() > new Date(f.creato).getTime() + TAVOLO_GIORNI * 86_400_000) return "quando";
    // Cambiati giorno o ora: le risposte date per l'altra data non valgono più.
    if (f.tavolo && (f.tavolo.alle !== alle.toISOString() || f.tavolo.posto !== posto)) f.presenze = new Map();
    f.tavolo = { posto, alle: alle.toISOString(), persone };
    return "ok";
  }
  if (!UUID_RE.test(posto)) return "posto";
  const { data, error } = await createAdminClient().rpc("segna_tavolo_gruppo", { p_utente: utente, p_codice: codice, p_posto: posto, p_alle: alle.toISOString(), p_persone: persone });
  if (error) { console.error(`[voto] tavolo non riuscito ${error.code ?? ""} ${error.message}`); return "errore"; }
  return (["ok", "nessuno", "tuo", "aperto", "posto", "quando"] as const).find((x) => x === data) ?? "errore";
}

export type EsitoPresenza = "ok" | "nessuno" | "senza" | "passato" | "pieno" | "errore";

/** "Ci sei? Sì / No" di un telefono (si può cambiare). */
export async function rispondi(codice: string, votante: string, nome: string, ciSono: boolean, now = new Date()): Promise<EsitoPresenza> {
  if (dev()) {
    const f = finti().get(codice);
    if (!f || scaduto(f.creato, now)) return "nessuno";
    if (!f.tavolo) return "senza";
    if (new Date(f.tavolo.alle).getTime() + RISPOSTE_FINO_MS < now.getTime()) return "passato";
    const pr = (f.presenze ??= new Map());
    if (!pr.has(votante) && pr.size >= MAX_VOTANTI) return "pieno";
    pr.delete(votante);
    pr.set(votante, { nome, ciSono });
    return "ok";
  }
  const { data, error } = await createAdminClient().rpc("presenza_gruppo", { p_codice: codice, p_votante: votante, p_nome: nome, p_ci_sono: ciSono, p_tetto: MAX_VOTANTI });
  if (error) { console.error(`[voto] presenza non riuscita ${error.code ?? ""} ${error.message}`); return "errore"; }
  return (["ok", "nessuno", "senza", "passato", "pieno"] as const).find((x) => x === data) ?? "errore";
}

/** Solo nel giro automatico: "adesso" spostato da un cookie, per vedere il voto chiuso senza aspettare. */
export function adessoPer(cookie: string | undefined): Date {
  if (dev() && cookie) {
    const d = new Date(cookie);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}
