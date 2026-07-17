import type { MetadataRoute } from "next";
import { branding } from "@/lib/branding";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Beheer-, partner-, klant- en flow-routes buiten de index houden
      disallow: [
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
