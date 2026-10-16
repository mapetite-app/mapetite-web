// Posti in evidenza (sponsorizzati, piano 8.3) — SOLO DIMOSTRATIVO per il pannello del ristoratore.
// Non entra nei risultati veri della ricerca. La regola (VISIONE.md: mai contro la richiesta):
// un locale in evidenza compare solo se rispetta TUTTO quello che la persona ha chiesto
// (tipo di locale, zona, caratteristiche). Nel dubbio non compare. Funzioni pure, senza import.

export type Sponsor = { nome: string; tipi: string[]; zone: string[]; caratteristiche: string[] };
export type RicercaEsempio = { frase: string; tipo: string | null; zona: string | null; requisiti: string[] };
export type Verifica = { mostra: boolean; motivo: string };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function adattoAllaRicerca(sponsor: Sponsor, r: RicercaEsempio): Verifica {
  const tipi = sponsor.tipi.map(norm);
  if (r.tipo && norm(r.tipo) !== "qualsiasi locale" && !tipi.includes(norm(r.tipo))) {
    return { mostra: false, motivo: `Cercavi “${r.tipo}”: questo locale non lo è.` };
  }
  if (r.zona && !sponsor.zone.map(norm).includes(norm(r.zona))) {
    return { mostra: false, motivo: `Non è nella zona che hai chiesto (${r.zona}).` };
  }
  const car = sponsor.caratteristiche.map(norm);
  const manca = r.requisiti.filter((q) => !car.includes(norm(q)));
  if (manca.length > 0) {
    return { mostra: false, motivo: `Manca quello che hai chiesto: ${manca.join(", ")}.` };
  }
  const ok = r.requisiti.length > 0 ? `Rispetta tutto quello che hai chiesto: ${r.requisiti.join(", ")}.` : "È il tipo di locale che cercavi, nella tua zona.";
  return { mostra: true, motivo: ok };
}

// Esempio per /ristoratore/demo: lo stesso locale inventato del pannello d'esempio.
export const SPONSOR_DEMO: Sponsor = {
  nome: "Osteria del Quartiere",
  tipi: ["osteria", "trattoria", "ristorante"],
  zone: ["Pigneto", "Roma"],
  caratteristiche: ["cucina romana", "tavoli all'aperto", "pasta fatta in casa", "prezzi giusti", "non turistico"],
};

export const RICERCHE_DEMO: RicercaEsempio[] = [
  { frase: "Trattoria romana al Pigneto con tavoli fuori", tipo: "trattoria", zona: "Pigneto", requisiti: ["cucina romana", "tavoli all'aperto"] },
  { frase: "Sushi buono al Pigneto", tipo: "sushi", zona: "Pigneto", requisiti: [] },
  { frase: "Osteria romantica con terrazza", tipo: "osteria", zona: "Roma", requisiti: ["romantico", "terrazza"] },
];
