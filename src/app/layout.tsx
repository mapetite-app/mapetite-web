import type { Metadata, Viewport } from "next";
import { Poppins, Inter, Newsreader } from "next/font/google";
import OfflineBanner from "@/components/offline-banner";
import NavBar from "@/components/nav-bar";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Variante in prova dei titoli (decisione grafica aperta): serif editoriale come Places.
// Si scarica solo se la pagina la usa davvero (?titoli=serif).
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["500", "600"],
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
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a3c40",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const userId = data?.user?.id ?? null;

  return (
    <html
      lang="it"
      className={`${poppins.variable} ${inter.variable} ${newsreader.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <script dangerouslySetInnerHTML={{ __html: VARIANTI_SCRIPT }} />
        <NavBar userId={userId} />
        <OfflineBanner />
        {/*
          Pagine normali (non fixed): pb-16 evita che il contenuto finisca
          sotto la navbar mobile; md:pt-14 fa scendere il contenuto sotto
          la navbar desktop. La pagina /mappa usa fixed inset-0 ed è fuori
          dal flusso, quindi gestisce da sola il proprio offset.
        */}
        <div className="pb-16 md:pb-0 md:pt-14">{children}</div>
      </body>
    </html>
  );
}
