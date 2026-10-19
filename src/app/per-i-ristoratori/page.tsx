import Link from "next/link";
import type { Metadata } from "next";
import { Check, ChevronRight } from "lucide-react";
import { CONTACT } from "./rivendica/mail";

export const metadata: Metadata = {
  title: "Mapetite per i ristoratori",
  description: "Domanda qualificata, una vetrina verificata e i dati su cosa cerca la gente nella tua zona.",
};

// Pagina per i ristoratori (piano 8.3b, pitch "I piani per i ristoratori"). Per il 25/10 nessun
// pagamento: "Rivendica il tuo locale" porta al modulo di richiesta (/per-i-ristoratori/rivendica,
// piano 8.1); "Scrivici" prepara un'email a Mapetite. I prezzi non si mostrano: li decide Lorenzo.
// Struttura (feedback di Lorenzo 16/10): breve e ariosa, un solo invito all'azione (Rivendica),
// i tre piani in una tabella confrontabile riga per riga.

const PERCHE = [
  { icon: "🎯", title: "Domanda qualificata", text: "Ti trova chi sta già scegliendo e cerca proprio quello che offri." },
  // PROBLEMI.md 19/10 (commissioni a coperto): le prenotazioni da Mapetite arrivano dirette al locale.
  { icon: "🤝", title: "Zero commissioni a coperto", text: "Le prenotazioni arrivano direttamente a te, su WhatsApp o al telefono: nessuna percentuale sui clienti." },
  { icon: "🪪", title: "Vetrina verificata", text: "Foto, informazioni e badge “Verificato” gestiti da te." },
  { icon: "📊", title: "Cosa cerca la gente", text: "Richieste reali nella tua zona, ora per ora, e quante persone ti vedono e ti salvano." },
];

const PIANI = [
  { name: "Verified", per: "Esserci bene", tone: "bg-surface text-brand" },
  { name: "Growth", per: "Farsi scegliere", tone: "bg-brand text-white" },
  { name: "Pro", per: "Capire la zona", tone: "bg-accent text-white" },
] as const;

// Da quale piano in su (0 = Verified, 1 = Growth, 2 = Pro) è inclusa ogni funzione.
const FUNZIONI: { label: string; da: 0 | 1 | 2 }[] = [
  { label: "Profilo verificato e badge", da: 0 },
  { label: "Informazioni, contatti e link di prenotazione", da: 0 },
  { label: "Numeri di base: visite e salvataggi", da: 0 },
  { label: "Foto, menu ed eventi", da: 1 },
  { label: "Cosa cercano e salvano le persone", da: 1 },
  { label: "Categorie e occasioni che funzionano", da: 1 },
  { label: "Priorità organica, solo quando sei adatto alla ricerca", da: 1 },
  { label: "Trend della zona, anche per fascia di prezzo", da: 2 },
  { label: "Confronto con i locali simili", da: 2 },
  { label: "Posti in evidenza, solo se adatti e sempre etichettati", da: 2 },
];

const PASSI = ["Chiedi di rivendicare il tuo locale", "Verifichiamo che sia tuo", "Curi la tua pagina e vedi i tuoi numeri"];

