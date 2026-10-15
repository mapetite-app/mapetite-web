import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mapetite per i ristoratori",
  description: "Domanda qualificata, una vetrina verificata e i dati su cosa cerca la gente nella tua zona.",
};

// Pagina per i ristoratori (piano 8.3b, pitch "I piani per i ristoratori"). Per il 25/10 nessun
// pagamento: "Rivendica il tuo locale" prepara un'email a Mapetite. I prezzi non si mostrano:
// li decide Lorenzo.
const CONTACT = "founder.mapetite@gmail.com";

const PERCHE = [
  { icon: "🎯", title: "Domanda qualificata", text: "Ti trovano persone già in fase di scelta, che cercano proprio quello che offri: non semplice esposizione." },
  { icon: "🪪", title: "Vetrina verificata", text: "Informazioni, foto e categorie gestite da te, coerenti ovunque. Il badge “Verificato” sulla tua pagina." },
  { icon: "📊", title: "Cosa cerca la gente", text: "Le richieste reali nella tua zona (“terrazza”, “brunch”, “vegano”), a che ora e per quale occasione." },
  { icon: "💶", title: "Ritorno leggibile", text: "Quante persone hanno visto, salvato e chiesto di prenotare il tuo locale, mese per mese." },
];

const PIANI = [
  {
    name: "Verified",
    tone: "border-border",
    items: ["Profilo verificato", "Controllo delle informazioni di base", "Link di prenotazione e contatti", "Numeri di base: visite e salvataggi"],
  },
  {
    name: "Growth",
    tone: "border-brand ring-2 ring-brand",
    items: ["Tutto Verified", "Contenuti premium: foto, menu, eventi", "Cosa cercano e salvano gli utenti", "Quali categorie e occasioni funzionano", "Priorità organica quando sei adatto alla ricerca"],
  },
  {
    name: "Pro",
    tone: "border-accent",
    items: ["Tutto Growth", "Numeri avanzati", "Trend della zona e per fascia di prezzo", "Confronto con la zona", "Strumenti di promozione dedicati"],
  },
];

export default function PerIRistoratori() {
  const mail = `mailto:${CONTACT}?subject=${encodeURIComponent("Il mio locale su Mapetite")}&body=${encodeURIComponent(
    "Buongiorno,\nvorrei verificare il mio locale su Mapetite.\n\nNome del locale:\nIndirizzo:\nCittà:\nIl mio ruolo (titolare, gestore…):\nTelefono:\n\nGrazie",
  )}`;
  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-6">
      <section className="overflow-hidden rounded-card bg-brand px-5 py-8 text-white shadow-float">
        <p className="text-[11px] font-display font-semibold uppercase tracking-wider text-accent">Mapetite per i ristoratori</p>
        <h1 className="mt-2 font-title text-3xl font-semibold leading-tight">Fatti scegliere da chi ti sta già cercando</h1>
        <p className="mt-3 text-sm font-sans leading-relaxed text-white/85">
          Mapetite è la mappa personale del food &amp; beverage: le persone salvano i locali che scoprono e li ritrovano quando devono scegliere.
          Non paghi per “esserci”: paghi per domanda qualificata, controllo della tua presenza e dati utili.
        </p>
        <a data-testid="rivendica" href={mail} className="mt-6 inline-flex min-h-12 items-center rounded-pill bg-accent px-6 text-sm font-display font-semibold text-white active:scale-[0.98]">
          Rivendica il tuo locale
        </a>
        <p className="mt-3 text-xs font-sans text-white/70">Partiamo da Roma e Milano. Ti rispondiamo noi, senza impegno.</p>
      </section>

      <section className="mt-8">
        <h2 className="font-title text-xl font-semibold text-brand">Perché Mapetite</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {PERCHE.map((p) => (
            <div key={p.title} className="rounded-card border border-border bg-white p-4 shadow-card">
              <span aria-hidden className="text-2xl">{p.icon}</span>
              <h3 className="mt-2 font-display text-base font-semibold text-text">{p.title}</h3>
              <p className="mt-1 text-sm font-sans leading-snug text-text-muted">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-title text-xl font-semibold text-brand">I piani</h2>
        <p className="mt-1 text-sm font-sans text-text-muted">Mapetite resta onesta: un locale in evidenza compare solo se è adatto alla ricerca, e sempre con l’etichetta.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {PIANI.map((p) => (
            <div key={p.name} data-testid="piano" className={`rounded-card border bg-white p-4 shadow-card ${p.tone}`}>
              <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-brand">{p.name}</h3>
              <ul className="mt-3 space-y-1.5">
                {p.items.map((i) => (
                  <li key={i} className="flex gap-2 text-sm font-sans leading-snug text-text">
                    <span aria-hidden className="text-success">✓</span>
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-card border border-border bg-surface p-5">
        <h2 className="font-title text-lg font-semibold text-brand">Come funziona</h2>
        <ol className="mt-3 space-y-2 text-sm font-sans text-text">
          <li><strong>1.</strong> Ci scrivi con “Rivendica il tuo locale”.</li>
          <li><strong>2.</strong> Verifichiamo che il locale sia tuo e attiviamo la pagina verificata.</li>
          <li><strong>3.</strong> Aggiorni foto, menu ed eventi e vedi i tuoi numeri.</li>
        </ol>
        <a href={mail} className="mt-4 inline-flex min-h-11 items-center rounded-pill bg-brand px-5 text-sm font-display font-semibold text-white">Scrivici</a>
      </section>

      <p className="mt-8 text-center text-sm font-sans text-text-muted">
        Sei qui per cercare un posto? <Link href="/mappa" className="font-semibold text-brand underline">Apri la mappa</Link>
      </p>
    </main>
  );
}
