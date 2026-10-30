import { NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { canaleDaUrl, trovaCanale, type Canale } from "@/lib/canale-prenotazione";

// GET ?u=<sito del locale da Google> → { canale } con il modulo di prenotazione (TheFork, Quandoo…)
// se il sito lo mostra, altrimenti { canale: null }. Una sola pagina letta (la home del locale), solo
// quando la persona apre "Prenota": nessuna chiamata Google, niente salvato sul server oltre a una
// memoria di 12 ore del risultato. Non è scraping di contenuti: si cerca solo il link di prenotazione
// che il locale stesso pubblica. Protezioni: solo http(s) su porte standard, mai indirizzi interni
// (anche dopo un reindirizzamento), 3 secondi, 600 KB.

const NO_STORE = { headers: { "Cache-Control": "private, max-age=3600" } };
const MAX_BYTES = 600_000;
const TIMEOUT_MS = 3000;
const memoria = new Map<string, { canale: Canale | null; at: number }>();
const DURATA = 12 * 3600_000;

function privato(ip: string): boolean {
  if (isIP(ip) === 6) {
    const x = ip.toLowerCase();
    if (x === "::1" || x === "::" || x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe80")) return true;
    const v4 = x.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return v4 ? privato(v4[1]) : false;
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

async function sicuro(u: URL): Promise<boolean> {
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  if (u.port && u.port !== "80" && u.port !== "443") return false;
  if (u.username || u.password) return false;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return !privato(host);
  if (!host.includes(".") || /\.(?:local|internal|localhost)$/i.test(host)) return false;
  try {
    const ips = await lookup(host, { all: true });
    return ips.length > 0 && ips.every((x) => !privato(x.address));
  } catch {
    return false;
  }
}

async function leggi(start: URL): Promise<{ html: string; url: string } | null> {
  let u = start;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    for (let salti = 0; salti < 3; salti++) {
      if (!(await sicuro(u))) return null;
      const r = await fetch(u, { redirect: "manual", signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; Mapetite/1.0; +https://mapetite-web.vercel.app)", Accept: "text/html" } });
      if (r.status >= 300 && r.status < 400) {
        const loc = r.headers.get("location");
        if (!loc) return null;
        u = new URL(loc, u);
        // Il sito rimanda direttamente al modulo di una piattaforma: è quello il canale.
        if (canaleDaUrl(u.toString())) return { html: "", url: u.toString() };
        continue;
      }
      if (!r.ok || !(r.headers.get("content-type") ?? "").includes("text/html") || !r.body) return null;
      const reader = r.body.getReader();
      const parti: Uint8Array[] = [];
      let n = 0;
      while (n < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        parti.push(value);
        n += value.length;
      }
      reader.cancel().catch(() => {});
      return { html: new TextDecoder().decode(Buffer.concat(parti)), url: u.toString() };
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("u")?.trim() ?? "";
  let u: URL;
  try { u = new URL(raw); } catch { return NextResponse.json({ canale: null }, { status: 400 }); }
  if (raw.length > 500) return NextResponse.json({ canale: null }, { status: 400 });
  const diretto = canaleDaUrl(raw);
  if (diretto) return NextResponse.json({ canale: diretto }, NO_STORE);
  const chiave = `${u.hostname}${u.pathname}`;
  const m = memoria.get(chiave);
  if (m && Date.now() - m.at < DURATA) return NextResponse.json({ canale: m.canale }, NO_STORE);
  const pagina = await leggi(u);
  const canale = pagina ? canaleDaUrl(pagina.url) ?? trovaCanale(pagina.html, pagina.url) : null;
  if (memoria.size > 2000) memoria.clear();
  memoria.set(chiave, { canale, at: Date.now() });
  return NextResponse.json({ canale }, NO_STORE);
}
