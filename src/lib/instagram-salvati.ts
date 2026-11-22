// Salvati di Instagram dal file di Meta (proposta 30): il file si legge NEL TELEFONO, non va mai al server.
// Meta esporta JSON o HTML (l'HTML è il formato predefinito) e traduce le etichette nella lingua
// dell'account ("Saved on", "Salvato il"…): per questo non si cercano chiavi precise, ma i link di
// Instagram ovunque nella struttura, con autore, data e raccolta presi da ciò che sta loro vicino.
// Formato inglese noto (non verificato su un file vero, 22/11):
//   saved_posts.json       {"saved_saved_media":[{"title":"autore","string_map_data":{"Saved on":{"href":…,"timestamp":…}}}]}
//   saved_collections.json {"saved_saved_collections":[{"title":"Collection","string_map_data":{"Name":{"value":"Roma food"}}},
//                           {"string_map_data":{"Name":{"value":"autore","href":…},"Added Time":{"timestamp":…}}}, …]}
// Niente import: si prova anche da Node (scripts/e2e/giro.mjs).

export type IgTipo = "reel" | "p" | "tv";
export type IgSalvato = {
  codice: string; // codice del post (instagram.com/reel/CODICE/): chiave senza doppioni
  url: string; // link pulito https://www.instagram.com/reel/CODICE/
  tipo: IgTipo;
  autore: string | null; // nome utente senza "@"
  salvatoIl: number | null; // millisecondi
  raccolte: string[];
};
export type IgParse = { items: IgSalvato[]; raccolte: string[] };

const IG_LINK = /https?:\/\/(?:www\.|m\.)?instagram\.com\/(?:[A-Za-z0-9._]+\/)?(reels?|p|tv)\/([A-Za-z0-9_-]{5,})/i;
const IG_LINK_G = new RegExp(IG_LINK.source, "gi");
const USERNAME = /^@?[A-Za-z0-9._]{1,30}$/;

function linkOf(s: string): { codice: string; tipo: IgTipo; url: string } | null {
  const m = s.match(IG_LINK);
  if (!m) return null;
  const tipo: IgTipo = m[1].toLowerCase().startsWith("reel") ? "reel" : (m[1].toLowerCase() as IgTipo);
  return { codice: m[2], tipo, url: `https://www.instagram.com/${tipo}/${m[2]}/` };
}

