// Email di ripiego della richiesta di rivendica: si usa quando la tabella `claims` non esiste
// ancora (migrazione 20261015_ristoratori.sql da applicare) o quando chi scrive non ha fatto
// l'accesso. Stessi dati del modulo, già scritti: basta premere "Invia" nell'app di posta.
export const CONTACT = "founder.mapetite@gmail.com";

export type DatiRivendica = {
  localeNome: string;
  localeIndirizzo?: string | null;
  localeCitta?: string | null;
  localeId?: string | null;
  nome: string;
  ruolo: string;
  telefono: string;
  email: string;
  messaggio?: string | null;
};

export function mailRivendica(d: DatiRivendica): string {
  const righe = [
    "Buongiorno,",
    "vorrei verificare il mio locale su Mapetite.",
    "",
    `Locale: ${d.localeNome}`,
    d.localeIndirizzo ? `Indirizzo: ${d.localeIndirizzo}` : null,
    d.localeCitta ? `Città: ${d.localeCitta}` : null,
    d.localeId ? `Codice Mapetite: ${d.localeId}` : null,
    `Nome: ${d.nome}`,
    `Ruolo: ${d.ruolo}`,
    `Telefono: ${d.telefono}`,
    `Email: ${d.email}`,
    d.messaggio ? `\n${d.messaggio}` : null,
    "",
    "Grazie",
  ].filter((r): r is string => r !== null);
  return `mailto:${CONTACT}?subject=${encodeURIComponent(`Rivendica: ${d.localeNome}`)}&body=${encodeURIComponent(righe.join("\n"))}`;
}
