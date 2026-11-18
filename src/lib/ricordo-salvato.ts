// Proposta 68 "L'avevi salvato perché…": quando un salvato riaffiora (es. "📌 A 300 m c'è X, che volevi provare"),
// torna con il suo ricordo: "«per il compleanno di Sara» · marzo". Prima il motivo, poi la data corta (revisore 18/11:
// a 390 px "Salvato a marzo · la tua nota: «per il …" perdeva proprio il ricordo).
// Solo cose già salvate dalla persona (data, nota, chi l'ha consigliato, reel collegato): mai inventato.
// Senza un motivo (nota, consiglio o reel) la riga non c'è: la sola data non dice perché.
// Senza import: il giro automatico la carica da sola con Node.

export type RicordoInput = {
  savedAt?: string | null;
  note?: string | null;
  consigliatoDa?: string | null;
  // Reel o video collegato al posto (contenuti_locali): fonte e link.
  reel?: { fonte: string; url: string } | null;
};

const NOTA_MAX = 40;

// Anno e mese sempre nel fuso di Roma, sia per il salvataggio sia per adesso (revisore 18/11: con il telefono in UTC
// il 1/1 a Roma diventava "gennaio" dell'anno prima).
const ROMA = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", year: "numeric", month: "long" });
function annoMese(d: Date): { anno: string; mese: string } {
  const parti = ROMA.formatToParts(d);
  return { anno: parti.find((p) => p.type === "year")?.value ?? "", mese: parti.find((p) => p.type === "month")?.value ?? "" };
}
function quando(savedAt: string | null | undefined, now: Date): string | null {
  if (!savedAt) return null;
  const d = new Date(savedAt);
  if (Number.isNaN(d.getTime()) || d.getTime() > now.getTime() + 60_000) return null;
  const a = annoMese(d), b = annoMese(now);
  if (!a.mese || !a.anno) return null;
  if (a.anno === b.anno && a.mese === b.mese) return "questo mese";
  return a.anno === b.anno ? a.mese : `${a.mese} ${a.anno}`;
}

// Nota tagliata a parola, mai a metà parola né su una parola vuota.
export function notaCorta(note: string): string {
  const t = note.replace(/[«»]/g, "\"").replace(/\s+/g, " ").trim();
  if (t.length <= NOTA_MAX) return t;
  const parole = t.slice(0, NOTA_MAX).replace(/\s+\S*$/, "").split(" ");
  while (parole.length > 1 && /^(e|ed|di|da|del|della|per|con|a|al|alla|il|la|lo|le|i|gli|un|una|in|su|che)$/i.test(parole[parole.length - 1])) parole.pop();
  return `${parole.join(" ").replace(/[,;:.]+$/, "")}…`;
}

// "@nome" solo se è scritto nel link (TikTok: tiktok.com/@nome/video/…). Instagram non lo mette nel link del reel.
function autoreDalLink(url: string): string | null {
  const m = /^https:\/\/(?:www\.|m\.)?tiktok\.com\/@([A-Za-z0-9._]{2,24})\//.exec(url);
  return m ? `@${m[1]}` : null;
}

export function motivoSalvato(r: RicordoInput): string | null {
  const nota = r.note?.trim();
  if (nota) return `«${notaCorta(nota)}»`;
  const da = r.consigliatoDa?.trim();
  if (da) return `te l'ha consigliato ${da}`;
  if (r.reel) {
    if (r.reel.fonte === "TikTok") {
      const chi = autoreDalLink(r.reel.url);
      return chi ? `dal video di ${chi} su TikTok` : "da un video TikTok";
    }
    if (r.reel.fonte === "Instagram") return "da un reel Instagram";
    if (r.reel.fonte === "YouTube") return "da un video YouTube";
  }
  return null;
}

export function ricordoSalvato(r: RicordoInput, now: Date = new Date()): string | null {
  const motivo = motivoSalvato(r);
  if (!motivo) return null;
  const q = quando(r.savedAt, now);
  const testo = `${motivo.charAt(0).toUpperCase()}${motivo.slice(1)}`;
  return q ? `${testo} · ${q}` : testo;
}
