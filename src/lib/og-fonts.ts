// Poppins per le immagini da condividere (carta del gusto, anno a tavola).
type Font = { name: string; data: ArrayBuffer; weight: 400 | 600 | 700; style: "normal" };
// Poppins dal servizio Google Fonts (licenza libera), una volta per processo; se la rete
// non risponde si usa il carattere predefinito e l'immagine esce lo stesso.
let fontsPromise: Promise<Font[]> | null = null;
async function loadFont(weight: 400 | 600 | 700): Promise<Font> {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Poppins:wght@${weight}`, { signal: AbortSignal.timeout(2500) })).text();
  const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
  if (!url) throw new Error("font non trovato");
  const data = await (await fetch(url, { signal: AbortSignal.timeout(2500) })).arrayBuffer();
  return { name: "Poppins", data, weight, style: "normal" };
}
export function fonts(): Promise<Font[]> {
  if (!fontsPromise) {
    fontsPromise = Promise.all([loadFont(400), loadFont(600), loadFont(700)]).catch((e) => {
      console.error("[og-fonts] Poppins non disponibile:", e instanceof Error ? e.message : e);
      fontsPromise = null;
      return [];
    });
  }
  return fontsPromise;
}
