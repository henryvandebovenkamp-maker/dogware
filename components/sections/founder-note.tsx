import { ArrowRight } from "lucide-react";
import { Avatar } from "@/components/photo";
import { Container } from "@/components/ui";

/**
 * Het vertrouwenssignaal direct onder de hero: wie zit er achter DogWare?
 *
 * Bewust piepklein gehouden — één regel met een gezicht erbij, geen tweede
 * verhaalsectie. Het volledige verhaal staat verderop op de pagina (Story,
 * `#verhaal`) en dit blokje is precies de brug daarnaartoe. De zwevende kaart
 * in de hero verwijst naar dezelfde plek, maar is op mobiel verborgen; dit
 * blokje is juist de mobiele variant van datzelfde signaal.
 */
export function FounderNote() {
  return (
    <section aria-label="Wie zit er achter DogWare" className="pt-8 sm:pt-10">
      <Container>
        {/* Eén rij op elk scherm: op mobiel wikkelt alleen de link naar de
            volgende regel, zodat het blokje daar niet uitgroeit tot een kaart. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-2xl bg-white/60 px-4 py-3.5 ring-1 ring-ink/5 sm:px-5">
          <Avatar
            file="henry-avatar.jpg"
            alt="Henry van de Bovenkamp"
            fallback="🐾"
            position="object-[30%_center]"
            className="h-11 w-11 shrink-0"
          />

          <p className="min-w-0 flex-1 basis-48 text-pretty">
            <span className="block text-[14px] font-extrabold tracking-tight text-ink">
              Gebouwd vanuit de praktijk
            </span>
            <span className="mt-0.5 block text-[14px] leading-relaxed text-ink-500">
              Door Henry van de Bovenkamp — zelf actief als hondentrainer en
              eigenaar van een uitlaatservice.
            </span>
          </p>

          <a
            href="#verhaal"
            className="group inline-flex shrink-0 items-center gap-1.5 text-[13px] font-bold text-brand transition-colors hover:text-brand-600"
          >
            Lees het verhaal achter DogWare
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>
      </Container>
    </section>
  );
}
