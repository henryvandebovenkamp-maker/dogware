import Link from "next/link";
import { BrandMark } from "@/components/brand";

/** Gedeelde schil voor login-, reset- en uitnodigingsschermen. */
export function AuthShell({
  titel,
  ondertitel,
  children,
}: {
  titel: string;
  ondertitel?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-cream px-5 py-16">
      <Link href="/" aria-label="Naar de homepage">
        <BrandMark size={52} className="h-13 w-13" />
      </Link>
      <div className="mt-6 w-full max-w-sm rounded-3xl bg-white p-7 shadow-lift ring-1 ring-ink/5 sm:p-8">
        <h1 className="text-xl font-extrabold tracking-tight text-ink">{titel}</h1>
        {ondertitel && (
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-500">
            {ondertitel}
          </p>
        )}
        <div className="mt-6">{children}</div>
      </div>
      <p className="mt-6 text-xs text-ink-300">
        DogWare — Meer tijd voor wat telt
      </p>
    </main>
  );
}

export function AuthField({
  label,
  name,
  type = "text",
  placeholder,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1.5 block text-[13px] font-semibold text-ink-700"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-xl border border-cream-200 bg-white px-4 py-3 text-[15px] text-ink outline-none transition placeholder:text-ink-300 focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
    </div>
  );
}
