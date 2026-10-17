"use client";

import { browserClient } from "@/lib/supabase/client-lazy";
import { FOTO_BUCKET, FOTO_MAX, isMissingFoto, type FotoUtente } from "@/lib/foto-utenti";

// Caricamento delle foto degli utenti (piani 4.4 e 5.6c) dal telefono, con la sessione
// dell'utente: valgono le policy di Storage e le RLS (si scrive solo nella propria cartella).
// L'immagine si rimpicciolisce NEL TELEFONO prima di partire: lato lungo 1600 px, JPEG ~0,8,
// sotto i 500 KB. Così il caricamento è veloce anche in 4G e lo spazio gratuito basta a lungo.

const LATO = 1600;
const MAX_BYTES = 500 * 1024;

async function decodifica(file: File): Promise<{ img: CanvasImageSource; w: number; h: number; close: () => void }> {
  // createImageBitmap rispetta l'orientamento della foto (EXIF) senza librerie.
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { img: bmp, w: bmp.width, h: bmp.height, close: () => bmp.close() };
    } catch {
      // formato che il browser non sa aprire così: si prova con <img>
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { img, w: img.naturalWidth, h: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

const toBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));

/** Foto pronta da caricare: JPEG, lato lungo al massimo 1600 px, sotto i 500 KB. */
export async function ridimensiona(file: File): Promise<Blob> {
  const { img, w, h, close } = await decodifica(file);
  try {
    if (!w || !h) throw new Error("immagine vuota");
    // Prima si abbassa la qualità, poi (se ancora troppo pesante) la misura.
    for (const lato of [LATO, 1280, 1024]) {
      const k = Math.min(1, lato / Math.max(w, h));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(w * k));
      canvas.height = Math.max(1, Math.round(h * k));
      const g = canvas.getContext("2d");
      if (!g) throw new Error("canvas non disponibile");
      g.fillStyle = "#fff"; // i PNG trasparenti non diventano neri
      g.fillRect(0, 0, canvas.width, canvas.height);
      g.drawImage(img, 0, 0, canvas.width, canvas.height);
      for (const q of [0.8, 0.7, 0.6]) {
        const blob = await toBlob(canvas, q);
        if (blob && blob.size <= MAX_BYTES) return blob;
      }
    }
    throw new Error("foto troppo pesante");
  } finally {
    close();
  }
}

export type FotoCaricata =
  | { esito: "ok"; foto: FotoUtente }
  | { esito: "non-immagine" | "troppe" | "in-arrivo" | "errore" };

/** Carica una foto dell'utente per il locale (`placeId` = UUID Supabase). */
export async function caricaFoto(userId: string, placeId: string, file: File, pubblica: boolean, giaPresenti: number): Promise<FotoCaricata> {
  if (!file.type.startsWith("image/")) return { esito: "non-immagine" };
  if (giaPresenti >= FOTO_MAX) return { esito: "troppe" };
  let blob: Blob;
  try {
    blob = await ridimensiona(file);
  } catch (err) {
    console.warn("[foto] immagine non leggibile:", err);
    return { esito: "non-immagine" };
  }
  const client = await browserClient().catch(() => null);
  if (!client) return { esito: "errore" };
  const id = crypto.randomUUID();
  const path = `${userId}/${placeId}/${id}.jpg`;
  const up = await client.storage.from(FOTO_BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: false, cacheControl: "3600" });
  if (up.error) {
    console.warn("[foto] caricamento non riuscito:", up.error.message);
    return { esito: /bucket not found/i.test(up.error.message) ? "in-arrivo" : "errore" };
  }
  const { error } = await client.from("foto_locali").insert({ id, user_id: userId, place_id: placeId, path, pubblica });
  if (error) {
    // Il file senza la riga non lo vedrebbe nessuno: si toglie subito.
    await client.storage.from(FOTO_BUCKET).remove([path]).catch(() => {});
    if (/massimo 3 foto/.test(error.message)) return { esito: "troppe" };
    if (isMissingFoto(error)) return { esito: "in-arrivo" };
    console.warn("[foto] foto non collegata al locale:", error.message);
    return { esito: "errore" };
  }
  // Anteprima immediata dal telefono (niente secondo scaricamento).
  return { esito: "ok", foto: { id, url: URL.createObjectURL(blob), pubblica } };
}

/** Toglie una propria foto (riga e file). */
export async function eliminaFoto(userId: string, placeId: string, fotoId: string): Promise<boolean> {
  const client = await browserClient().catch(() => null);
  if (!client) return false;
  const { error } = await client.from("foto_locali").delete().eq("id", fotoId).eq("user_id", userId);
  if (error) {
    console.warn("[foto] foto non tolta:", error.message);
    return false;
  }
  await client.storage.from(FOTO_BUCKET).remove([`${userId}/${placeId}/${fotoId}.jpg`]).catch(() => {});
  return true;
}

/** Rende visibili (o di nuovo private) tutte le proprie foto del locale. */
export async function cambiaVisibilita(userId: string, placeId: string, pubblica: boolean): Promise<boolean> {
  const client = await browserClient().catch(() => null);
  if (!client) return false;
  const { error } = await client.from("foto_locali").update({ pubblica }).eq("user_id", userId).eq("place_id", placeId);
  if (error) console.warn("[foto] visibilità non cambiata:", error.message);
  return !error;
}
