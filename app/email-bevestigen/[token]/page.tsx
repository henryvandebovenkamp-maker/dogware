import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { bekijkEmailWijziging } from "@/lib/email-wijziging";
import { BevestigEmailForm } from "./bevestig-form";

export const metadata: Metadata = {
  title: "E-mailadres bevestigen",
  robots: { index: false, follow: false },
};

/**
 * Bevestigingspagina voor een nieuw e-mailadres. Het openen van de link
 * verandert niets — mailscanners openen links automatisch. Pas de knop
 * (een POST) voert de wijziging door.
 */
export default async function EmailBevestigenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const aanvraag = await bekijkEmailWijziging(token);

  return (
    <AuthShell
      titel="Nieuw e-mailadres bevestigen"
      ondertitel={
        aanvraag
          ? `Bevestig dat je DogWare-account voortaan ${aanvraag.newEmail} gebruikt. Je account, persoonlijke link en commissies blijven ongewijzigd.`
          : "Deze link is verlopen, al gebruikt of ingetrokken. Neem contact op met DogWare voor een nieuwe link."
      }
    >
      {aanvraag && <BevestigEmailForm token={token} />}
    </AuthShell>
  );
}
