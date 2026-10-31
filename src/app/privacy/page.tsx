import Link from "next/link";
import type { Metadata } from "next";
import { CONTACT } from "../per-i-ristoratori/rivendica/mail";

export const metadata: Metadata = {
  title: "Privacy · Mapetite",
  description: "Quali dati usa Mapetite, perché e come chiederne la cancellazione.",
};

// Norme sulla privacy (29/10): Google le chiede per pubblicare l'accesso con Google (Google Auth
// Platform → Branding). Solo ciò che l'app fa davvero: tabelle Supabase, eventi d'uso, fornitori.
// Testo da far rileggere a un legale prima dell'apertura al pubblico.

const SEZIONI: { titolo: string; righe: string[] }[] = [
  {
    titolo: "Chi siamo",
    righe: [
      `Mapetite è un'app per salvare e ritrovare locali di cibo e bevande. Per qualsiasi domanda sulla privacy scrivi a ${CONTACT}.`,
    ],
  },
  {
    titolo: "Quali dati usiamo",
    righe: [
      "Account: email e, se entri con Google, nome e foto del profilo Google.",
      "Profilo e gusti: città, zone, tipi di posto che ti piacciono o no, diete, occasioni e spesa che scegli tu.",
      "I tuoi posti: locali salvati, note, raccolte, visite (\"Ci sono stato\"), recensioni e foto che pubblichi, gruppi e persone che segui.",
      "Uso dell'app: quali funzioni usi e le ricerche che fai, per capire cosa migliorare. Con una ricerca può essere registrato il punto della mappa da cui cerchi.",
      "Posizione: solo se la permetti, per mostrare le distanze e i posti vicini. Non la seguiamo in background.",
      "Prenotazioni: le richieste che mandi ai locali da Mapetite restano sul telefono. Solo se tocchi \"Attiva\" in Le mie prenotazioni le teniamo anche sul tuo account (locale, giorno, ora, persone, eventuale richiesta speciale, come l'hai chiesta, se ci sei andato o hai disdetto), per non perderle cambiando telefono e contare la riga \"di parola\". Oggi non le vede nessun altro, nemmeno il locale. Con \"Spegni\" le cancelliamo dall'account.",
      "Sul telefono restano alcune preferenze (per esempio l'ultima vista della mappa e le risposte del primo accesso non ancora salvate).",
    ],
  },
  {
    titolo: "Perché",
    righe: [
      "Per farti accedere, conservare i tuoi posti e mostrarti risultati e verdetti adatti ai tuoi gusti.",
      "Non vendiamo i tuoi dati e non mostriamo pubblicità.",
    ],
  },
  {
    titolo: "Con chi li condividiamo",
    righe: [
      "Supabase (database e accesso) e Vercel (server dell'app), che li conservano per nostro conto.",
      "Google: le ricerche passano da Google Maps (Places) per trovare i locali; l'accesso con Google passa da Google.",
      "Anthropic: il testo della ricerca, i gusti che hai scelto e le recensioni pubbliche dei locali servono all'AI per scrivere i verdetti. Non inviamo email né nome.",
      "Mapbox mostra la mappa; YouTube serve a leggere la descrizione dei video che salvi.",
      "Altri utenti vedono il tuo profilo, i tuoi salvati e le tue recensioni solo se rendi pubblico il profilo.",
    ],
  },
  {
    titolo: "I tuoi diritti",
    righe: [
      `Puoi chiedere in qualsiasi momento di vedere, correggere o cancellare i tuoi dati, compreso l'account: scrivi a ${CONTACT} dall'email con cui sei registrato. Rispondiamo entro 30 giorni.`,
      "Gusti, salvati e profilo si possono cambiare anche dall'app, in Profilo.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-6" data-testid="privacy">
      <p className="text-[11px] font-display font-semibold uppercase tracking-wider text-accent">Mapetite</p>
      <h1 className="mt-1 font-title text-[28px] font-semibold leading-tight text-brand">Privacy</h1>
      <p className="mt-2 text-sm font-sans text-text-muted">Ultimo aggiornamento: 31 ottobre 2026</p>
      {SEZIONI.map((s) => (
        <section key={s.titolo} className="mt-6">
          <h2 className="font-display text-lg font-semibold text-brand">{s.titolo}</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {s.righe.map((r) => (
              <li key={r} id={r.startsWith("Prenotazioni:") ? "prenotazioni" : undefined} className="text-[15px] font-sans leading-relaxed text-text">{r}</li>
            ))}
          </ul>
        </section>
      ))}
      <Link href="/" className="mt-8 inline-flex min-h-11 items-center font-display text-[15px] font-semibold text-brand underline underline-offset-2">
        Torna a Mapetite
      </Link>
    </main>
  );
}
