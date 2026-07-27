import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-5 sm:px-8", className)}>
      {children}
    </div>
  );
}

export function Eyebrow({
  children,
  tone = "brand",
  className,
}: {
  children: ReactNode;
  tone?: "brand" | "sage" | "cream";
  className?: string;
}) {
  const tones = {
    brand: "bg-brand-100 text-brand-600 ring-brand/15",
    sage: "bg-sage-100 text-sage-600 ring-sage/15",
    cream: "bg-white/10 text-cream ring-white/15",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] ring-1",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

type ButtonProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "light";
  className?: string;
  size?: "sm" | "md" | "lg";
  /** Bijv. om een mobiel menu te sluiten bij het navigeren */
  onClick?: () => void;
};

/**
 * De knop van DogWare — één bron voor de hele site.
 *
 * Bewust ingetogen: de kop mag de aandacht krijgen, de knop nodigt uit zonder
 * te schreeuwen. Daarom rustige verhoudingen, een zachte hoek in plaats van
 * een volledige pil, en in ruststand vrijwel geen schaduw. De warme gloed
 * verschijnt pas bij hover, samen met een lift van één pixel — genoeg om
 * aanraakbaar te voelen, te weinig om af te leiden.
 *
 * Hoogtes komen uit padding en niet uit een vaste `h-`, zodat een lang label
 * op een smal scherm netjes kan doorlopen in plaats van af te snijden.
 */
export function Button({
  href,
  children,
  variant = "primary",
  size = "md",
  className,
  onClick,
}: ButtonProps) {
  const base =
    "group inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold leading-[1.2] tracking-[-0.01em] transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45 focus-visible:ring-offset-2 focus-visible:ring-offset-cream";
  const sizes = {
    sm: "px-3.5 py-2 text-[13px]",
    md: "px-4 py-2.5 text-sm",
    lg: "px-5 py-3 text-[15px]",
  };
  const variants = {
    primary:
      "bg-brand text-white shadow-[0_1px_2px_rgba(28,21,15,0.08)] hover:bg-brand-600 hover:-translate-y-px hover:shadow-[0_6px_16px_-6px_rgba(224,86,42,0.5)] active:translate-y-0 active:shadow-[0_1px_2px_rgba(28,21,15,0.08)]",
    secondary:
      "bg-ink text-cream shadow-[0_1px_2px_rgba(28,21,15,0.08)] hover:bg-ink-700 hover:-translate-y-px active:translate-y-0",
    ghost:
      "text-ink-700 ring-1 ring-ink/12 hover:bg-white hover:text-ink hover:ring-ink/20 hover:-translate-y-px active:translate-y-0",
    light:
      "bg-white text-ink ring-1 ring-ink/5 shadow-[0_1px_2px_rgba(28,21,15,0.06)] hover:-translate-y-px hover:shadow-soft active:translate-y-0",
  };
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(base, sizes[size], variants[variant], className)}
    >
      {children}
    </Link>
  );
}

export function SectionHeading({
  eyebrow,
  eyebrowTone = "brand",
  title,
  intro,
  align = "center",
  onDark = false,
  className,
}: {
  eyebrow?: string;
  eyebrowTone?: "brand" | "sage" | "cream";
  title: ReactNode;
  intro?: ReactNode;
  align?: "center" | "left";
  onDark?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-5",
        align === "center" ? "items-center text-center" : "items-start text-left",
        className,
      )}
    >
      {eyebrow && <Eyebrow tone={eyebrowTone}>{eyebrow}</Eyebrow>}
      <h2
        className={cn(
          "text-balance text-3xl font-extrabold tracking-tight sm:text-4xl md:text-[2.7rem] md:leading-[1.08]",
          onDark ? "text-cream" : "text-ink",
        )}
      >
        {title}
      </h2>
      {intro && (
        <p
          className={cn(
            "max-w-2xl text-pretty text-base leading-relaxed sm:text-lg",
            onDark ? "text-cream/70" : "text-ink-500",
            align === "center" && "mx-auto",
          )}
        >
          {intro}
        </p>
      )}
    </div>
  );
}
