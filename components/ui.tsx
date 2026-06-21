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
  size?: "md" | "lg";
};

export function Button({
  href,
  children,
  variant = "primary",
  size = "md",
  className,
}: ButtonProps) {
  const base =
    "group inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-cream";
  const sizes = {
    md: "px-5 py-2.5 text-sm",
    lg: "px-7 py-3.5 text-base",
  };
  const variants = {
    primary:
      "bg-brand text-white shadow-[0_12px_30px_-12px_rgba(224,86,42,0.8)] hover:bg-brand-600 hover:-translate-y-0.5",
    secondary:
      "bg-ink text-cream hover:bg-ink-700 hover:-translate-y-0.5 shadow-soft",
    ghost:
      "bg-transparent text-ink ring-1 ring-ink/15 hover:ring-ink/30 hover:bg-white/60",
    light:
      "bg-white text-ink shadow-soft ring-1 ring-ink/5 hover:-translate-y-0.5",
  };
  return (
    <Link
      href={href}
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
