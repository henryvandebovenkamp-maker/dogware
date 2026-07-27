import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BranchePage } from "@/components/landing/branche-page";
import { NeedPage } from "@/components/landing/need-page";
import { BRANCHES, BRANCHE_BY_PATH } from "@/lib/branches";
import { NEEDS, NEED_BY_PATH } from "@/lib/needs";
import { absoluteUrl, branding } from "@/lib/branding";

/**
 * Eén dynamische route voor álle landingspagina's:
 *  - branches:   /hondenschool-software, /trimsalon-software, …
 *  - behoeften:  /minder-administratie, /klantenportaal-hondenbedrijf, …
 *
 * `dynamicParams = false` zorgt dat uitsluitend de gegenereerde paden bestaan;
 * al het andere valt netjes terug op de 404-pagina. Bestaande routes als
 * /demo en /inloggen gaan altijd vóór deze dynamische route.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return [
    ...BRANCHES.map((b) => ({ slug: b.path.replace(/^\//, "") })),
    ...NEEDS.map((n) => ({ slug: n.path.replace(/^\//, "") })),
  ];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const branche = BRANCHE_BY_PATH.get(slug);
  const need = NEED_BY_PATH.get(slug);
  const seo = branche?.seo ?? need?.seo;
  if (!seo) return {};

  return {
    title: seo.title,
    description: seo.description,
    keywords: [...seo.keywords],
    alternates: { canonical: `/${slug}` },
    openGraph: {
      type: "website",
      locale: "nl_NL",
      url: absoluteUrl(`/${slug}`),
      siteName: branding.name,
      title: seo.title,
      description: seo.description,
    },
    twitter: {
      card: "summary_large_image",
      title: seo.title,
      description: seo.description,
    },
  };
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const branche = BRANCHE_BY_PATH.get(slug);
  const need = NEED_BY_PATH.get(slug);
  if (!branche && !need) notFound();

  const seo = (branche?.seo ?? need?.seo)!;
  const faq = branche?.faq ?? need?.faq ?? [];
  const naam = branche ? `Software voor ${branche.meervoud}` : need!.titel;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: `${branding.name} — ${naam}`,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: seo.description,
      url: absoluteUrl(`/${slug}`),
      image: absoluteUrl(branding.logo.full),
      inLanguage: "nl-NL",
      offers: {
        "@type": "Offer",
        priceCurrency: "EUR",
        availability: "https://schema.org/InStock",
        url: absoluteUrl("/demo"),
      },
      provider: {
        "@type": "Organization",
        name: branding.name,
        url: branding.siteUrl,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: branding.name,
          item: branding.siteUrl,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: naam,
          item: absoluteUrl(`/${slug}`),
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((f) => ({
        "@type": "Question",
        name: f.v,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {branche ? <BranchePage branche={branche} /> : <NeedPage need={need!} />}
    </>
  );
}