// Meta scrive i caratteri accentati come byte UTF-8 letti come Latin-1 ("CaffÃ¨"): si rimettono a posto.
export function fixMojibake(s: string): string {
  if (!/[\u00c2-\u00f4][\u0080-\u00bf]/.test(s) || [...s].some((c) => c.charCodeAt(0) > 255)) return s;
  try {
    const bytes = Uint8Array.from(s, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch { return s; }
}

const clean = (s: string) => fixMojibake(s).replace(/\s+/g, " ").trim();

function asAutore(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const t = clean(s);
  if (!t || IG_LINK.test(t) || /^https?:/i.test(t)) return null;
  return USERNAME.test(t) ? t.replace(/^@/, "") : null;
}

// Secondi o millisecondi → millisecondi; solo date plausibili (2010–2100).
function asTime(n: unknown): number | null {
  const x = typeof n === "string" && /^\d{9,13}$/.test(n) ? Number(n) : n;
  if (typeof x !== "number" || !Number.isFinite(x)) return null;
  const ms = x > 1e12 ? x : x * 1000;
  return ms > 1262304000000 && ms < 4102444800000 ? ms : null;
}

const TIME_KEY = /time|timestamp|date|data|ora|fecha|zeit|datum|heure/i;

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);

// Quanti link di Instagram DIVERSI ci sono dentro (si conta fino a 2: basta sapere se è uno solo). Revisore 22/11:
// nel formato con label_values lo stesso link sta in "value" e in "href", e contarlo due volte perdeva autore e data.
function countLinks(x: unknown): number {
  const visti = new Set<string>();
  const giro = (y: unknown, depth: number): void => {
    if (depth > 8 || visti.size >= 2) return;
    if (typeof y === "string") { const m = y.match(IG_LINK); if (m) visti.add(m[2]); return; }
    for (const z of Array.isArray(y) ? y : isObj(y) ? Object.values(y) : []) giro(z, depth + 1);
  };
  giro(x, 0);
  return Math.min(visti.size, 2);
}
const hasLink = (x: unknown) => countLinks(x) > 0;

// Primo numero che sembra una data dentro l'oggetto (chiave "timestamp", "Added Time", "Salvato il"…).
function findTime(x: unknown, depth = 0): number | null {
  if (depth > 4 || !isObj(x)) return null;
  for (const [k, v] of Object.entries(x)) {
    if (TIME_KEY.test(k)) { const t = asTime(v); if (t) return t; }
  }
  for (const v of Object.values(x)) {
    const t = isObj(v) ? findTime(v, depth + 1) : Array.isArray(v) ? v.map((y) => findTime(y, depth + 1)).find(Boolean) ?? null : null;
    if (t) return t;
  }
  return null;
}

// Nome dell'autore vicino al link: "value" accanto all'href, "title" della voce, o un'etichetta
// "Username"/"Nome utente" (formato con label_values).
function findAutore(x: unknown, depth = 0): string | null {
  if (depth > 4) return null;
  if (Array.isArray(x)) { for (const y of x) { const a = findAutore(y, depth + 1); if (a) return a; } return null; }
  if (!isObj(x)) return null;
  for (const k of ["title", "value", "username", "author", "owner", "autore"]) {
    const a = asAutore(x[k]);
    if (a && !(k === "value" && typeof x.label === "string" && !/user|utente|autor|owner|nome|name/i.test(x.label))) return a;
  }
  for (const v of Object.values(x)) {
    if (isObj(v) || Array.isArray(v)) { const a = findAutore(v, depth + 1); if (a) return a; }
  }
  return null;
}

// Nome di una raccolta nell'intestazione ("Name": {"value": "Roma food"}): il primo "value" testuale,
// altrimenti il titolo (che di solito è solo "Collection"/"Raccolta").
function findNome(x: unknown, depth = 0): string | null {
  if (depth > 4 || !isObj(x)) return null;
  if (typeof x.value === "string" && clean(x.value)) return clean(x.value).slice(0, 40);
  for (const v of Object.values(x)) {
    const n = isObj(v) ? findNome(v, depth + 1) : null;
    if (n) return n;
  }
  return typeof x.title === "string" && clean(x.title) ? clean(x.title).slice(0, 40) : null;
}

type Raw = { link: string; autore: string | null; time: number | null; raccolta: string | null };

const COLLECTION = /collection|raccolt|colecci|cole[cç][aã]o|sammlung/i;

function walkJson(x: unknown, out: Raw[], ctx: Obj[], raccolta: string | null, collections: boolean, depth = 0) {
  if (depth > 12) return;
  if (Array.isArray(x)) {
    // Nel file delle raccolte, una voce senza link seguita da voci con link è l'intestazione della raccolta.
    let current = raccolta;
    for (const y of x) {
      if (collections && isObj(y) && !hasLink(y) && ("title" in y || "string_map_data" in y)) { const n = findNome(y); if (n) current = n; continue; }
      walkJson(y, out, ctx, current, collections, depth + 1);
    }
    return;
  }
  if (!isObj(x)) return;
  let found = false;
  for (const v of Object.values(x)) {
    if (typeof v === "string" && IG_LINK.test(v) && !found) {
      found = true;
      // Autore e data: prima nell'oggetto del link, poi salendo verso la voce (al massimo 3 livelli),
      // mai in un contenitore con altri link (sarebbero dati di un altro post).
      const near = [x, ...ctx.slice(-3).reverse().filter((o) => countLinks(o) === 1)];
      const autore = near.map((o) => findAutore(o)).find(Boolean) ?? null;
      const time = near.map((o) => findTime(o)).find(Boolean) ?? null;
      out.push({ link: v, autore, time, raccolta });
    }
  }
  for (const [k, v] of Object.entries(x)) {
    if (isObj(v) || Array.isArray(v)) walkJson(v, out, [...ctx, x], raccolta, collections || COLLECTION.test(k), depth + 1);
  }
}

// ---- HTML ----

const MESI: Record<string, number> = {
  jan: 0, gen: 0, ene: 0, janv: 0, jän: 0, feb: 1, fév: 1, fev: 1, mar: 2, mär: 2, apr: 3, avr: 3, abr: 3,
  may: 4, mag: 4, mai: 4, jun: 5, giu: 5, juin: 5, jul: 6, lug: 6, juil: 6, aug: 7, ago: 7, aoû: 7, aou: 7,
  sep: 8, set: 8, oct: 9, ott: 9, okt: 9, out: 9, nov: 10, dec: 11, dic: 11, déc: 11, dez: 11,
};

/** "Nov 3, 2023 9:15 pm", "3 nov 2023, 21:15", "2023-11-03 21:15" → millisecondi (ora locale). */
export function parseDataTesto(s: string): number | null {
  const t = s.toLowerCase();
  const iso = t.match(/(20\d\d)-(\d\d)-(\d\d)(?:[ t](\d\d):(\d\d))?/);
  let y: number, mo: number, d: number;
  if (iso) { y = +iso[1]; mo = +iso[2] - 1; d = +iso[3]; }
  else {
    const mese = t.match(/\b([a-zàâäéèêëîïôöûüç]{3,5})\.?\b/g)?.map((w) => w.replace(".", "")).find((w) => MESI[w] != null || MESI[w.slice(0, 3)] != null);
    const anno = t.match(/\b(20\d\d)\b/);
    if (!mese || !anno) return null;
    mo = MESI[mese] ?? MESI[mese.slice(0, 3)];
    y = +anno[1];
    const giorno = t.replace(anno[0], " ").match(/\b(\d{1,2})\b/);
    if (!giorno) return null;
    d = +giorno[1];
  }
  const hm = t.match(/\b(\d{1,2})[:.](\d\d)\s*(am|pm)?\b/);
  let h = hm ? +hm[1] : 0;
  if (hm?.[3] === "pm" && h < 12) h += 12;
  if (hm?.[3] === "am" && h === 12) h = 0;
  const ms = new Date(y, mo, d, h, hm ? +hm[2] : 0).getTime();
  return asTime(ms);
}

const htmlText = (s: string) => clean(s.replace(/<[^>]+>/g, " ")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, " ")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)));