export default function PerIRistoratori() {
  const mail = `mailto:${CONTACT}?subject=${encodeURIComponent("Il mio locale su Mapetite")}&body=${encodeURIComponent(
    "Buongiorno,\nvorrei verificare il mio locale su Mapetite.\n\nNome del locale:\nIndirizzo:\nCittà:\nIl mio ruolo (titolare, gestore…):\nTelefono:\n\nGrazie",
  )}`;
  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-6">
      <section className="rounded-card bg-brand px-5 pb-6 pt-7 text-white">
        <p className="text-[11px] font-display font-semibold uppercase tracking-wider text-accent">Mapetite per i ristoratori</p>
        <h1 className="mt-2 font-title text-[28px] font-semibold leading-tight">Fatti scegliere da chi ti sta già cercando</h1>
        <p className="mt-3 text-[15px] font-sans leading-relaxed text-white/85">
          Non paghi per “esserci”: paghi per persone già in fase di scelta, per il controllo della tua pagina e per dati utili.
        </p>
        <Link data-testid="rivendica" href="/per-i-ristoratori/rivendica" className="mt-6 flex min-h-12 w-full items-center justify-center rounded-pill bg-accent px-6 text-[15px] font-display font-semibold text-white active:scale-[0.98] sm:w-auto sm:inline-flex">
          Rivendica il tuo locale
        </Link>
        <Link data-testid="pannello-demo" href="/ristoratore/demo" className="mt-3 flex items-center justify-center gap-1 text-sm font-display font-semibold text-white/90 underline-offset-4 hover:underline sm:justify-start">
          Guarda un pannello d&apos;esempio<ChevronRight size={16} aria-hidden />
        </Link>
      </section>

      <section className="mt-10">
        <h2 className="font-title text-xl font-semibold text-brand">Perché Mapetite</h2>
        <ul className="mt-4 space-y-4">
          {PERCHE.map((p) => (
            <li key={p.title} className="flex gap-3.5">
              <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-surface text-xl">{p.icon}</span>
              <span className="min-w-0">
                <span className="block font-display text-[15px] font-semibold text-text">{p.title}</span>
                <span className="mt-0.5 block text-sm font-sans leading-snug text-text-muted">{p.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10" data-testid="piani">
        <h2 className="font-title text-xl font-semibold text-brand">I piani</h2>
        <p className="mt-1 text-sm font-sans text-text-muted">Ogni piano include tutto quello del precedente.</p>
        <table className="mt-4 w-full table-fixed border-collapse text-sm font-sans">
          <thead>
            <tr>
              <th scope="col" className="w-[44%]"><span className="sr-only">Cosa include</span></th>
              {PIANI.map((p) => (
                <th key={p.name} scope="col" className="px-0.5 pb-2 align-bottom">
                  <span data-testid="piano" className={`block rounded-btn px-1 py-2 text-center ${p.tone}`}>
                    <span className="block text-[11px] font-display font-semibold uppercase tracking-wider">{p.name}</span>
                    <span className="mt-0.5 block text-[10px] font-sans font-normal leading-tight opacity-80">{p.per}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FUNZIONI.map((f) => (
              <tr key={f.label} className="border-t border-border">
                <th scope="row" className="py-2.5 pr-2 text-left text-[13px] font-normal leading-snug text-text">{f.label}</th>
                {PIANI.map((p, i) => (
                  <td key={p.name} className="text-center">
                    {i >= f.da ? <Check size={16} className="mx-auto text-success" aria-label="incluso" /> : <span className="text-border" aria-label="non incluso">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs font-sans leading-snug text-text-muted">Mapetite resta onesta: un locale in evidenza compare solo se è adatto alla ricerca, e sempre con l’etichetta.</p>
      </section>

      <section className="mt-10">
        <h2 className="font-title text-xl font-semibold text-brand">Come funziona</h2>
        <ol className="mt-4 space-y-3">
          {PASSI.map((t, i) => (
            <li key={t} className="flex items-center gap-3 text-[15px] font-sans text-text">
              <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-display font-semibold text-white">{i + 1}</span>
              {t}
            </li>
          ))}
        </ol>
        <Link href="/per-i-ristoratori/rivendica" className="mt-6 flex min-h-12 w-full items-center justify-center rounded-pill bg-accent px-6 text-[15px] font-display font-semibold text-white active:scale-[0.98] sm:inline-flex sm:w-auto">
          Rivendica il tuo locale
        </Link>
        <p className="mt-3 text-center text-xs font-sans text-text-muted sm:text-left">
          Partiamo da Roma e Milano. Domande? <a href={mail} className="font-semibold text-brand underline">Scrivici</a>
        </p>
      </section>

      <p className="mt-10 text-center text-sm font-sans text-text-muted">
        Sei qui per cercare un posto? <Link href="/mappa" className="font-semibold text-brand underline">Apri la mappa</Link>
      </p>
    </main>
  );
}
