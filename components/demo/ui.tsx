"use client";

import { motion } from "motion/react";
import { useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { GlyphArrow, GlyphCheck, GlyphSpark } from "./illustrations";

/**
 * Maatwerkcomponenten voor de demo-experience.
 * Geen standaard inputs, geen pills, geen checkboxes — DogWare-eigen interface.
 */

export const EASE = [0.21, 0.47, 0.32, 0.98] as const;

/* ---------- Grote keuzekaart met illustratie en verhaaltje ---------- */

export function ChoiceCard({
  illustration,
  titel,
  verhaal,
  selected,
  onSelect,
  compact = false,
}: {
  illustration: ReactNode;
  titel: string;
  verhaal: string;
  selected: boolean;
  onSelect: () => void;
  compact?: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.995 }}
      transition={{ duration: 0.25, ease: EASE }}
      className={cn(
        "group relative flex w-full flex-col items-start rounded-[1.4rem] bg-white text-left transition-shadow duration-300",
        compact ? "p-5" : "p-6",
        selected
          ? "shadow-lift ring-2 ring-brand"
          : "shadow-soft ring-1 ring-ink/[0.06] hover:shadow-lift",
      )}
    >
      {/* selectievinkje */}
      <span
        className={cn(
          "absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full transition-all duration-300",
          selected
            ? "scale-100 bg-brand text-white opacity-100"
            : "scale-75 bg-cream-100 text-transparent opacity-0 group-hover:opacity-60 group-hover:text-ink-300",
        )}
      >
        <GlyphCheck className="h-3.5 w-3.5" />
      </span>

      <span
        className={cn(
          "text-ink transition-colors duration-300",
          compact ? "h-12 w-12" : "h-14 w-14",
          selected ? "text-brand-600" : "group-hover:text-ink",
        )}
      >
        {illustration}
      </span>

      <span className={cn("font-extrabold tracking-tight text-ink", compact ? "mt-3 text-[15px]" : "mt-4 text-lg")}>
        {titel}
      </span>
      <span className="mt-1 text-pretty text-[13px] leading-relaxed text-ink-500">
        {verhaal}
      </span>
    </motion.button>
  );
}

/* ---------- Grote, rustige tekstinvoer (geen formulierveld-gevoel) ---------- */

export function GhostInput({
  value,
  onChange,
  placeholder,
  onEnter,
  autoFocus = false,
  type = "text",
  size = "lg",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onEnter?: () => void;
  autoFocus?: boolean;
  type?: string;
  size?: "lg" | "md";
}) {
  const [focus, setFocus] = useState(false);
  return (
    <div className="w-full">
      <input
        type={type}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter) onEnter();
        }}
        placeholder={placeholder}
        className={cn(
          "w-full bg-transparent font-extrabold tracking-tight text-ink outline-none placeholder:font-medium placeholder:text-ink-300/60",
          size === "lg" ? "text-3xl sm:text-4xl" : "text-xl sm:text-2xl",
        )}
      />
      <motion.div
        className="mt-3 h-px origin-left bg-ink/10"
        animate={{ scaleX: 1, backgroundColor: focus ? "rgba(224,86,42,0.6)" : "rgba(28,21,15,0.1)" }}
        transition={{ duration: 0.4, ease: EASE }}
      />
    </div>
  );
}

/* ---------- Compacte uitklapbare schrijfkaart (i.p.v. grote textarea) ---------- */

export function ExpandCard({
  uitnodiging,
  placeholder,
  value,
  onChange,
}: {
  uitnodiging: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(value.length > 0);
  const ref = useRef<HTMLTextAreaElement>(null);
  const id = useId();

  return (
    <motion.div
      layout
      transition={{ duration: 0.4, ease: EASE }}
      className={cn(
        "w-full rounded-[1.4rem] bg-white text-left shadow-soft ring-1 ring-ink/[0.06]",
        open && "shadow-lift",
      )}
    >
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setTimeout(() => ref.current?.focus(), 60);
          }}
          className="flex w-full items-center justify-between gap-3 p-5 text-left"
        >
          <span className="text-[15px] font-semibold text-ink-500">
            {uitnodiging}
          </span>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cream-100 text-ink-500">
            <GlyphArrow className="h-4 w-4 rotate-90" />
          </span>
        </button>
      ) : (
        <div className="p-5">
          <label htmlFor={id} className="mb-2 block text-[13px] font-bold text-ink">
            {uitnodiging}
          </label>
          <textarea
            id={id}
            ref={ref}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 220)}px`;
            }}
            placeholder={placeholder}
            rows={2}
            className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-ink outline-none placeholder:text-ink-300/60"
          />
        </div>
      )}
    </motion.div>
  );
}

/* ---------- Menselijke reactie van DogWare ---------- */

export function Reaction({ children }: { children: ReactNode }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.55, ease: EASE, delay: 0.15 }}
      className="flex items-center gap-2 text-[14px] font-medium text-sage-600"
    >
      <GlyphSpark className="h-4 w-4 shrink-0 text-brand" />
      {children}
    </motion.p>
  );
}

/* ---------- Route-indicator: verbonden stappen, geen percentages ---------- */

export function StepRoute({
  labels,
  current,
}: {
  labels: string[];
  current: number;
}) {
  return (
    <nav aria-label="Jouw route" className="flex items-center gap-0">
      {labels.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <span key={label} className="flex items-center">
            {i > 0 && (
              <span
                className={cn(
                  "h-px w-4 transition-colors duration-500 sm:w-6",
                  done || active ? "bg-brand/50" : "bg-ink/10",
                )}
              />
            )}
            <span className="group relative flex items-center justify-center">
              <span
                className={cn(
                  "block rounded-full transition-all duration-500",
                  active
                    ? "h-2.5 w-2.5 bg-brand shadow-[0_0_0_5px_rgba(224,86,42,0.12)]"
                    : done
                      ? "h-2 w-2 bg-brand/60"
                      : "h-2 w-2 bg-ink/15",
                )}
              />
              <span
                className={cn(
                  "pointer-events-none absolute top-4 whitespace-nowrap text-[10px] font-semibold transition-opacity duration-300",
                  active ? "text-ink-500 opacity-100" : "opacity-0",
                )}
              >
                {label}
              </span>
            </span>
          </span>
        );
      })}
    </nav>
  );
}

/* ---------- Eigen knoppen ---------- */

export function NextButton({
  children = "Verder",
  onClick,
  disabled = false,
  pending = false,
}: {
  children?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  pending?: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled || pending}
      whileHover={disabled ? undefined : { y: -2 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.2, ease: EASE }}
      className={cn(
        "group inline-flex items-center gap-2.5 rounded-full px-7 py-3.5 text-[15px] font-bold transition-all duration-300",
        disabled
          ? "cursor-not-allowed bg-cream-200 text-ink-300"
          : "bg-ink text-cream shadow-lift hover:bg-ink-700",
      )}
    >
      {pending ? "Een moment…" : children}
      {!pending && (
        <GlyphArrow className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
      )}
    </motion.button>
  );
}

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[13px] font-semibold text-ink-300 transition-colors hover:text-ink-500"
    >
      ← terug
    </button>
  );
}
