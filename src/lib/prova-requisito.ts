// "Come lo sai?" (proposta 18, 22/10): la frase di una recensione Google che conferma un requisito
// della richiesta ("✓ terrazza" → «Cena in terrazza al tramonto»). Solo copiata, mai riscritta:
// se nessuna frase contiene la parola, niente prova (il ✓ resta quello dell'AI).

const MAX = 140;
const VUOTE = new Set(["per", "con", "dei", "del", "della", "una", "uno"]);

// "romantico" → "romantic", "terrazza" → "terrazz": prende anche romantica, romantici, terrazze.
function radice(w: string): string {
  return w.length > 4 ? w.replace(/[aeio]$/, "") : w;
}

function normalizza(t: string): string {
  return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Negazioni vicine alla parola ("niente terrazza", "per niente romantico", "non c'è vista"): non è una prova.
const NEGAZIONE = /\b(non|niente|nessun[oa]?|senza|manca|mancava|mai)\b/;

// Recensioni con il voto (Google): la prova si cerca prima nelle 5 e 4 stelle, mai in quelle da 1-2
// (collaudo del 22/10: "✓ rooftop" mostrava la frase di una recensione da 1 stella).
export function provaRequisito(requisito: string, recensioni: { text: string; rating?: number | null }[] | null | undefined): string | null {
  const parole = normalizza(requisito).split(/\s+/).filter((w) => w.length >= 3 && !VUOTE.has(w));
  // "non turistico": una frase che contiene "turistico" direbbe spesso il contrario.
  if (parole.length === 0 || parole[0] === "non") return null;
  const radici = parole.map(radice).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const ordinate = [...(recensioni ?? [])].filter((r) => r.rating == null || r.rating >= 3).sort((a, b) => (b.rating ?? 3) - (a.rating ?? 3));
  for (const r of ordinate) {
    const frasi = r.text.split(/(?<=[.!?…])\s+|\n+/);
    for (const f of frasi) {
      const n = normalizza(f);
      if (!radici.every((x) => new RegExp(`\\b${x}`).test(n))) continue;
      // Negazione nelle 4 parole prima della parola trovata: si salta la frase.
      const prima = n.slice(0, n.search(new RegExp(`\\b${radici[0]}`))).split(/\s+/).slice(-5).join(" ");
      if (NEGAZIONE.test(prima)) continue;
      const pulita = f.trim().replace(/^[«"“]+|[»"”]+$/g, "");
      if (pulita.length < 12) continue;
      if (pulita.length <= MAX) return pulita;
      // Frase lunga: si taglia attorno alla parola trovata, con i puntini.
      const at = Math.max(0, normalizza(pulita).search(new RegExp(`\\b${radici[0]}`)) - 50);
      const pezzo = pulita.slice(at, at + MAX).replace(at > 0 ? /^\S*\s/ : /^$/, "").replace(/\s\S*$/, "");
      return `${at > 0 ? "…" : ""}${pezzo}…`;
    }
  }
  return null;
}

// Tipi di locale: non sono requisiti da confermare ("trattoria autentica" → resta solo "autentica").
const TIPI = /^(ristorant|trattori|osteri|pizzeri|enotec|bar|pub|caff|bistrot|locale|posto|cocktail)/;

// Etichetta pulita del requisito: solo parole scritte nella richiesta (stessa radice), senza il tipo
// di locale. null se ne resta fuori anche una (l'AI aggiungeva "vista" o "cucina romana" non chiesti).
export function requisitoDellaRichiesta(requisito: string, richiesta: string): string | null {
  const q = normalizza(richiesta);
  const parole = requisito.trim().toLowerCase().split(/\s+/).filter((w) => !TIPI.test(normalizza(w)));
  if (parole.length === 0 || parole.length > 2) return null;
  const tutte = parole.every((w) => VUOTE.has(w) || w === "non" || new RegExp(`\\b${radice(normalizza(w)).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(q));
  return tutte ? parole.join(" ") : null;
}
