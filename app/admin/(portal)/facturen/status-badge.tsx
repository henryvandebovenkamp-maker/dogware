import type { InvoiceStatus } from "@/lib/db/schema";
import { INVOICE_STATUS_LABEL } from "@/lib/invoices";
import { cn } from "@/lib/cn";

/**
 * Eén plek voor de kleur van een factuurstatus.
 *
 * Openstaand is rustig, verlopen valt op, betaald is groen en een
 * gecrediteerde of geannuleerde factuur is grijs — die telt niet meer mee.
 */
const STIJL: Record<InvoiceStatus, string> = {
  CONCEPT: "bg-cream-100 text-ink-500 ring-ink/5",
  OPEN: "bg-gold/15 text-[#8a6110] ring-gold/20",
  BETAALD: "bg-sage-100 text-sage-600 ring-sage/15",
  VERLOPEN: "bg-brand-100 text-brand-600 ring-brand/15",
  GECREDITEERD: "bg-cream-200 text-ink-500 ring-ink/5",
  GEANNULEERD: "bg-cream-200 text-ink-300 ring-ink/5",
};

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-bold ring-1",
        STIJL[status],
      )}
    >
      {INVOICE_STATUS_LABEL[status]}
    </span>
  );
}
