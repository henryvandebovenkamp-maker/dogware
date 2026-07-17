import Image from "next/image";
import { requirePartner } from "@/lib/auth/session";
import { branding } from "@/lib/branding";
import { referralLinkFor } from "@/lib/referral";
import { getPartnerForUser } from "@/lib/partner-data";
import { ShareLink } from "@/components/partner/share-link";

export const metadata = { title: "Materialen" };

export default async function MaterialenPage() {
  const user = await requirePartner();
  const partner = await getPartnerForUser(user.id);
  const link = partner ? referralLinkFor(partner.referralCode) : branding.siteUrl;

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">Materialen</h1>
      <p className="mt-1 text-sm text-ink-500">
        Alles wat je nodig hebt om DogWare aan te bevelen — in de juiste
        huisstijl.
      </p>

      <section className="mt-6 rounded-2xl bg-white p-6 shadow-soft ring-1 ring-ink/5">
        <h2 className="text-sm font-extrabold text-ink">Jouw link & deeltekst</h2>
        <div className="mt-4">
          <ShareLink link={link} />
        </div>
      </section>

      <section className="mt-5 rounded-2xl bg-white p-6 shadow-soft ring-1 ring-ink/5">
        <h2 className="text-sm font-extrabold text-ink">DogWare-logo</h2>
        <p className="mt-1 text-[13px] text-ink-500">
          Gebruik het officiële logo wanneer je DogWare noemt — niet vervormen
          of hertekenen.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-6">
          <span className="rounded-2xl bg-cream p-6 ring-1 ring-ink/5">
            <Image
              src={branding.logo.full}
              alt="DogWare-logo"
              width={220}
              height={110}
            />
          </span>
          <a
            href={branding.logo.full}
            download="dogware-logo.png"
            className="rounded-full bg-ink px-5 py-2.5 text-[13px] font-bold text-cream transition hover:bg-ink-700"
          >
            Download logo (PNG)
          </a>
        </div>
      </section>

      <section className="mt-5 rounded-2xl bg-white p-6 shadow-soft ring-1 ring-ink/5">
        <h2 className="text-sm font-extrabold text-ink">Goed om te weten</h2>
        <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-ink-500">
          <li>
            • Wie via jouw link een demo aanvraagt, wordt automatisch aan jou
            gekoppeld — ook als de aanvraag pas later volgt (tot 30 dagen).
          </li>
          <li>
            • Deel je link gerust in je nieuwsbrief, op social media of
            persoonlijk via WhatsApp.
          </li>
          <li>
            • Vragen of iets nodig? Reageer op een van onze mails — je krijgt
            altijd een hondenmens aan de lijn.
          </li>
        </ul>
      </section>
    </div>
  );
}
