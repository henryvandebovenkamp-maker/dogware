"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowRight, Clock, Check } from "lucide-react";
import {
  markDemoAccepted,
  markDeliveryReady,
  markWebsiteLive,
  createProposalDraft,
  sendReminder,
  type CommerceState,
} from "@/app/actions/commerce";
import type { NextAction } from "@/lib/journey-next";
import { cn } from "@/lib/cn";

const IDLE: CommerceState = { status: "idle" };

/**
 * De ene volgende stap, bovenaan de aanvraag.
 *
 * Bewust één knop. De beheerder hoeft niet te kiezen uit tien acties: de
 * journey bepaalt wat er nu logisch is, en wat er nog niet aan de beurt is
 * staat er simpelweg niet.
 */
export function NextActionPanel({
  leadId,
  next,
}: {
  leadId: string;
  next: NextAction;
}) {
  const wachten = next.waitingOn === "klant";
  return (
    <div
      className={cn(
        "rounded-2xl p-5 ring-1",
        wachten ? "bg-cream-100/70 ring-ink/5" : "bg-white shadow-soft ring-ink/5",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            next.waitingOn === "niemand"
              ? "bg-sage-100 text-sage-600"
              : wachten
                ? "bg-cream-200 text-ink-500"
                : "bg-brand-100 text-brand-600",
          )}
        >
          {next.waitingOn === "niemand" ? (
            <Check className="h-4 w-4" />
          ) : wachten ? (
            <Clock className="h-4 w-4" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-extrabold leading-snug text-ink">{next.situatie}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-500">
            <span className="font-semibold text-ink-700">Volgende stap:</span> {next.volgende}
          </p>
          {wachten && (
            <p className="mt-1.5 text-[12px] font-semibold text-ink-300">
              We wachten op de klant.
            </p>
          )}
          {next.cta && (
            <div className="mt-4">
              <ActionButton leadId={leadId} cta={next.cta} primair={!wachten} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  leadId,
  cta,
  primair,
}: {
  leadId: string;
  cta: NonNullable<NextAction["cta"]>;
  primair: boolean;
}) {
  const klas = primair
    ? "inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-[13px] font-bold text-white transition hover:-translate-y-px hover:bg-brand-600 disabled:opacity-60"
    : "inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[12.5px] font-bold text-ink-700 ring-1 ring-ink/10 transition hover:bg-cream disabled:opacity-60";

  if (cta.href) {
    return (
      <Link href={cta.href} className={klas}>
        {cta.label} <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    );
  }

  switch (cta.action) {
    case "demo-akkoord":
      return <FormButton leadId={leadId} action={markDemoAccepted} label={cta.label} klas={klas} />;
    case "voorstel-maken":
      return <FormButton leadId={leadId} action={createProposalDraft} label={cta.label} klas={klas} />;
    case "oplevering-klaarzetten":
      return <FormButton leadId={leadId} action={markDeliveryReady} label={cta.label} klas={klas} />;
    case "livegang":
      return <FormButton leadId={leadId} action={markWebsiteLive} label={cta.label} klas={klas} />;
    case "voorstel-herinneren":
      return <ReminderButton leadId={leadId} soort="voorstel" label={cta.label} klas={klas} />;
    case "overeenkomst-herinneren":
      return <ReminderButton leadId={leadId} soort="overeenkomst" label={cta.label} klas={klas} />;
    case "aanbetaling-herinneren":
      return <ReminderButton leadId={leadId} soort="aanbetaling" label={cta.label} klas={klas} />;
    case "restbetaling-herinneren":
      return <ReminderButton leadId={leadId} soort="restbetaling" label={cta.label} klas={klas} />;
    default:
      return null;
  }
}

type ActionFn = (prev: CommerceState, fd: FormData) => Promise<CommerceState>;

function FormButton({
  leadId,
  action,
  label,
  klas,
  extra,
}: {
  leadId: string;
  action: ActionFn;
  label: string;
  klas: string;
  extra?: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="leadId" value={leadId} />
      {extra &&
        Object.entries(extra).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
      <button type="submit" disabled={pending} className={klas}>
        {pending ? "Een moment…" : label}
      </button>
      {state.message && (
        <span
          className={cn(
            "text-[12px] font-semibold",
            state.status === "error" ? "text-brand-600" : "text-sage-600",
          )}
        >
          {state.message}
        </span>
      )}
    </form>
  );
}

function ReminderButton({
  leadId,
  soort,
  label,
  klas,
}: {
  leadId: string;
  soort: string;
  label: string;
  klas: string;
}) {
  return (
    <FormButton
      leadId={leadId}
      action={sendReminder}
      label={label}
      klas={klas}
      extra={{ soort }}
    />
  );
}
