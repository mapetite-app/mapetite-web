import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import NavBar from "@/components/nav-bar";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mapetite",
  description: "Trova e salva i tuoi locali preferiti",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
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