// Ogni voce di Meta è un riquadro con un titolo (<h2>, l'autore) e una tabella (etichetta · link · data).
// Nel file delle raccolte, un titolo con la cella "Name"/"Nome" prima di un link è l'intestazione della raccolta.
const NAME_LABEL = /^(name|nome|nombre|nom|titolo|title)$/i;
const cellsOf = (s: string) => [...s.matchAll(/<(td|div|span)\b[^>]*>((?:(?!<(?:td|div|span|tr|table)\b)[\s\S])*?)<\/\1>/gi)].map((m) => htmlText(m[2])).filter(Boolean);

function fromHtml(html: string, out: Raw[]) {
  const body = html.replace(/<(script|style|head)\b[\s\S]*?<\/\1>/gi, " ");
  const isCollectionFile = COLLECTION.test(html.slice(0, 3000));
  const links = [...body.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].filter((m) => IG_LINK.test(m[1].replace(/&amp;/g, "&")));
  let raccolta: string | null = null;
  let prevEnd = 0;
  for (let i = 0; i < links.length; i++) {
    const m = links[i];
    const start = m.index ?? 0;
    const end = start + m[0].length;
    const segment = body.slice(prevEnd, start);
    prevEnd = end;
    // Ultimo titolo prima del link (dopo il link precedente).
    const heads = [...segment.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)];
    const lastHead = heads[heads.length - 1];
    const title = lastHead ? htmlText(lastHead[1]) : "";
    if (isCollectionFile && lastHead) {
      const cells = cellsOf(segment.slice((lastHead.index ?? 0) + lastHead[0].length));
      const iName = cells.findIndex((c) => NAME_LABEL.test(c));
      // Intestazione: c'è il nome della raccolta in una cella sua (non è la riga del link, che ha "Name" come ultima cella).
      if (iName >= 0 && iName + 1 < cells.length) raccolta = cells[iName + 1].slice(0, 40);
      else if (!asAutore(title) && title && !COLLECTION.test(title)) raccolta = title.slice(0, 40);
    }
    const before = cellsOf(segment).pop() ?? "";
    const autore = asAutore(htmlText(m[2])) ?? (isCollectionFile ? null : asAutore(title)) ?? asAutore(before);
    // Data: il testo dopo il link, fino al titolo o al link successivo.
    const next = i + 1 < links.length ? links[i + 1].index ?? body.length : body.length;
    const tail = body.slice(end, next);
    const cut = tail.search(/<h[1-3][\s>]/i);
    const after = htmlText(cut >= 0 ? tail.slice(0, cut) : tail);
    const dateText = after.match(/[^·|]{0,60}?\b20\d\d\b[^·|]{0,20}/)?.[0] ?? after;
    out.push({ link: m[1].replace(/&amp;/g, "&"), autore, time: parseDataTesto(dateText), raccolta: isCollectionFile ? raccolta : null });
  }
  // Ultima rete: link scritti come testo semplice, senza <a>.
  if (out.length === 0) for (const m of body.matchAll(IG_LINK_G)) out.push({ link: m[0], autore: null, time: null, raccolta: null });
}

