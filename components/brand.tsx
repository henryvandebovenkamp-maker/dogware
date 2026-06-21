import { cn } from "@/lib/cn";

export function PawMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <ellipse cx="24" cy="30" rx="11" ry="9" fill="currentColor" />
      <ellipse cx="11.5" cy="20" rx="4.5" ry="6" fill="currentColor" />
      <ellipse cx="36.5" cy="20" rx="4.5" ry="6" fill="currentColor" />
      <ellipse cx="18.5" cy="11" rx="4" ry="5.5" fill="currentColor" />
      <ellipse cx="29.5" cy="11" rx="4" ry="5.5" fill="currentColor" />
    </svg>
  );
}

export function Logo({
  className,
  onDark = false,
}: {
  className?: string;
  onDark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white shadow-[0_6px_18px_-6px_rgba(224,86,42,0.7)]">
        <PawMark className="h-5 w-5" />
      </span>
      <span
        className={cn(
          "text-[1.35rem] font-extrabold tracking-tight leading-none",
          onDark ? "text-cream" : "text-ink",
        )}
      >
        Dog<span className="text-brand">Ware</span>
      </span>
    </span>
  );
}
