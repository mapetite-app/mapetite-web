import type { Metadata, Viewport } from "next";
import { Poppins, Inter } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Mapetite",
  description: "Trova e salva i tuoi locali preferiti",
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
      className={`${poppins.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full">
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
