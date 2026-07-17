import type { MetadataRoute } from "next";
import { branding } from "@/lib/branding";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${branding.name} — ${branding.slogan}`,
    short_name: branding.name,
    description: branding.description,
    start_url: "/",
    display: "standalone",
    background_color: branding.colors.background,
    theme_color: branding.colors.background,
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
