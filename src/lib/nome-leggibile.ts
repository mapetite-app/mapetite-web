// Nomi scritti tutti in maiuscolo come arrivano da Google ("CASA ENCANTO ROMA"): accanto agli altri
// stonano e sembrano urlati (giro del 1/11, D24). Solo in visualizzazione: il nome vero resta quello
// di Google (firmato per il catalogo, usato per salvare e cercare).
const PICCOLE = new Set(["di", "da", "del", "dello", "della", "dei", "degli", "delle", "dal", "dalla", "al", "allo", "alla", "ai", "agli", "alle", "e", "ed", "in", "a", "con", "per", "su", "sul", "sulla", "the", "of", "and"]);

export function nomeLeggibile(name: string): string {
  const lettere = name.replace(/[^\p{L}]/gu, "");
  // Solo se è davvero tutto maiuscolo (e non una sigla corta come "BAU" o "MAD").
  if (lettere.length < 5 || lettere !== lettere.toLocaleUpperCase("it") || lettere === lettere.toLocaleLowerCase("it")) return name;
  let primo = true;
  return name.toLocaleLowerCase("it").replace(/[\p{L}\d]+/gu, (w, offset: number, all: string) => {
    const prima = all[offset - 1];
    const dopoApostrofo = prima === "'" || prima === "’";
    const out = !primo && !dopoApostrofo && PICCOLE.has(w) ? w : w.charAt(0).toLocaleUpperCase("it") + w.slice(1);
    primo = false;
    return out;
  });
}
