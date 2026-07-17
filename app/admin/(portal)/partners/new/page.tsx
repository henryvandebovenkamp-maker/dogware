import Link from "next/link";
import { NewPartnerForm } from "./new-partner-form";

export const metadata = { title: "Nieuwe partner" };

export default function NewPartnerPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/admin/partners"
        className="text-[13px] font-semibold text-ink-300 hover:text-ink-500"
      >
        ← Alle partners
      </Link>
      <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-ink">
        Nieuwe partner uitnodigen
      </h1>
      <p className="mt-1 text-sm text-ink-500">
        De partner ontvangt automatisch een uitnodigingsmail met een veilige
        activatielink (7 dagen geldig, eenmalig bruikbaar).
      </p>
      <div className="mt-6 rounded-2xl bg-white p-6 shadow-soft ring-1 ring-ink/5">
        <NewPartnerForm />
      </div>
    </div>
  );
}
