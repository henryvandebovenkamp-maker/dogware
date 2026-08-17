import type { MetadataRoute } from "next";
import { branding } from "@/lib/branding";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Beheer-, partner-, klant- en flow-routes buiten de index houden.
      // /hq staat hier voor de netheid; de echte afscherming is de
      // eigenaarscontrole in lib/hq-auth.ts — robots.txt beveiligt niets.
      disallow: [
        "/hq",
        "/admin",
        "/partner",
        "/account",
        "/api",
        "/inloggen",
        "/p/",
        "/demo",
      ],
    },
    sitemap: `${branding.siteUrl}/sitemap.xml`,
    host: branding.siteUrl,
  };
}
