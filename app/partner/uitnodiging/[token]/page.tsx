import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { AcceptInviteForm } from "@/components/auth/auth-forms";
import { peekToken } from "@/lib/auth/tokens";

export const metadata: Metadata = {
  title: "Partneraccount activeren",
  robots: { index: false, follow: false },
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const valid = await peekToken(token, "INVITE");

  return (
    <AuthShell
      titel="Welkom bij het Partnerprogramma"
      ondertitel={
        valid
          ? "Bevestig je account en je partneromgeving staat direct klaar."
          : "Deze uitnodiging is verlopen of al gebruikt. Vraag DogWare om een nieuwe uitnodiging."
      }
    >
      {valid && <AcceptInviteForm token={token} />}
    </AuthShell>
  );
}
