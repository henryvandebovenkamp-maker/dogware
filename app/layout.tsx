import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const SITE_URL = "https://dogware.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "DogWare — Meer tijd voor honden. Minder tijd achter een scherm.",
    template: "%s · DogWare",
  },
  description:
    "DogWare is het complete bedrijfsplatform voor de hondenbranche. Automatiseer planning, klantbeheer, betalingen, webshop, communicatie en administratie — zodat jij weer kunt doen waar je ooit voor begon: werken met honden.",
  keywords: [
    "hondenschool software",
    "uitlaatservice software",
    "trimsalon software",
    "gedragstherapie",
    "hondenbedrijf platform",
    "planning honden",
    "facturatie hondenbedrijf",
  ],
  authors: [{ name: "DogWare" }],
  openGraph: {
    type: "website",
    locale: "nl_NL",
    url: SITE_URL,
    siteName: "DogWare",
    title: "DogWare — Meer tijd voor honden. Minder tijd achter een scherm.",
    description:
      "Eén platform voor jouw complete hondenbedrijf. Planning, klanten, betalingen, webshop, trainingen, medewerkers en facturen — alles centraal, alles automatisch.",
  },
  twitter: {
    card: "summary_large_image",
    title: "DogWare — Meer tijd voor honden.",
    description:
      "Het complete bedrijfsplatform voor de hondenbranche. Werk met honden. Wij regelen de rest.",
  },
};

export const viewport: Viewport = {
  themeColor: "#fbf8f3",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl" className={`${jakarta.variable} h-full antialiased`}>
      <body className="grain min-h-full flex flex-col bg-cream text-ink">
        {children}
      </body>
    </html>
  );
}
