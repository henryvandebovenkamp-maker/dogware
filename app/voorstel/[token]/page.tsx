import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { Container } from "@/components/ui";
import { Logo } from "@/components/brand";
import { getDb, schema } from "@/lib/db";
import { branding } from "@/lib/branding";
import { BRANCHES } from "@/lib/branches";
import { logGroeiEvent, setStap } from "@/lib/groei";

/**
 * Het inspiratievoorstel zoals het bedrijf het ziet.
 *
 * Bewust een pagina met een onraadbare sleutel in plaats van een verborgen
 * trackingpixel in de mail. Zo meet je een bewúste klik in plaats van een
 * geopende mail — een eerlijker signaal, en het scheelt het stilzwijgend
 * volgen van mensen die daar nooit om vroegen.
 */

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function VoorstelPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = getDb();
  if (!db) notFound();

  const [voorstel] = await db
    .select()
    .from(schema.groeiVoorstellen)
    .where(eq(schema.groeiVoorstellen.token, token))
    .limit(1);
  if (!voorstel) notFound();

  const [prospect] = await db
    .select()
    .from(schema.groeiProspects)
    .where(eq(schema.groeiProspects.id, voorstel.prospectId))
    .limit(1);
  if (!prospect) notFound();

  // De opening registreren. Eerste keer is nieuws; daarna tellen we alleen mee.
  const eersteKeer = voorstel.aantalKeerGeopend === 0;
  await db
    .update(schema.groeiVoorstellen)
    .set({
      aantalKeerGeopend: sql`${schema.groeiVoorstellen.aantalKeerGeopend} + 1`,
      laatstGeopendAt: new Date(),
      ...(eersteKeer ? { geopendAt: new Date() } : {}),
    })
    .where(eq(schema.groeiVoorstellen.id, voorstel.id));

  if (eersteKeer) {
    await logGroeiEvent(prospect.id, "gelezen", "Voorstel voor het eerst geopend");
    await setStap(prospect.id, "gelezen");
  } else {
    await logGroeiEvent(
      prospect.id,
      "gelezen",
      `Voorstel opnieuw bekeken (${voorstel.aantalKeerGeopend + 1}×)`,
    );
  }

  const branche = BRANCHES.find((b) => b.slug === prospect.branche);

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-cream-200 bg-white/60 py-5">
        <Container className="flex items-center justify-between gap-4">
          <Logo />
          <span className="text-[12px] font-semibold text-ink-300">
            Persoonlijk voor {prospect.bedrijfsnaam}
          </span>
        </Container>
      </header>

      <main className="py-16 sm:py-24">
        <Container className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
            Een paar ideeën
          </p>
          <h1 className="mt-4 text-balance text-3xl font-extrabold leading-[1.1] tracking-tight text-ink sm:text-4xl">
            {voorstel.titel}
          </h1>

          <p className="mt-6 text-pretty text-lg leading-relaxed text-ink-500">
            {voorstel.intro}
          </p>

          <div className="mt-4 rounded-2xl bg-white px-6 py-5 shadow-soft ring-1 ring-ink/5">
            <p className="text-[15px] leading-relaxed text-ink-700">
              Dit is geen offerte en geen verkooppraatje. Ik kwam jullie bedrijf tegen,
              ben even op de website blijven hangen en kreeg een paar ideeën. Doe ermee
              wat je wilt — ik ben vooral benieuwd wat je ervan vindt.
            </p>
            <p className="mt-3 text-[14px] font-semibold text-ink">
              Henry · oprichter van {branding.name}
            </p>
          </div>

          {voorstel.secties.length > 0 && (
            <div className="mt-14 space-y-4">
              {voorstel.secties.map((s, i) => (
                <section
                  key={s.kop}
                  className="rounded-3xl bg-white p-7 shadow-soft ring-1 ring-ink/5"
                >
                  <span className="text-[12px] font-bold text-ink-300">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h2 className="mt-2 text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
                    {s.kop}
                  </h2>
                  <p className="mt-3 text-pretty text-[15px] leading-relaxed text-ink-500">
                    {s.tekst}
                  </p>
                  {s.module && (
                    <p className="mt-4 inline-flex rounded-full bg-brand-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-brand">
                      {s.module}
                    </p>
                  )}
                </section>
              ))}
            </div>
          )}

          <div className="mt-14 rounded-3xl bg-ink px-7 py-8 text-cream">
            <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">
              Benieuwd hoe dit er voor{" "}
              {branche ? `een ${branche.naamKlein}` : "jullie"} uitziet?
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-cream/70">
              Ik maak kosteloos een voorbeeld met jullie eigen diensten erin. Geen
              offerte, je zit nergens aan vast.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={branche ? `/demo?branche=${branche.demoService ?? ""}` : "/demo"}
                className="inline-flex items-center rounded-xl bg-brand px-5 py-3 text-[15px] font-semibold leading-[1.2] text-white transition-all duration-150 ease-out hover:-translate-y-px hover:bg-brand-600"
              >
                Laat mijn voorbeeld maken
              </a>
              <a
                href={`mailto:${process.env.EMAIL_REPLY_TO ?? ""}?subject=${encodeURIComponent(`Reactie van ${prospect.bedrijfsnaam}`)}`}
                className="inline-flex items-center rounded-xl px-5 py-3 text-[15px] font-semibold leading-[1.2] text-cream ring-1 ring-white/20 transition-all duration-150 ease-out hover:-translate-y-px hover:bg-white/10"
              >
                Even reageren
              </a>
            </div>
          </div>

          <p className="mt-10 text-center text-[12px] leading-relaxed text-ink-300">
            Je krijgt dit omdat ik jullie bedrijf tegenkwam en dacht dat dit interessant
            kon zijn. Liever niet meer? Antwoord met één woord op mijn mail, dan haal ik
            je er meteen af.
          </p>
        </Container>
      </main>
    </div>
  );
}
