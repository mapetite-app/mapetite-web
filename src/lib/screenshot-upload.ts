// Screenshot scelto nel telefono → data URL da mandare a /api/import-caption.

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Lo screenshot di un iPhone è spesso un PNG da 3–5 MB: in base64 supera il limite delle
// richieste di Vercel (4,5 MB) e il tester vedeva "Impossibile leggere" su un'immagine buona.
// Si rimpicciolisce nel telefono a 1568 px sul lato lungo (quanto basta all'AI per leggere)
// e si manda in JPEG: qualche centinaio di kB. Se il browser non ci riesce, si manda com'è.
const MAX_SIDE = 1568;
export async function screenshotForUpload(file: File): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return readFileAsDataUrl(file);
  }
}
