import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getDb, schema } from "@/lib/db";
import { isAdminAllowed } from "@/lib/admin-auth";
import { LeadStatusBadge } from "../status-badge";
import { LeadAdminForm } from "./lead-admin-form";

export const metadata: Metadata = {
  title: "Lead",
  robots: { index: false, follow: false },
};

const WEBSITE_LABELS: Record<string, string> = {
  nee: "Nee",
  ja: "Ja",
  "ja-nieuw": "Ja, maar wil iets nieuws",
};

function Blok({
  titel,
  children,
}: {
  titel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
      <h2 className="mb-2.5 text-sm font-extrabold uppercase tracking-wide text-ink-300">
        {titel}
      </h2>
      {children}
    </section>
  );
}

function Regel({ label, value }: { label: string; value?: string | null }) {
  if (!value?.trim()) return null;
  return (
    <p className="text-[15px] leading-relaxed text-ink-700">
      <span className="font-bold text-ink">{label}:</span> {value}
    </p>
  );
}

function Chips({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-sm text-ink-300">—</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i) => (
        <span
          key={i}
          className="rounded-full bg-cream-100 px-3 py-1 text-xs font-semibold text-ink-700"
        >
          {i}
        </span>
      ))}
    </div>
  );
}

function Vrij({ text }: { text?: string | null }) {
  if (!text?.trim()) return <p className="text-sm text-ink-300">—</p>;
  return (
    <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink-700">
      {text}
    </p>
  );
}

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const [{ id }, { token }] = await Promise.all([params, searchParams]);
  if (!isAdminAllowed(token)) notFound();

  const db = getDb();
  if (!db) notFound();

  const [lead] = await db
    .select()
    .from(schema.leads)
    .where(eq(schema.leads.id, id))
    .limit(1);
  if (!lead) notFound();

  const tokenSuffix = token ? `?token=${encodeURIComponent(token)}` : "";

  return (
    <main className="min-h-screen bg-cream px-5 py-16">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          href={`/admin/leads${tokenSuffix}`}
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-ink-500 transition hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> Alle leads
        </Link>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-ink">
              {lead.bedrijfsnaam}
            </h1>
            <p className="text-sm text-ink-500">
              Aangevraagd op{" "}
              {lead.createdAt.toLocaleString("nl-NL", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <LeadStatusBadge status={lead.status} />
        </div>

        <div className="space-y-4">
          <Blok titel="Contactgegevens">
            <div className="space-y-1">
              <Regel label="Naam" value={lead.naam} />
              <Regel label="E-mail" value={lead.email} />
              <Regel label="Telefoon" value={lead.telefoon} />
              <Regel label="Website" value={lead.website} />
              <Regel label="Plaats" value={lead.plaats} />
            </div>
          </Blok>

          <Blok titel="Diensten">
            <Chips items={lead.diensten} />
            {lead.dienstenAnders && (
              <p className="mt-2 text-sm text-ink-700">
                <span className="font-bold">Anders:</span> {lead.dienstenAnders}
              </p>
            )}
          </Blok>

          <Blok titel="Huidige website">
            <div className="space-y-1">
              <Regel
                label="Heeft website"
                value={
                  lead.heeftWebsite
                    ? WEBSITE_LABELS[lead.heeftWebsite]
                    : undefined
                }
              />
              <Regel label="Goed aan huidige site" value={lead.websiteGoed} />
              <Regel label="Mist" value={lead.websiteMist} />
            </div>
          </Blok>

          <Blok titel="Huidige software">
            <Chips items={lead.software} />
          </Blok>

          <Blok titel="Grootste tijdvreters">
            <Chips items={lead.tijdvreters} />
          </Blok>

          <Blok titel="Droomwebsite">
            <Vrij text={lead.droomscenario} />
          </Blok>

          <Blok titel="Inspiratie">
            <Vrij text={lead.inspiratie} />
          </Blok>

          <Blok titel="Huisstijl">
            <div className="space-y-1">
              <Regel
                label="Logo"
                value={
                  lead.heeftLogo === "ja"
                    ? "Ja"
                    : lead.heeftLogo === "nee"
                      ? "Nee"
                      : undefined
                }
              />
              <Regel label="Kleuren / huisstijl" value={lead.huisstijl} />
            </div>
            {lead.uploads.length > 0 && (
              <ul className="mt-2.5 space-y-1.5">
                {lead.uploads.map((url) => (
                  <li key={url}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-600"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {decodeURIComponent(url.split("/").pop() ?? url)}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Blok>

          <Blok titel="Gewenste functies">
            <Chips items={lead.functies} />
          </Blok>

          <Blok titel="Extra opmerkingen">
            <Vrij text={lead.opmerkingen} />
          </Blok>

          <Blok titel="Opvolging">
            <LeadAdminForm
              leadId={lead.id}
              status={lead.status}
              notities={lead.notities ?? ""}
              token={token}
            />
          </Blok>
        </div>
      </div>
    </main>
  );
}
