import type { Metadata, Viewport } from "next";
import { Poppins, Inter, Fraunces } from "next/font/google";
import NavBar from "@/components/nav-bar";
import TitleVariant from "@/components/title-variant";
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

// Serif editoriale per la variante ?titoli=serif (decisione grafica aperta, stile Places).
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  // Usato solo con ?titoli=serif: niente precaricamento per tutti.
  preload: false,
});

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
      className={`${poppins.variable} ${inter.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <TitleVariant />
        <NavBar userId={userId} />
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
