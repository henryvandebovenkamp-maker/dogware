import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { branding } from "@/lib/branding";

/**
 * Open Graph-afbeelding (1200×630) voor WhatsApp, LinkedIn, iMessage, X e.d.
 * Gegenereerd vanuit het officiële logo op merk-crème — geen aparte
 * afbeelding om te onderhouden bij een rebrand.
 */

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${branding.name} — ${branding.slogan}`;

export default async function OpengraphImage() {
  const logo = await readFile(join(process.cwd(), "public/brand/logo.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: branding.colors.background,
          backgroundImage: `radial-gradient(circle at 20% 10%, ${branding.colors.primary}14, transparent 55%), radial-gradient(circle at 85% 90%, ${branding.colors.secondary}12, transparent 55%)`,
        }}
      >
        <img src={logoSrc} alt="" width={880} height={440} />
        <div
          style={{
            marginTop: 8,
            fontSize: 30,
            fontWeight: 600,
            color: "#6b5d4f",
            display: "flex",
          }}
        >
          Het complete platform voor de hondenbranche
        </div>
      </div>
    ),
    size,
  );
}
