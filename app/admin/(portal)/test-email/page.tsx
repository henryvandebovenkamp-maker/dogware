import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { isEmailConfigured } from "@/lib/email/service";
import { TestEmailForm } from "./test-form";

export const metadata: Metadata = {
  title: "E-mail testen",
  robots: { index: false, follow: false },
};

export default function TestEmailPage() {
  const configured = isEmailConfigured();

  return (
    <main className="flex items-center justify-center px-5 py-8">
      <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-lift ring-1 ring-ink/5 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white">
            <Mail className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-extrabold text-ink">E-mail testen</h1>
            <p className="text-[13px] text-ink-500">
              Tijdelijke beheerpagina · alleen voor intern gebruik
            </p>
          </div>
        </div>

        {!configured && (
          <div className="mb-5 rounded-xl bg-brand-100 p-4 text-sm text-brand-600">
            <strong>Niet geconfigureerd.</strong> Zet <code>RESEND_API_KEY</code>{" "}
            en <code>EMAIL_FROM</code> in <code>.env.local</code> en herstart de
            dev-server.
          </div>
        )}

        <TestEmailForm />
      </div>
    </main>
  );
}
