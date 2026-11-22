// Lettore di file .zip nel telefono, senza librerie (DecompressionStream del browser): lo usano il file
// di Google Maps (.kmz di My Maps) e quello dei salvati di Instagram. Niente import: si prova anche da Node.
// Legge l'indice in fondo allo zip (sempre con le dimensioni giuste); se manca, scorre i record in ordine.

export type ZipText = { name: string; text: string };

type Entry = { name: string; method: number; offset: number; size: number; full: number };

// Tetto per ogni file estratto (revisore 22/11: zip che si gonfia a centinaia di MB chiudeva la pagina).
const MAX_TESTO = 15 * 1024 * 1024;

function fromCentralDirectory(v: DataView, bytes: Uint8Array): Entry[] | null {
  // Fine dell'indice: firma 0x06054b50 negli ultimi 64 KB (dopo può esserci un commento).
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return null;
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const out: Entry[] = [];
  for (let n = 0; n < count && p + 46 <= bytes.length && v.getUint32(p, true) === 0x02014b50; n++) {
    const method = v.getUint16(p + 10, true);
    const size = v.getUint32(p + 20, true);
    const full = v.getUint32(p + 24, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    if (local + 30 <= bytes.length && v.getUint32(local, true) === 0x04034b50) {
      const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
      out.push({ name, method, offset: start, size, full });
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

function fromLocalHeaders(v: DataView, bytes: Uint8Array): Entry[] {
  const out: Entry[] = [];
  let i = 0;
  while (i + 30 <= bytes.length && v.getUint32(i, true) === 0x04034b50) {
    const method = v.getUint16(i + 8, true);
    const flags = v.getUint16(i + 6, true);
    let size = v.getUint32(i + 18, true);
    const full = v.getUint32(i + 22, true);
    const nameLen = v.getUint16(i + 26, true);
    const extraLen = v.getUint16(i + 28, true);
    const name = new TextDecoder().decode(bytes.subarray(i + 30, i + 30 + nameLen));
    const start = i + 30 + nameLen + extraLen;
    if ((flags & 8) && size === 0) {
      // Dimensione scritta dopo i dati: si cerca la firma del record successivo.
      let j = start;
      while (j + 4 <= bytes.length && v.getUint32(j, true) !== 0x08074b50 && v.getUint32(j, true) !== 0x04034b50 && v.getUint32(j, true) !== 0x02014b50) j++;
      size = j - start;
    }
    out.push({ name, method, offset: start, size, full });
    i = start + size + ((flags & 8) ? 16 : 0);
  }
  return out;
}

async function inflate(data: Uint8Array, method: number): Promise<string | null> {
  if (method === 0) return data.length > MAX_TESTO ? null : new TextDecoder().decode(data);
  if (method === 8 && typeof DecompressionStream !== "undefined") {
    // A pezzi, con un contatore: le dimensioni scritte nello zip possono mentire.
    const reader = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader();
    const parti: Uint8Array[] = [];
    let tot = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      tot += value.length;
      if (tot > MAX_TESTO) { await reader.cancel().catch(() => {}); return null; }
      parti.push(value);
    }
    const tutto = new Uint8Array(tot);
    let o = 0;
    for (const x of parti) { tutto.set(x, o); o += x.length; }
    return new TextDecoder().decode(tutto);
  }
  return null;
}

/** Testo dei file dello zip il cui nome rispetta `match` (al massimo `max`, ognuno sotto i 15 MB). */
export async function zipTextFiles(buf: ArrayBuffer, match: RegExp, max = 50): Promise<ZipText[]> {
  const v = new DataView(buf);
  const bytes = new Uint8Array(buf);
  const entries = fromCentralDirectory(v, bytes) ?? fromLocalHeaders(v, bytes);
  const out: ZipText[] = [];
  for (const e of entries) {
    if (out.length >= max) break;
    if (!match.test(e.name) || e.size > MAX_TESTO || e.full > MAX_TESTO) continue;
    try {
      const text = await inflate(bytes.slice(e.offset, e.offset + e.size), e.method);
      if (text != null) out.push({ name: e.name, text });
    } catch { /* file rovinato: si salta */ }
  }
  return out;
}
