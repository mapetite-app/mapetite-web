import type { Metadata } from "next";
import Link from "next/link";
import TracciaFunzione from "@/components/traccia-funzione";
import MiInteressa from "./mi-interessa";

// Mapetite Premium (PIANO-25-OTTOBRE.md 8b): per il 25/10 solo l'elenco di cosa sarà premium,
// tutto dichiarato "in arrivo". Nessun prezzo, nessun pagamento. "Mi interessa" registra solo
// un segnale anonimo (trackFeature) per misurare la domanda.
export const metadata: Metadata = {
  title: "Mapetite Premium · Mapetite",
  description: "Cosa arriverà con Mapetite Premium: assistente senza limiti, raccolte illimitate, serate organizzate.",
};

const FUNZIONI = [
  { id: "assistente", icon: "✨", title: "Assistente senza limiti", text: "Chiedi quante volte vuoi: “un posto romantico con terrazza”, “dove porto i miei a pranzo domenica”. Nessun tetto di domande." },
  { id: "raccolte", icon: "🗂️", title: "Raccolte e mappe illimitate", text: "Tutte le raccolte che vuoi, con copertina, ordine e mappe da condividere con chi esce con te." },
  { id: "serate", icon: "🌙", title: "Serate organizzate", text: "Aperitivo, cena e dopocena in un percorso a tappe, con la prenotazione preparata per te." },
  { id: "viaggi", icon: "🧳", title: "Modalità viaggio", text: "I tuoi salvati e i consigli per la città dove stai andando, pronti anche senza connessione." },
  { id: "novita", icon: "🔔", title: "Prima degli altri", text: "Ti avvisiamo quando apre un posto adatto ai tuoi gusti nella tua zona, non il più popolare." },
  { id: "gusti", icon: "📊", title: "Il tuo anno a tavola", text: "Cucine, quartieri e posti preferiti: il riepilogo dei tuoi gusti da rivedere e condividere." },
];

export default function PremiumPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-6" data-testid="premium">
      <TracciaFunzione nome="premium" contesto="pagina" />
      <section className="overflow-hidden rounded-card bg-brand px-5 py-7 text-white shadow-float">
        <p className="inline-flex items-center gap-1.5 rounded-pill bg-accent px-3 py-1 text-[11px] font-display font-semibold uppercase tracking-wider text-white">
          In arrivo
        </p>
        <h1 className="mt-3 font-title text-3xl font-semibold leading-tight">Mapetite Premium</h1>
        <p className="mt-2 text-sm font-sans leading-relaxed text-white/85">
          Per chi esce spesso e vuole scegliere ancora meglio. Quello che usi oggi resta gratis: Premium aggiunge, non toglie.
        </p>
        <p data-testid="premium-nessun-pagamento" className="mt-3 text-sm font-sans leading-relaxed text-white">
          <strong className="font-display">Non si paga niente.</strong> Tocca “Mi interessa” su quello che vorresti per primo.
        </p>
      </section>

      {/* Un solo elenco (Lorenzo 17/10, "semplice prima di tutto"): niente riquadro per voce
          né "In arrivo" ripetuto, già detto in cima. */}
      <ul className="mt-5 divide-y divide-border rounded-card border border-border bg-white shadow-card">
        {FUNZIONI.map((f) => (
          <li key={f.id} data-testid="premium-funzione" className="flex items-start gap-3 p-4">
            <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-light text-lg">{f.icon}</span>
            <div className="min-w-0 flex-1">
              <h2 className="font-title text-lg leading-snug text-text">{f.title}</h2>
              <p className="mt-0.5 text-sm font-sans leading-snug text-text-muted">{f.text}</p>
              <MiInteressa id={f.id} />
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-center text-sm font-sans text-text-muted">
        <Link href="/profilo" className="font-semibold text-brand underline">Torna al profilo</Link>
      </p>
    </main>
  );
}
