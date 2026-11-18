// Proposta 67 "Da quando parla il verdetto": sotto il verdetto, una riga piccola che dice su quante
// recensioni Google si basa e di quando è la più recente. Solo dati veri: il numero di recensioni con
// testo davvero passate all'AI per quel verdetto e la data (publishTime ISO di Google) della più recente,
// salvati con il verdetto. Mai date relative salvate ("2 settimane fa" invecchia): mese e anno nel fuso
// di Roma, calcolati quando si mostra. Nessun import: il giro automatico carica questo file con Node.

const UN_ANNO_MS = 365 * 24 * 60 * 60 * 1000;

function meseAnnoRoma(d: Date): { mese: string; anno: string } | null {
  const parti = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", month: "long", year: "numeric" }).formatToParts(d);
  const mese = parti.find((p) => p.type === "month")?.value;
  const anno = parti.find((p) => p.type === "year")?.value;
  return mese && anno ? { mese: mese.toLowerCase(), anno } : null;
}

/** La riga sotto il verdetto, o null se manca un dato (mai stime). */
export function fraseFreschezza(
  dati: { n?: number | null; ultima?: string | null },
  now: Date = new Date(),
): string | null {
  const n = dati.n;
  if (typeof n !== "number" || !Number.isInteger(n) || n <= 0) return null;
  if (typeof dati.ultima !== "string" || dati.ultima.trim() === "") return null;
  const ultima = new Date(dati.ultima);
  const t = ultima.getTime();
  const adesso = now.getTime();
  if (!Number.isFinite(t) || !Number.isFinite(adesso) || t > adesso) return null;

  if (adesso - t > UN_ANNO_MS) {
    return n === 1
      ? "Recensione di oltre un anno fa: potrebbe essere cambiato"
      : "Recensioni di oltre un anno fa: potrebbe essere cambiato";
  }
  const quando = meseAnnoRoma(ultima);
  const oggi = meseAnnoRoma(now);
  if (!quando || !oggi) return null;
  const data = quando.anno === oggi.anno ? quando.mese : `${quando.mese} ${quando.anno}`;
  return n === 1
    ? `Da 1 recensione Google, di ${data}`
    : `Da ${n} recensioni Google, la più recente di ${data}`;
}

/** Numero e data più recente dalle recensioni passate all'AI (stesso ordine dei testi). */
export function freschezzaDa(
  testi: (string | null | undefined)[] | null | undefined,
  date: (string | null | undefined)[] | null | undefined,
): { n: number | null; ultima: string | null } {
  const conTesto = (testi ?? []).map((t, i) => ({ t, d: date?.[i] ?? null })).filter((x) => typeof x.t === "string" && x.t.trim() !== "");
  if (conTesto.length === 0) return { n: null, ultima: null };
  let ultima: string | null = null;
  let ultimaMs = -Infinity;
  for (const { d } of conTesto) {
    if (typeof d !== "string") continue;
    const ms = Date.parse(d);
    if (Number.isFinite(ms) && ms > ultimaMs) { ultimaMs = ms; ultima = new Date(ms).toISOString(); }
  }
  // Prudenza con i termini Google (3.2.3(b), "No Caching"): si salva solo mese e anno, non la data esatta.
  // A metà mese e a mezzogiorno UTC, così il mese resta lo stesso in ogni fuso. La riga mostra solo il mese.
  if (ultima) {
    const m = meseNumeroRoma(new Date(ultima));
    ultima = m ? `${m.anno}-${m.mese}-15T12:00:00.000Z` : null;
  }
  return { n: conTesto.length, ultima };
}
function meseNumeroRoma(d: Date): { anno: string; mese: string } | null {
  const parti = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit" }).formatToParts(d);
  const anno = parti.find((p) => p.type === "year")?.value, mese = parti.find((p) => p.type === "month")?.value;
  return anno && mese ? { anno, mese } : null;
}
