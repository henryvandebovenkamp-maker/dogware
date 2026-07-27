import { Plus } from "lucide-react";
import { Container, SectionHeading } from "@/components/ui";

export type FaqItem = { v: string; a: string };

/**
 * Veelgestelde vragen. Bewust met <details>/<summary>: toegankelijk,
 * werkt zonder JavaScript en de antwoorden staan in de HTML, zodat Google ze
 * meeneemt. De JSON-LD staat op de pagina zelf.
 */
export function Faq({
  items,
  titel = "Veelgestelde vragen",
  intro,
}: {
  items: FaqItem[];
  titel?: string;
  intro?: string;
}) {
  return (
    <section id="faq" className="py-20 sm:py-28">
      <Container>
        <SectionHeading eyebrow="Goed om te weten" title={titel} intro={intro} />

        <div className="mx-auto mt-12 max-w-3xl space-y-3">
          {items.map((item) => (
            <details
              key={item.v}
              className="group rounded-2xl bg-white px-6 py-5 shadow-soft ring-1 ring-ink/5 transition-shadow open:shadow-lift"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-bold text-ink marker:hidden [&::-webkit-details-marker]:hidden">
                {item.v}
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand transition-transform group-open:rotate-45">
                  <Plus className="h-4 w-4" />
                </span>
              </summary>
              <p className="mt-3 text-pretty text-[15px] leading-relaxed text-ink-500">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
