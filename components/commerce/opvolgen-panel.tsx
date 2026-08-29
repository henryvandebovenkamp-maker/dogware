"use client";

import { useActionState } from "react";
import { Clock, Mail, Phone } from "lucide-react";
import { sendReminder, type CommerceState } from "@/app/actions/commerce";
import { cn } from "@/lib/cn";

const IDLE: CommerceState = { status: "idle" };

/**
 * Het blok dat verschijnt zodra een verstuurde demo stil blijft.
 *
 * De herinnering gaat er nadrukkelijk NIET vanzelf uit. Hij staat hier klaar en
 * wordt pas verstuurd als de beheerder erop klikt. Een commerciële mail die
 * ongezien namens Henry de deur uit gaat is precies wat je niet wilt; de
 * architectuur staat automatisering later wel toe, maar dan als bewuste keuze.
 *
 * Naast de mail staan bellen en mailen als directe links. Vaak is een telefoontje
 * na een week stilte effectiever dan nog een bericht, en dan hoort die knop
 * hier te staan en niet drie schermen verderop.
 */
export function OpvolgenPanel({
  leadId,
  reden,
  telefoon,
  email,
  naam,
}: {
  leadId: string;
  reden: string;
  telefoon: string | null;
  email: string;
  naam: string;
}) {
  const [state, formAction, pending] = useActionState(sendReminder, IDLE);

  return (
    <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-brand/20">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600">
          <Clock className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-extrabold leading-snug text-ink">
            Deze aanvraag vraagt om opvolging
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-500">{reden}</p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <form action={formAction}>
              <input type="hidden" name="leadId" value={leadId} />
              <input type="hidden" name="soort" value="demo" />
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-[13px] font-bold text-white transition hover:-translate-y-px hover:bg-brand-600 disabled:opacity-60"
              >
                <Mail className="h-3.5 w-3.5" />
                {pending ? "Versturen…" : "Herinnering versturen"}
              </button>
            </form>

            {telefoon && (
              <a
                href={`tel:${telefoon.replace(/\s/g, "")}`}
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[12.5px] font-bold text-ink-700 ring-1 ring-ink/10 transition hover:bg-cream"
              >
                <Phone className="h-3.5 w-3.5" />
                Bel {naam.split(" ")[0]}
              </a>
            )}

            <a
              href={`mailto:${email}`}
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[12.5px] font-bold text-ink-700 ring-1 ring-ink/10 transition hover:bg-cream"
            >
              Zelf mailen
            </a>
          </div>

          <p className="mt-3 text-[12px] text-ink-300">
            De herinnering gaat pas weg als je erop klikt — er wordt niets
            automatisch verstuurd.
          </p>

          {state.message && (
            <p
              className={cn(
                "mt-3 text-[12px] font-semibold",
                state.status === "error" ? "text-brand-600" : "text-sage-600",
              )}
            >
              {state.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
