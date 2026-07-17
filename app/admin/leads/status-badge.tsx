import { cn } from "@/lib/cn";
import type { LeadStatus } from "@/lib/db/schema";

const STYLES: Record<LeadStatus, string> = {
  nieuw: "bg-brand-100 text-brand-600",
  "demo in de maak": "bg-gold/15 text-gold",
  "demo verstuurd": "bg-sage-100 text-sage-600",
  "contact gehad": "bg-cream-200 text-ink-700",
  "klant geworden": "bg-sage text-white",
  afgevallen: "bg-cream-100 text-ink-300",
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-xs font-bold",
        STYLES[status] ?? "bg-cream-100 text-ink-700",
      )}
    >
      {status}
    </span>
  );
}
