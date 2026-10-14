// "bar" è il tipo principale generico di Google (in Italia è anche il caffè sotto casa): quando
// Google stesso lo segna anche come cocktail bar tra gli altri tipi, si usa quello. Solo cocktail bar:
// "wine_bar" compare anche su lounge d'albergo (Mandarin Garden) e l'etichetta "Enoteca" sarebbe forzata.
// Visto il 14/10: in "cocktail bar nascosto a Milano" The Doping Milan e Salmon Guru (cocktail_bar
// tra i tipi) avevano il boccale di birra 🍺 e l'etichetta "Bar". Solo dati Google, nessuna ipotesi.
// Il bar che è anche caffetteria o pasticceria resta "bar": è il bar italiano che la sera fa cocktail,
// e da cocktail bar finirebbe in fondo alle ricerche di colazione (src/lib/off-type.ts).
const DAYTIME = ["cafe", "coffee_shop", "breakfast_restaurant", "bakery", "pastry_shop", "brunch_restaurant"];
export function refineCategory(primaryType: string | null, types: string[] | null): string | null {
  if (primaryType !== "bar" || !types || types.some((t) => DAYTIME.includes(t))) return primaryType;
  return types.includes("cocktail_bar") ? "cocktail_bar" : primaryType;
}
