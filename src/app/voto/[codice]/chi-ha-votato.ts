// "Giulia e Marco", "Giulia, Marco e altri 3": con nomi lunghi la riga non si taglia a metà di un nome
// senza dire quanti sono. I nomi lunghi si accorciano a 14 caratteri.
export function chiHaVotato(chi: string[]): string {
  // Con il conto ("e altri 28") i nomi si accorciano di più, così il numero resta sempre in vista.
  const max = chi.length > 2 ? 10 : 14;
  const corto = (n: string) => (n.length > max ? `${n.slice(0, max - 1).trimEnd()}…` : n);
  if (chi.length <= 2) return chi.map(corto).join(" e ");
  const altri = chi.length - 2;
  return `${corto(chi[0])}, ${corto(chi[1])} e ${altri === 1 ? "un altro" : `altri ${altri}`}`;
}