/** Legge uno o più file (JSON o HTML) del download di Instagram; unisce, toglie i doppioni, ordina dal più recente. */
export function parseInstagram(files: { name: string; text: string }[]): IgParse {
  const raws: Raw[] = [];
  for (const f of files) {
    const t = f.text.replace(/^﻿/, "").trimStart();
    if (t.startsWith("{") || t.startsWith("[")) {
      try { walkJson(JSON.parse(t), raws, [], null, COLLECTION.test(f.name.replace(/^.*[\\/]/, ""))); continue; } catch { /* non è JSON: si prova come testo */ }
    }
    fromHtml(f.text, raws);
  }
  const byCode = new Map<string, IgSalvato>();
  for (const r of raws) {
    const l = linkOf(r.link);
    if (!l) continue;
    const prev = byCode.get(l.codice);
    if (prev) {
      if (!prev.autore && r.autore) prev.autore = r.autore;
      if (r.time && (!prev.salvatoIl || r.time > prev.salvatoIl)) prev.salvatoIl = r.time;
      if (r.raccolta && !prev.raccolte.includes(r.raccolta)) prev.raccolte.push(r.raccolta);
      continue;
    }
    byCode.set(l.codice, { ...l, autore: r.autore, salvatoIl: r.time, raccolte: r.raccolta ? [r.raccolta] : [] });
  }
  const items = [...byCode.values()].sort((a, b) => (b.salvatoIl ?? 0) - (a.salvatoIl ?? 0));
  const count = new Map<string, number>();
  for (const it of items) for (const c of it.raccolte) count.set(c, (count.get(c) ?? 0) + 1);
  const raccolte = [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "it")).map(([c]) => c);
  return { items, raccolte };
}

/** File del download da leggere (dentro lo zip): i JSON/HTML che parlano di salvati. */
export const IG_FILE_SALVATI = /(saved|salvat|guardad|enregistr|gespeichert)[^/]*\.(json|html?)$/i;
