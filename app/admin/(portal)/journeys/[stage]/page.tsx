import { notFound, redirect } from "next/navigation";
import { JOURNEY_STAGES, type JourneyStage } from "@/lib/db/schema";
import { bakjeVanStage } from "@/lib/aanvragen";

export const metadata = { title: "Journey-fase" };

/**
 * Deze pagina toonde een tweede lijst met aanvragen, naast die op
 * /admin/leads. Twee overzichten van dezelfde gegevens is precies hoe je
 * uiteindelijk geen van beide vertrouwt: de een kende de volgende stap niet,
 * de ander de fase-indeling niet.
 *
 * De route blijft bestaan — er staan links naartoe in andere schermen en er
 * kunnen bladwijzers zijn — maar stuurt door naar het werkscherm, gefilterd op
 * het bakje waar deze fase in valt. Eén lijst, één waarheid.
 */
export default async function StageDetailPage({
  params,
}: {
  params: Promise<{ stage: string }>;
}) {
  const { stage } = await params;
  if (!JOURNEY_STAGES.includes(stage as JourneyStage)) notFound();
  redirect(`/admin/leads?bakje=${bakjeVanStage(stage as JourneyStage)}`);
}
