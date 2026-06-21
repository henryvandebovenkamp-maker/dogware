const AUDIENCES = [
  "Hondenscholen",
  "Uitlaatservices",
  "Gedragstherapeuten",
  "Trimsalons",
  "Hondenopvang",
  "Hondenpensions",
  "Osteopaten",
  "Fysiotherapeuten",
  "Speur- & detectiescholen",
  "Puppycoaches",
];

export function AudienceStrip() {
  return (
    <section aria-label="Voor wie is DogWare" className="border-y border-cream-200 bg-white/50 py-7">
      <p className="mb-5 text-center text-xs font-semibold uppercase tracking-[0.18em] text-ink-300">
        Gebouwd voor iedere ondernemer die werkt met honden
      </p>
      <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
        <div className="flex w-max animate-marquee items-center gap-3 pr-3">
          {[...AUDIENCES, ...AUDIENCES].map((label, i) => (
            <span
              key={i}
              className="whitespace-nowrap rounded-full bg-cream px-4 py-2 text-sm font-semibold text-ink-700 ring-1 ring-ink/5"
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
