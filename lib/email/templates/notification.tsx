import { Text } from "@react-email/components";
import { EmailLayout, paragraph } from "./base";

/** Generieke interne notificatie — voor systeem- en beheermeldingen. */
export function NotificationEmail({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <EmailLayout preview={title} heading={title}>
      <Text style={{ ...paragraph, whiteSpace: "pre-line" }}>{message}</Text>
    </EmailLayout>
  );
}
