import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { absoluteUrl, branding } from "@/lib/branding";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL(branding.siteUrl),
  title: {
    default: branding.title,
    template: `%s · ${branding.name}`,
  },
  description: branding.description,
  keywords: [...branding.keywords],
  authors: [{ name: branding.name, url: branding.siteUrl }],
  creator: branding.name,
  publisher: branding.name,
  applicationName: branding.name,
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
    },
  },
  openGraph: {
    type: "website",
    locale: "nl_NL",
    url: branding.siteUrl,
    siteName: branding.name,
    title: branding.title,
    description: branding.description,
  },
  twitter: {
    card: "summary_large_image",
    title: branding.title,
    description: branding.description,
  },
};

export const viewport: Viewport = {
  themeColor: branding.colors.background,
  width: "device-width",
  initialScale: 1,
};

/** JSON-LD: DogWare als organisatie, voor zoekmachines. */
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: branding.name,
  slogan: branding.slogan,
  description: branding.description,
  url: branding.siteUrl,
  logo: absoluteUrl(branding.logo.mark),
  image: absoluteUrl(branding.logo.full),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl" className={`${jakarta.variable} h-full antialiased`}>
      <body className="grain min-h-full flex flex-col bg-cream text-ink">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd),
          }}
        />
        {children}
      </body>
    </html>
  );
}
