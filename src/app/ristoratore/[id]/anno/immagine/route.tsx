import { caricaAnnoLocale } from "@/lib/ristoratore-anno-server";
import { immagineAnnoLocale } from "@/lib/ristoratore-anno-immagine";

// Immagine da condividere di "Il vostro anno su Mapetite" (proposta 87): stesso accesso della pagina.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dati = await caricaAnnoLocale(id);
  if (!dati) return new Response("Non trovato.", { status: 404 });
  return immagineAnnoLocale(dati.anno, new URL(request.url).host);
}
