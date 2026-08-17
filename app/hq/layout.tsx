import type { Metadata } from "next";
import { checkHqAccess, requireOwner } from "@/lib/hq-auth";
import styles from "./orbit.module.css";

/**
 * De autoritatieve poort van HQ.
 *
 * De proxy doet daarvoor al een grove controle, maar die is een optimalisatie
 * — niet de beveiliging. Hier valt de echte beslissing, server-side, vóór er
 * ook maar iets gerenderd wordt. Elke server action en route handler onder
 * /hq controleert daarnaast nog een keer zelfstandig, omdat die ook via een
 * directe POST bereikbaar zijn en dan geen layout passeren.
 */

/**
 * De titel wordt bewust achter dezelfde controle gezet als de pagina zelf.
 *
 * Next lost metadata los van het renderen op: een statische `metadata`-export
 * belandt óók in het antwoord wanneer de layout notFound() gooit. Een vaste
 * titel "DogWare Orbit" stond daardoor gewoon in de 404 van een uitgelogde
 * bezoeker — precies de verklapper die we willen vermijden. Onbevoegd krijgt
 * nu de gewone sitetitel, net als bij elk ander adres dat niet bestaat.
 */
export async function generateMetadata(): Promise<Metadata> {
  const robots = { index: false, follow: false, nocache: true };
  const { result } = await checkHqAccess();
  return result.allowed ? { title: "DogWare Orbit", robots } : { robots };
}

/** Nooit statisch: de toegangsbeslissing hangt aan de sessie van dit verzoek. */
export const dynamic = "force-dynamic";

export default async function HqLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireOwner();

  return <div className={styles.shell}>{children}</div>;
}
