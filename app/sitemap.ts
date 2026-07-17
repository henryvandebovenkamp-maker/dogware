import type { MetadataRoute } from "next";
import { branding } from "@/lib/branding";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = branding.siteUrl;
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/voorwaarden`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/cookies`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
