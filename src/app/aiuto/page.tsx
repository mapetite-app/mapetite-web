import Link from "next/link";
import type { Metadata } from "next";
import { CONTACT } from "../per-i-ristoratori/rivendica/mail";

export const metadata: Metadata = {
  title: "Aiuto · Mapetite",
  description: "Le domande più comuni su Mapetite e come scriverci.",
};

// Pagina di assistenza (23/11): App Store Connect chiede un "URL di assistenza" pubblico per pubblicare
// l'app (APP-IPHONE.md, punto 6). Aperta anche senza account, come /privacy. Solo ciò che l'app fa davvero:
// se una funzione cambia nome o posto, cambia anche qui (controlli nel giro automatico).

const DOMANDE: { d: string; r: string; id: string }[] = [
  {
    id: "reel",
    d: "Come salvo un posto da un reel?",
    r: "Nell'app per iPhone: da Instagram o TikTok tocca Condividi → Mapetite. Dal sito: copia il link del reel e incollalo in Importa. Mapetite ti mostra il locale e chiede \"È questo?\" prima di salvarlo.",
  },
  {
    id: "condividi",
    d: "Non trovo Mapetite tra le app di Condividi",
    r: "Nel foglio di Condividi scorri la fila delle app fino in fondo, tocca \"Altro\" e accendi Mapetite. Puoi anche trascinarla tra le prime.",
  },
  {
    id: "importa",
    d: "Posso portare i posti che ho già su Google Maps o Instagram?",
    r: "Sì, da Importa: le liste di Google Maps e i salvati di Instagram (il file che scarichi dal tuo account). Il file si legge sul telefono; salvi solo i posti che scegli.",
  },
  {
    id: "dati",
    d: "Da dove vengono le informazioni sui locali?",
    r: "Nomi, indirizzi, orari e recensioni vengono da Google. Il verdetto lo scrive un'AI leggendo solo quelle recensioni: se le recensioni non dicono una cosa, il verdetto non la dice.",
  },
  {
    id: "segnala",
    d: "Una recensione o una foto non va bene",
    r: "Tocca \"⋯\" accanto alla recensione o nell'angolo della foto: puoi segnalarla (la guardiamo entro 24 ore) o non vedere più i contenuti di quella persona. Per tornare a vederli: Profilo → Impostazioni → \"Persone nascoste\" → \"Mostra di nuovo\".",
  },
  {
    id: "elimina",
    d: "Come cancello il mio account?",
    r: "Profilo → Impostazioni → \"Elimina il mio account\", in fondo. Si cancellano l'account e tutti i tuoi posti, note e raccolte.",
  },
  {
    id: "errore",
    d: "Ho trovato un errore o mi manca qualcosa",
    r: "Profilo → Impostazioni → \"Dai un feedback\", oppure scrivici qui sotto.",
  },
];

export default function AiutoPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-6" data-testid="aiuto">
      <p className="text-[11px] font-display font-semibold uppercase tracking-wider text-accent">Mapetite</p>
      <h1 className="mt-1 font-title text-[28px] font-semibold leading-tight text-brand">Aiuto</h1>
      <p className="mt-2 text-[15px] font-sans leading-relaxed text-text-muted">Le domande più comuni. Per tutto il resto scrivici.</p>
      <ul className="mt-4 overflow-hidden rounded-card border border-border bg-white">
        {DOMANDE.map((q, i) => (
          <li key={q.id} id={q.id} className={`scroll-mt-4 ${i > 0 ? "border-t border-border" : ""}`}>
            <details className="group" open={i === 0}>
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 font-display text-[15px] font-semibold text-brand [&::-webkit-details-marker]:hidden">
                <span className="flex-1">{q.d}</span>
                <span aria-hidden className="text-text-muted transition-transform group-open:rotate-90">›</span>
              </summary>
              <p className="px-4 pb-4 text-[15px] font-sans leading-relaxed text-text">{q.r}</p>
            </details>
          </li>
        ))}
      </ul>
      <section className="mt-6" aria-label="Contatti" data-testid="aiuto-contatti">
        <h2 className="font-title text-xl text-brand">Scrivici</h2>
        <a href={`mailto:${CONTACT}?subject=${encodeURIComponent("Aiuto Mapetite")}`} className="mt-2 inline-flex min-h-11 items-center rounded-pill bg-brand px-5 font-display text-[15px] font-semibold text-white">
          {CONTACT}
        </a>
      </section>
      <p className="mt-8 flex gap-5">
        <Link href="/" className="inline-flex min-h-11 items-center font-display text-[15px] font-semibold text-brand underline underline-offset-2">
          Torna a Mapetite
        </Link>
        <Link href="/privacy" className="inline-flex min-h-11 items-center font-display text-[15px] text-text-muted underline underline-offset-2">
          Privacy
        </Link>
      </p>
    </main>
  );
}
