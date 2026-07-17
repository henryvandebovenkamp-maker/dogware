"use server";

import { sendMail, isEmailConfigured } from "@/lib/email/service";
import {
  sendDemoConfirmation,
  sendDemoRequestNotification,
  sendNotification,
  sendWelcomeEmail,
} from "@/lib/email/send";
import type { MailResult } from "@/lib/email/types";
import { isTestEmailAllowed } from "./auth";

export type TestEmailState = {
  status: "idle" | "success" | "error";
  message?: string;
  id?: string;
};

export async function sendTestEmail(
  _prev: TestEmailState,
  formData: FormData,
): Promise<TestEmailState> {
  // Server actions zijn ook via directe POST bereikbaar — dus ook hier de check.
  const token = String(formData.get("token") ?? "") || undefined;
  if (!isTestEmailAllowed(token)) {
    return { status: "error", message: "Geen toegang." };
  }

  if (!isEmailConfigured()) {
    return {
      status: "error",
      message:
        "E-mailservice niet geconfigureerd: zet RESEND_API_KEY en EMAIL_FROM in .env.local.",
    };
  }

  const to = String(formData.get("to") ?? "").trim();
  const template = String(formData.get("template") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();

  if (!to) {
    return { status: "error", message: "Vul een ontvanger in." };
  }

  let result: MailResult;
  switch (template) {
    case "demo-request":
      result = await sendDemoRequestNotification({
        naam: "Testpersoon",
        bedrijf: "Hondenschool Test",
        email: to,
        type: "Hondenschool",
      });
      break;
    case "demo-confirmation":
      result = await sendDemoConfirmation(to, "Testpersoon");
      break;
    case "welcome":
      result = await sendWelcomeEmail(to, "Testpersoon");
      break;
    case "notification":
      result = await sendNotification(
        subject || "Testnotificatie van DogWare",
        "Dit is een testnotificatie, verzonden vanaf /admin/test-email.",
        to,
      );
      break;
    default:
      result = await sendMail("test", {
        to,
        subject: subject || "Testmail van DogWare",
        text: "Dit is een kale testmail, verzonden vanaf /admin/test-email.",
      });
  }

  if (!result.ok) {
    return { status: "error", message: result.error.message };
  }
  return { status: "success", message: `Verzonden aan ${to}`, id: result.id };
}
