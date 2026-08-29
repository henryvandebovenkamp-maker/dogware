import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import { Camera } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Foto's staan in /public/photos. Zolang een bestand daar nog niet bestaat,
 * toont het component een warme placeholder in de huisstijl met de bestandsnaam,
 * zodat direct duidelijk is welke foto waar geplaatst moet worden.
 */
const PHOTO_DIR = path.join(process.cwd(), "public", "photos");

/**
 * Staat de échte foto er al? Alleen bruikbaar in servercomponenten.
 *
 * Secties die zonder foto beter gewoon tekst kunnen tonen gebruiken dit, in
 * plaats van een placeholderkaart op de publieke homepage te zetten. De
 * placeholder van `Photo` is bedoeld om te laten zien wélke foto ergens hoort
 * — nuttig tijdens het inrichten, niet op een live commerciële pagina.
 */
export function photoExists(file: string) {
  try {
    return fs.existsSync(path.join(PHOTO_DIR, file));
  } catch {
    return false;
  }
}

export function Photo({
  file,
  alt,
  label,
  tone = "warm",
  sizes = "(min-width: 1024px) 33vw, 100vw",
  position,
  priority,
  className,
}: {
  /** Bestandsnaam in /public/photos, bijv. "training-veld.jpg" */
  file: string;
  alt: string;
  /** Korte omschrijving op de placeholder zolang de foto ontbreekt */
  label?: string;
  tone?: "warm" | "sage" | "ink";
  sizes?: string;
  /** Tailwind object-position klasse, bijv. "object-left" als het onderwerp niet gecentreerd staat */
  position?: string;
  /** Zet dit alleen voor een foto die bovenaan het scherm staat: die is de LCP en mag niet lazy laden. */
  priority?: boolean;
  className?: string;
}) {
  if (photoExists(file)) {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl ring-1 ring-ink/5 shadow-soft",
          className,
        )}
      >
        <Image
          src={`/photos/${file}`}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className={cn("object-cover", position)}
        />
      </div>
    );
  }

  const tones = {
    warm: "from-brand-100 via-cream-100 to-brand-50 text-brand-600",
    sage: "from-sage-100 via-cream-100 to-sage-100 text-sage-600",
    ink: "from-ink to-ink-700 text-cream/80",
  };

  return (
    <div
      className={cn(
        "relative flex items-end overflow-hidden rounded-3xl bg-gradient-to-br ring-1 ring-ink/5 shadow-soft",
        tones[tone],
        className,
      )}
    >
      <Camera className="pointer-events-none absolute -right-4 -top-4 h-28 w-28 opacity-10" />
      <span className="relative m-4 inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm ring-1 ring-ink/5">
        <Camera className="h-3.5 w-3.5 shrink-0" />
        {label ?? alt} · {file}
      </span>
    </div>
  );
}

/** Rond avatar-fotootje met fallback (bijv. emoji) zolang de foto ontbreekt. */
export function Avatar({
  file,
  alt,
  fallback,
  position,
  className,
}: {
  file: string;
  alt: string;
  fallback: React.ReactNode;
  /** Tailwind object-position klasse, bijv. "object-left" */
  position?: string;
  className?: string;
}) {
  if (photoExists(file)) {
    return (
      <span
        className={cn(
          "relative block h-11 w-11 overflow-hidden rounded-full ring-1 ring-ink/5",
          className,
        )}
      >
        <Image
          src={`/photos/${file}`}
          alt={alt}
          fill
          sizes="88px"
          className={cn("object-cover", position)}
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-full bg-cream-100 text-xl ring-1 ring-ink/5",
        className,
      )}
    >
      {fallback}
    </span>
  );
}
