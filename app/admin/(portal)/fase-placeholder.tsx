import { GlyphSpark } from "@/components/demo/illustrations";

/** Verzorgde status voor onderdelen die in een volgende fase worden ingericht. */
export function FasePlaceholder({
  titel,
  omschrijving,
}: {
  titel: string;
  omschrijving: string;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">{titel}</h1>
      <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-cream-200 bg-white/60 px-6 py-16 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand">
          <GlyphSpark className="h-6 w-6" />
        </span>
        <p className="mt-4 text-[15px] font-bold text-ink">
          Dit onderdeel wordt in een volgende fase ingericht.
        </p>
        <p className="mt-2 max-w-md text-[13px] leading-relaxed text-ink-500">
          {omschrijving}
        </p>
      </div>
    </div>
  );
}
