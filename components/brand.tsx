import Image from "next/image";
import { branding } from "@/lib/branding";
import { cn } from "@/lib/cn";

/**
 * Officieel DogWare-beeldmerk: de D met hondenkop.
 * Bron: lib/branding.ts → public/brand/mark.png (transparant, werkt op licht én donker).
 */
export function BrandMark({
  className,
  size = 36,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <Image
      src={branding.logo.mark}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={cn("select-none", className)}
    />
  );
}

/** Volledig logo: beeldmerk + woordmerk. Tekst blijft HTML voor maximale scherpte. */
export function Logo({
  className,
  onDark = false,
}: {
  className?: string;
  onDark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark size={38} className="h-[38px] w-[38px]" />
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
