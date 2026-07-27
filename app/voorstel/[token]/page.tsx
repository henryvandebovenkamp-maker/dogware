import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { Container } from "@/components/ui";
import { getDb, schema } from "@/lib/db";
import { branding } from "@/lib/branding";
import { BRANCHES } from "@/lib/branches";
import { logGroeiEvent, setStap } from "@/lib/groei";
import { laatsteAnalyse } from "@/lib/groei/onderzoek";
import { veiligAccent } from "@/lib/groei/accent";
import { afmeldLink } from "@/lib/groei/afmelden";

/**
 * Het inspiratievoorstel zoals het bedrijf het ziet.
 *
 * Bewust een pagina met een onraadbare sleutel in plaats van een verborgen
 * trackingpixel in de mail. Zo meet je een bewúste klik in plaats van een
 * geopende mail — een eerlijker signaal, en het scheelt het stilzwijgend
 * volgen van mensen die daar nooit om vroegen.
 *
 * De pagina gaat over hén. Hun naam groot, hun eigen foto, hun accentkleur,
 * en bovenaan wat er al goed gaat — nooit wat er mis is. Het DogWare-logo
 * staat pas onderaan, want daar hoort het: dit is geen folder.
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
  const analyse = await laatsteAnalyse(prospect.id);

  // Hun eigen kleur als die leesbaar is; anders die van ons.
  const accent = veiligAccent(prospect.stijl.themeColor) ?? branding.colors.primary;
  const hunFoto = prospect.stijl.ogImage ?? null;
  const voornaam = prospect.voornaam?.trim() || null;

  return (
    <div className="min-h-screen bg-cream">
      {/* ---------------------------------------------------------------- kop --
          Hun naam groot, in hun eigen kleur. Geen navigatie, geen logo: dit is
          een brief, geen website.

          Hebben ze een eigen deelfoto, dan ligt die er zacht onder. Zo niet,
          dan blijft het een warm gemaakt vlak — een willekeurige stockfoto van
          iemand anders' hond zou juist onpersoonlijk zijn. */}
      <header className="relative overflow-hidden">
        {/* Twee zachte gloeden, waarvan één in hún kleur. Warm in plaats van
            donker: een bijna zwarte balk leest als een aankondiging, en dit
            moet lezen als iemand die aanbelt. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="absolute -left-32 -top-40 h-[28rem] w-[28rem] rounded-full opacity-40 blur-3xl"
            style={{ backgroundColor: accent }}
          />
          <div className="absolute -right-40 -top-10 h-96 w-96 rounded-full bg-sage-100 opacity-80 blur-3xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ink/10 to-transparent" />
        </div>

        <Container className="max-w-3xl">
          <div
            className={`grid items-center gap-10 py-14 sm:py-20 ${
              hunFoto ? "lg:grid-cols-[1.35fr_1fr]" : ""
            }`}
          >
            <div>
              <span
                className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3.5 py-1.5 text-[12px] font-bold text-ink shadow-soft ring-1 ring-ink/5"
                style={{ color: accent }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: accent }}
                />
                Persoonlijk voor {prospect.bedrijfsnaam}
              </span>

              <h1 className="mt-5 text-balance text-[34px] font-extrabold leading-[1.05] tracking-tight text-ink sm:text-[46px]">
                {voorstel.titel}
              </h1>
              <p className="mt-4 text-[15px] text-ink-300">
                {prospect.plaats ? `${prospect.plaats} · ` : ""}
                geschreven na een bezoek aan jullie eigen site
              </p>
            </div>

            {/* Hun eigen deelfoto, in een lijstje. Als achtergrond zou hij
                verdwijnen; zo is het zichtbaar hún beeld. */}
            {hunFoto && (
              <div className="relative">
                <div className="overflow-hidden rounded-3xl bg-white p-2 shadow-lift ring-1 ring-ink/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={hunFoto}
                    alt={prospect.bedrijfsnaam}
                    className="aspect-[4/3] w-full rounded-2xl object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
            )}
          </div>
        </Container>
      </header>

      <main className="pb-20 sm:pb-28">
        <Container className="max-w-3xl">
          {/* ------------------------------------------------------- de brief --
              Henry aan het woord, met zijn gezicht erbij. Half over de kop
              heen, zodat het voelt alsof hij binnenkomt lopen. */}
          <div className="flex flex-col gap-5 rounded-3xl bg-white p-7 shadow-lift ring-1 ring-ink/5 sm:flex-row sm:items-start sm:gap-6 sm:p-8">
            <Image
              src="/photos/henry-avatar.jpg"
              alt="Henry van de Bovenkamp"
              width={80}
              height={80}
              className="h-20 w-20 shrink-0 rounded-full object-cover ring-4 ring-cream-100"
            />
            <div className="min-w-0">
              <p className="text-pretty text-[17px] leading-relaxed text-ink-700 sm:text-lg">
                {voornaam ? `Hoi ${voornaam}, ik` : "Ik"} kwam jullie tegen, ben even
                op de site blijven hangen en kreeg een paar ideeën. Dit is geen
                offerte en geen verkooppraatje — doe ermee wat je wilt. Ik ben
                vooral benieuwd wat je ervan vindt.
              </p>
              <p className="mt-4 text-[15px] font-bold text-ink">Henry</p>
              <p className="text-[13px] text-ink-300">
                zelf uit de hondenbranche, bouwde {branding.name}
              </p>
            </div>
          </div>

          {/* ------------------------------------------------- wat al goed is --
              Elk gesprek begint hier. Nooit met wat er mis is. */}
          {analyse && analyse.sterk.length > 0 && (
            <section className="mt-12 rounded-3xl bg-sage-100/50 p-7 ring-1 ring-sage-600/10 sm:p-9">
              <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-sage-600">
                Wat me opviel dat goed zit
              </h2>
              <ul className="mt-5 space-y-4">
                {analyse.sterk.map((punt) => (
                  <li key={punt} className="flex gap-4">
                    <span
                      className="mt-[9px] h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: accent }}
                    />
                    <p className="text-pretty text-[17px] leading-relaxed text-ink-700">
                      {punt}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* -------------------------------------------------- het bewijs ----
              De concrete dingen van hún site, met waar ze stonden. Dit is wat
              een mens onderscheidt van een mailing: niemand verzint dit. */}
          {analyse && analyse.details.length > 0 && (
            <section className="mt-12 rounded-3xl bg-white p-7 shadow-soft ring-1 ring-ink/5 sm:p-8">
              <h2 className="text-[15px] font-extrabold text-ink">
                Dit las ik op jullie site
              </h2>
              <p className="mt-1 text-[13px] text-ink-300">
                Zodat je weet dat hier echt iemand heeft gekeken.
              </p>
              <ul className="mt-5 space-y-4">
                {analyse.details.slice(0, 5).map((d) => (
                  <li
                    key={d.wat}
                    className="border-l-2 pl-4"
                    style={{ borderColor: accent }}
                  >
                    <p className="text-pretty text-[15px] leading-relaxed text-ink-700">
                      {d.wat}
                    </p>
                    <p className="mt-1 text-[12px] text-ink-300">{d.waar}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ---------------------------------------------------- de ideeën -- */}
          {voorstel.secties.length > 0 && (
            <section className="mt-14">
              <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-ink-300">
                Waar ik aan dacht
              </h2>
              <div className="mt-6 space-y-3">
                {voorstel.secties.map((s, i) => (
                  <article
                    key={s.kop}
                    className="rounded-3xl bg-white p-7 shadow-soft ring-1 ring-ink/5 transition-shadow hover:shadow-lift sm:p-8"
                  >
                    <div className="flex items-baseline gap-3">
                      <span
                        className="text-[13px] font-extrabold"
                        style={{ color: accent }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <h3 className="text-pretty text-xl font-extrabold tracking-tight text-ink sm:text-[22px]">
                        {s.kop}
                      </h3>
                    </div>
                    <p className="mt-3 text-pretty text-[16px] leading-relaxed text-ink-500">
                      {s.tekst}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* ------------------------------------------------------ de vraag --
              Eén uitnodiging, zacht gesteld. Antwoorden mag ook gewoon. */}
          <section className="mt-14 overflow-hidden rounded-3xl bg-brand-50 ring-1 ring-brand/10">
            <div className="grid gap-8 p-7 sm:p-9 lg:grid-cols-[1.4fr_1fr] lg:items-center">
              <div>
                <h2 className="text-balance text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]">
                  Zal ik het een keer laten zien?
                </h2>
                <p className="mt-3 text-pretty text-[16px] leading-relaxed text-ink-500">
                  Ik maak kosteloos een voorbeeld met{" "}
                  {prospect.bedrijfsnaam} erin — jullie eigen cursussen en
                  diensten, zodat je meteen ziet of het iets voor je is. Je zit
                  nergens aan vast.
                </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <a
                  href={branche ? `/demo?branche=${branche.demoService ?? ""}` : "/demo"}
                  className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-[15px] font-semibold leading-[1.2] text-white transition-all duration-150 ease-out hover:-translate-y-px"
                  style={{ backgroundColor: accent }}
                >
                  Laat maar zien
                </a>
                <a
                  href={`mailto:${process.env.EMAIL_REPLY_TO ?? ""}?subject=${encodeURIComponent(`Reactie van ${prospect.bedrijfsnaam}`)}`}
                  className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-[15px] font-semibold leading-[1.2] text-ink-500 ring-1 ring-ink/10 transition-all duration-150 ease-out hover:-translate-y-px hover:bg-cream hover:text-ink"
                >
                  Liever eerst even mailen
                </a>
              </div>
              </div>

              {/* Een gezicht bij het aanbod. Zonder foto is dit een knop; met
                  foto is het iemand die het aanbiedt. */}
              <Image
                src="/photos/henry-portret.jpg"
                alt="Henry van de Bovenkamp"
                width={420}
                height={315}
                sizes="(min-width: 1024px) 300px, 100vw"
                className="hidden aspect-[4/3] w-full rounded-2xl object-cover object-left shadow-soft lg:block"
              />
            </div>
          </section>

          {/* ------------------------------------------------------- kleine --
              Wie dit stuurt, en de uitweg. Klein, maar het hoort er te staan. */}
          <footer className="mt-14 border-t border-cream-200 pt-7">
            <p className="text-[13px] leading-relaxed text-ink-300">
              Van Henry van de Bovenkamp ·{" "}
              <a href={branding.siteUrl} className="underline hover:text-ink">
                {branding.name}
              </a>
              <br />
              Je krijgt dit omdat ik jullie bedrijf tegenkwam en dacht dat het je
              kon helpen.{" "}
              <a
                href={afmeldLink(prospect.id)}
                className="underline hover:text-ink"
              >
                Liever geen mail meer?
              </a>
            </p>
          </footer>
        </Container>
      </main>
    </div>
  );
}
