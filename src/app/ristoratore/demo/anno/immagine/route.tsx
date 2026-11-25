import { annoDa } from "@/lib/anno-tavola";
import { annoLocale } from "@/lib/ristoratore-anno";
import { DEMO_LOCALE, demoAnnoDati } from "@/lib/ristoratore-demo";
import { immagineAnnoLocale } from "@/lib/ristoratore-anno-immagine";

// Immagine d'esempio (proposta 87): numeri inventati, con "Esempio" scritto in alto.
export async function GET(request: Request) {
  const anno = annoDa();
  const a = annoLocale({ placeId: DEMO_LOCALE.id, ...demoAnnoDati(anno) }, anno);
  return immagineAnnoLocale(a, new URL(request.url).host, true);
}
