import { avvioStartupImages } from "@/lib/avvio";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import OfflineBanner from "@/components/offline-banner";
import NavBar from "@/components/nav-bar";
import { getUser } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import "./globals.css";

// Font dentro il progetto (sottoinsieme latino, licenza OFL), non scaricati da Google Fonts a ogni build:
// il 31/10 due deploy di produzione su tre sono falliti perché Vercel non riusciva a scaricarli.
const poppins = localFont({
  variable: "--font-poppins",
  src: [
    { path: "./fonts/poppins-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/poppins-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/poppins-700.woff2", weight: "700", style: "normal" },
    { path: "./fonts/poppins-800.woff2", weight: "800", style: "normal" },
  ],
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

const inter = localFont({
  variable: "--font-inter",
  src: "./fonts/inter-var.woff2",
  weight: "400 700",
  style: "normal",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

// Variante in prova dei titoli (decisione grafica aperta): serif editoriale come Places.
// Si scarica solo se la pagina la usa davvero (?titoli=serif).
const newsreader = localFont({
  variable: "--font-newsreader",
  src: "./fonts/newsreader-var.woff2",
  weight: "500 600",
  style: "normal",
  display: "swap",
  // Usato solo con ?titoli=serif: niente precaricamento per tutti.
  preload: false,
});

// Varianti grafiche in prova, ricordate su questo telefono:
//   ?titoli=serif | ?titoli=sans   font dei titoli (serif editoriale come Places / Poppins)
//   ?scheda=b     | ?scheda=a      scheda del locale (stile Places, predefinita dal 12/10 per scelta di Lorenzo / vecchia)
//   ?home=b       | ?home=a        primo accesso con campo di ricerca diretto (stile Places / attuale)
//   ?pin=b        | ?pin=a         pin con la foto del locale (stile Places / emoji)
//   ?stile=places | ?stile=attuale tutte insieme
// Gira prima del primo disegno, così non si vede il cambio.
const VARIANTI_SCRIPT = `try{var q=new URLSearchParams(location.search),v={titoli:["serif","sans"],scheda:["b","a"],home:["b","a"],pin:["b","a"]},st=q.get("stile");for(var k in v){var t=st==="places"?v[k][0]:st==="attuale"?v[k][1]:q.get(k);if(t==="poppins")t="sans";if(v[k].indexOf(t)>=0)localStorage.setItem("mapetite."+k,t);if(localStorage.getItem("mapetite."+k)===v[k][0])document.documentElement.dataset[k]=v[k][0]}if(!localStorage.getItem("mapetite.scheda"))document.documentElement.dataset.scheda="b"}catch(e){}`;

// Primo accesso (src/components/home-intro.tsx): sulla home, se l'intro non è mai stata vista
// (o con ?intro=1), segna <html data-intro="nuovo"> prima del disegno, così non c'è lampo.
const INTRO_SCRIPT = `try{if(location.pathname==="/"&&(new URLSearchParams(location.search).get("intro")==="1"||!localStorage.getItem("mapetite.intro")))document.documentElement.dataset.intro="nuovo"}catch(e){}`;

export const metadata: Metadata = {
  title: "Mapetite",
  description: "I locali giusti per te, non quelli di tutti. Scrivi cosa cerchi come lo diresti a un amico.",
  openGraph: {
    title: "Mapetite",
    description: "I locali giusti per te, non quelli di tutti.",
    locale: "it_IT",
    type: "website",
  },
  applicationName: "Mapetite",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Mapetite",
    // Schermata d'avvio dell'app installata su iPhone: marchio su fondo teal invece dello schermo bianco.
    startupImage: avvioStartupImages,
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a3c40",
  // App installata su iPhone: senza "cover" la safe area vale 0 e la barra in basso
  // resta sotto la linea della Home. La barra di stato resta "default" (niente contenuto sotto).
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { data } = await getUser();
  // Solo in sviluppo con E2E_FAKE_USER: il giro automatico vede la barra "da collegato"
  // (Profilo al posto di Entra) col cookie "e2e_collegato". In produzione non si attiva.
  const e2eNav = process.env.NODE_ENV === "development" && process.env.E2E_FAKE_USER && (await cookies()).get("e2e_collegato")
    ? process.env.E2E_FAKE_USER
    : null;
  const userId = data?.user?.id ?? e2eNav;

  return (
    <html
      lang="it"
      className={`${poppins.variable} ${inter.variable} ${newsreader.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <script dangerouslySetInnerHTML={{ __html: VARIANTI_SCRIPT + INTRO_SCRIPT }} />
        <NavBar userId={userId} />
        <OfflineBanner />
        {/*
          Pagine normali (non fixed): pb uguale all'altezza della navbar (safe area inclusa) evita che il contenuto finisca
          sotto la navbar mobile; md:pt-14 fa scendere il contenuto sotto
          la navbar desktop. La pagina /mappa usa fixed inset-0 ed è fuori
          dal flusso, quindi gestisce da sola il proprio offset.
        */}
        <div className="pb-[calc(var(--nav-height-mobile)+var(--nav-sporgenza))] md:pb-0 md:pt-14">{children}</div>
      </body>
    </html>
  );
}
