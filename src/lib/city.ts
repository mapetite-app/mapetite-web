// Città di un locale ricavata dall'indirizzo già salvato (voce 8): niente
// migrazione né campi Google in più. Formati gestiti:
//   "Via Po, 2/a, 00198 Roma RM, Italy" → "Roma"
//   "Via dei Vascellari 29, Roma"        → "Roma"
//   "75003 Paris, France"                → "Paris"
const COUNTRY = /^(italy|italia|france|francia|spain|españa|spagna|germany|deutschland|united kingdom|uk|portugal|switzerland|svizzera|schweiz)$/i;
const STREET = /^(via|viale|v\.|piazza|p\.za|piazzale|largo|corso|c\.so|vicolo|lungotevere|strada|contrada|località|loc\.)\s/i;

export function cityFromAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1 && COUNTRY.test(parts[parts.length - 1])) parts.pop();
  for (let i = parts.length - 1; i >= 0; i--) {
    const m = parts[i].match(/^\d{4,5}\s+(.+?)(?:\s+[A-Z]{2})?$/);
    if (m) return m[1];
  }
  const last = parts[parts.length - 1];
  if (!last || parts.length < 2 || STREET.test(last) || /\d/.test(last)) return null;
  return last;
}

// Indirizzo da mostrare: senza il paese in fondo ("…, 00198 Roma RM, Italy" → "…, 00198 Roma RM").
// Per i locali in Italia il paese è rumore (e spesso in inglese); il CAP resta, serve ai taxi.
export function displayAddress(address: string | null | undefined): string {
  if (!address) return "";
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1 && COUNTRY.test(parts[parts.length - 1])) parts.pop();
  return parts.join(", ");
}
