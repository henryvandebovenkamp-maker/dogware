import type { MetadataRoute } from "next";
import { branding } from "@/lib/branding";
import { BRANCHES } from "@/lib/branches";
import { NEEDS } from "@/lib/needs";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = branding.siteUrl;
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    // Branchepagina's: de belangrijkste ingang voor zoekverkeer
    ...BRANCHES.map((b) => ({
      url: `${base}${b.path}`,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
    // Oplossingspagina's per behoefte
    ...NEEDS.map((n) => ({
      url: `${base}${n.path}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${base}/demo`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/contact`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/voorwaarden`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/cookies`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
