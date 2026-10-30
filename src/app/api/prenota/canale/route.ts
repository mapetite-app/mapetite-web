import { NextResponse } from "next/server";
import { lookup as dnsLookup } from "node:dns";
import { isIP, type LookupFunction } from "node:net";
import http from "node:http";
import https from "node:https";
import { canaleDaUrl, trovaCanale, type Canale } from "@/lib/canale-prenotazione";
import { clientKey } from "@/lib/ai-limit";

// GET ?u=<sito del locale da Google> → { canale } con il modulo di prenotazione (TheFork, Quandoo…)
// se il sito lo mostra, altrimenti { canale: null }. Una sola pagina letta (quella del locale), solo
// quando la persona apre "Prenota": nessuna chiamata Google, niente salvato sul server oltre a una
// memoria di 12 ore del risultato. Non è scraping di contenuti: si cerca solo il link di prenotazione
// che il locale stesso pubblica.
// Protezioni (collaudo del 30/10): solo http(s) su porte standard; solo indirizzi IPv4 pubblici, e la
// connessione va proprio all'indirizzo controllato (nessuna seconda risoluzione DNS); ogni
// reindirizzamento si ricontrolla; 3 secondi, 600 KB; 20 richieste al minuto per persona.

const CACHE = { headers: { "Cache-Control": "private, max-age=3600" } };
const MAX_BYTES = 600_000;
const TIMEOUT_MS = 3000;
const memoria = new Map<string, { canale: Canale | null; at: number }>();
const DURATA = 12 * 3600_000;
const richieste = new Map<string, number[]>();

function ipv4Pubblico(ip: string): boolean {
  if (isIP(ip) !== 4) return false; // IPv6 mai: troppe forme per nascondere un indirizzo interno
  const [a, b] = ip.split(".").map(Number);
  return !(a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)) || a >= 224);
}

// Risolve e controlla nello stesso passo in cui ci si collega: l'indirizzo usato è quello controllato.
const lookupSicuro: LookupFunction = (host, _opts, cb) => {
  dnsLookup(host, { family: 4, all: true }, (err, addrs) => {
    if (err) return cb(err, "", 4);
    const lista = addrs as { address: string; family: number }[];
    if (!lista.length || !lista.every((x) => ipv4Pubblico(x.address))) return cb(new Error("indirizzo non pubblico"), "", 4);
    cb(null, lista[0].address, 4);
  });
};

function urlAmmesso(u: URL): boolean {
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  if (u.port && u.port !== "80" && u.port !== "443") return false;
  if (u.username || u.password) return false;
  const host = u.hostname;
  if (host.startsWith("[")) return false;
  if (isIP(host)) return ipv4Pubblico(host);
  return host.includes(".") && !/\.(?:local|internal|localhost|lan)$/i.test(host);
}

type Risposta = { status: number; location: string | null; html: string | null };

function scarica(u: URL, fine: number): Promise<Risposta> {
  return new Promise((resolve, reject) => {
    const mod = u.protocol === "https:" ? https : http;
    const req = mod.get(u, { lookup: lookupSicuro, timeout: Math.max(200, fine - Date.now()), headers: { "User-Agent": "Mozilla/5.0 (compatible; Mapetite/1.0; +https://mapetite-web.vercel.app)", Accept: "text/html" } }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400) { res.resume(); return resolve({ status, location: res.headers.location ?? null, html: null }); }
      if (status !== 200 || !String(res.headers["content-type"] ?? "").includes("text/html")) { res.resume(); return resolve({ status, location: null, html: null }); }
      const parti: Buffer[] = [];
      let n = 0;
      res.on("data", (c: Buffer) => { parti.push(c); n += c.length; if (n >= MAX_BYTES) res.destroy(); });
      const chiudi = () => resolve({ status, location: null, html: Buffer.concat(parti).subarray(0, MAX_BYTES).toString("utf8") });
      res.on("end", chiudi);
      res.on("close", chiudi);
      res.on("error", chiudi);
    });
    req.on("timeout", () => req.destroy(new Error("tempo scaduto")));
    req.on("error", reject);
  });
}

async function leggi(start: URL): Promise<{ html: string; url: string } | null> {
  const fine = Date.now() + TIMEOUT_MS;
  let u = start;
  try {
    for (let salti = 0; salti < 3 && Date.now() < fine; salti++) {
      if (!urlAmmesso(u)) return null;
      const r = await scarica(u, fine);
      if (r.location) {
        u = new URL(r.location, u);
        // Il sito rimanda direttamente al modulo di una piattaforma: è quello il canale.
        if (canaleDaUrl(u.toString())) return { html: "", url: u.toString() };
        continue;
      }
      return r.html != null ? { html: r.html, url: u.toString() } : null;
    }
    return null;
  } catch {
    return null;
  }
}

function troppe(chi: string): boolean {
  const ora = Date.now();
  const v = (richieste.get(chi) ?? []).filter((t) => ora - t < 60_000);
  v.push(ora);
  richieste.set(chi, v);
  if (richieste.size > 5000) richieste.clear();
  return v.length > 20;
}

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("u")?.trim() ?? "";
  let u: URL;
  try { u = new URL(raw); } catch { return NextResponse.json({ canale: null }, { status: 400 }); }
  if (raw.length > 500) return NextResponse.json({ canale: null }, { status: 400 });
  const diretto = canaleDaUrl(raw);
  if (diretto) return NextResponse.json({ canale: diretto }, CACHE);
  const chiave = `${u.hostname}${u.pathname}`;
  const m = memoria.get(chiave);
  if (m && Date.now() - m.at < DURATA) return NextResponse.json({ canale: m.canale }, CACHE);
  if (troppe(clientKey(request))) return NextResponse.json({ canale: null }, { status: 429 });
  const pagina = await leggi(u);
  const canale = pagina ? canaleDaUrl(pagina.url) ?? trovaCanale(pagina.html, pagina.url) : null;
  if (memoria.size > 2000) memoria.clear();
  memoria.set(chiave, { canale, at: Date.now() });
  return NextResponse.json({ canale }, CACHE);
}
