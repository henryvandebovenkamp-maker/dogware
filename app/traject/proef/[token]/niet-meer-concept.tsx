import { BrandMark } from "@/components/brand";

/** Een proeflink van een concept dat inmiddels verstuurd of vervangen is. */
export function ProefNietMeerConcept() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-5">
      <div className="max-w-md rounded-2xl bg-white p-7 text-center shadow-soft ring-1 ring-ink/5">
        <BrandMark size={34} className="mx-auto h-[34px] w-[34px]" />
        <h1 className="mt-4 text-xl font-extrabold tracking-tight text-ink">Deze proef is verlopen</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-500">
          Het concept waar deze proef bij hoorde is inmiddels verstuurd of vervangen. Stuur vanuit de
          editor een nieuwe proef om de actuele versie te bekijken.
        </p>
      </div>
    </div>
  );
}
