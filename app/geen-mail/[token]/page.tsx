import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui";
import { Logo } from "@/components/brand";
import { leesAfmeldToken, meldAf } from "@/lib/groei/afmelden";

/**
 * Afmelden.
 *
 * Bewust één knop en geen formulier met redenen: iemand die wil dat je stopt,
 * hoort dat niet eerst te moeten uitleggen. De vraag komt hooguit ná de
 * bevestiging, en dan vrijblijvend.
 *
 * Het afmelden gebeurt op een POST en niet op het openen van de pagina. Veel
 * mailprogramma's laden links vooruit; op een GET zou je mensen afmelden die
 * alleen maar een mail openden.
 */

export const metadata: Metadata = {
  title: "Geen mail meer ontvangen",
  robots: { index: false, follow: false },
};

export default async function GeenMailPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ klaar?: string }>;
}) {
  const { token } = await params;
  const { klaar } = await searchParams;
  const geldig = leesAfmeldToken(token) !== null;

  async function bevestig() {
    "use server";
    await meldAf(token);
    redirect(`/geen-mail/${token}?klaar=1`);
  }

  const gedaan = klaar === "1";

  return (
    <main className="min-h-screen bg-cream py-16">
      <Container>
        <div className="mx-auto max-w-lg rounded-3xl bg-white p-8 shadow-soft ring-1 ring-ink/5 sm:p-10">
          <Logo className="h-8 w-auto" />

          {!geldig ? (
            <>
              <h1 className="mt-7 text-xl font-extrabold tracking-tight text-ink">
                Deze link werkt niet meer
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-500">
                Mogelijk is hij onderweg afgekapt door een mailprogramma. Stuur
                anders even een antwoord op de mail — dan zorg ik er persoonlijk
                voor.
              </p>
            </>
          ) : gedaan ? (
            <>
              <h1 className="mt-7 text-xl font-extrabold tracking-tight text-ink">
                Geregeld. Je hoort niets meer van me.
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-500">
                Je adres staat op mijn uitsluitlijst. Er gaat geen enkel bericht
                meer naar je toe, ook geen herinnering.
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-ink-500">
                Sorry voor de storing, en succes met je bedrijf.
              </p>
              <p className="mt-6 text-[13px] text-ink-300">— Henry</p>
            </>
          ) : (
            <>
              <h1 className="mt-7 text-xl font-extrabold tracking-tight text-ink">
                Geen mail meer van mij?
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-500">
                Eén klik en je staat op mijn uitsluitlijst. Ik stuur je dan
                niets meer — geen herinnering, geen tweede poging.
              </p>
              <form action={bevestig} className="mt-7">
                <button
                  type="submit"
                  className="rounded-xl bg-ink px-5 py-3 text-[15px] font-semibold leading-[1.2] text-cream transition-all duration-150 ease-out hover:-translate-y-px hover:bg-ink-700"
                >
                  Ja, geen mail meer
                </button>
              </form>
            </>
          )}
        </div>
      </Container>
    </main>
  );
}
