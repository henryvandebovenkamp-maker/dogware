import { requirePartner } from "@/lib/auth/session";
import { referralLinkFor } from "@/lib/referral";
import { STAGE_KLANT_LABEL } from "@/lib/journey-stages";
import {
  euro,
  getPartnerCommission,
  getPartnerForUser,
  getPartnerLeads,
  getPartnerStats,
} from "@/lib/partner-data";
import { ShareLink } from "@/components/partner/share-link";
import {
  GlyphAgenda,
  GlyphCard,
  GlyphCheck,
  GlyphClients,
  GlyphPay,
  GlyphSpark,
} from "@/components/demo/illustrations";

export const metadata = { title: "Partneroverzicht" };

export default async function PartnerDashboard() {
  const user = await requirePartner();
  const partner = await getPartnerForUser(user.id);

  if (!partner) {
    return (
      <p className="py-16 text-center text-sm text-ink-500">
        Je partnerprofiel wordt nog ingericht. Neem contact op met DogWare.
      </p>
    );
  }

  const [stats, leads, commissie] = await Promise.all([
    getPartnerStats(partner.id),
    getPartnerLeads(partner.id),
    getPartnerCommission(partner.id, partner.commissionCents),
  ]);
  const link = referralLinkFor(partner.referralCode);
  const voornaam = user.naam.split(" ")[0];

  return (
    <div>
      {/* Warm welkom */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">
            Welkom terug, {voornaam}!
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Fijn dat je meehelpt DogWare te laten groeien. Hier zie je wat jouw
            aanbevelingen doen.
          </p>
        </div>
        {partner.status === "PAUSED" && (
          <span className="rounded-full bg-gold/10 px-3 py-1 text-[11px] font-bold text-ink-700">
            Tijdelijk gepauzeerd
          </span>
        )}
      </div>

      {/* Persoonlijke link — het hart van de pagina */}
      <section className="mt-6 rounded-3xl bg-white p-6 shadow-lift ring-1 ring-ink/5 sm:p-7">
        <h2 className="text-[15px] font-extrabold text-ink">Jouw persoonlijke uitnodigingslink</h2>
        <p className="mt-1 text-[13px] text-ink-500">
          Deel deze link. Iedereen die erop een demo aanvraagt, koppel ik
          persoonlijk aan jou.
        </p>
        <div className="mt-4">
          <ShareLink link={link} />
        </div>
      </section>

      {/* Motiverend overzicht */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Stat icon={GlyphClients} label="Bezoekers" value={stats.uniek} tone="ink" />
        <Stat icon={GlyphAgenda} label="Demo-aanvragen" value={stats.aanvragen} tone="ink" />
        <Stat icon={GlyphSpark} label="Lopende gesprekken" value={commissie.inBehandeling} tone="ink" />
        <Stat icon={GlyphCard} label="Voorstellen" value={commissie.gereserveerd} tone="ink" />
        <Stat icon={GlyphCheck} label="Nieuwe klanten" value={commissie.verkocht} tone="sage" />
        <Stat icon={GlyphPay} label="Verdiend" value={euro(commissie.verdiendCents)} tone="brand" />
      </div>

      {/* Commissie-belofte */}
      <div className="mt-4 rounded-2xl bg-sage-100/60 p-5 text-center ring-1 ring-sage/10">
        <p className="text-[14px] font-semibold text-sage-600">
          Je verdient {euro(partner.commissionCents)} voor elke nieuwe klant die
          via jou een website afneemt.
        </p>
      </div>

      {/* Lopende aanvragen met journey-stap */}
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-extrabold text-ink">Lopende aanvragen</h2>
        {leads.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-soft ring-1 ring-ink/5">
            <p className="text-[14px] font-semibold text-ink">Nog geen aanvragen — deel je link!</p>
            <p className="mt-1 text-[13px] text-ink-500">
              Zodra iemand via jou een demo aanvraagt, zie je hier precies waar
              die zich bevindt.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {leads.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink/5"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-bold text-ink">
                    {l.bedrijfsnaam}
                  </span>
                  <span className="block text-[12px] text-ink-300">
                    {l.createdAt.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                </span>
                <span className="rounded-full bg-[#2f6bed]/10 px-3 py-1 text-[11px] font-bold text-[#2f6bed]">
                  {STAGE_KLANT_LABEL[l.stage]}
                </span>
                {l.demoUrl && (
                  <span className="flex w-full flex-wrap items-center justify-between gap-2 border-t border-ink/5 pt-2.5">
                    <a
                      href={l.demoUrl.startsWith("http") ? l.demoUrl : `https://${l.demoUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[12px] font-bold text-brand hover:underline"
                    >
                      Bekijk demo →
                    </a>
                    {l.demoSentAt && (
                      <span className="text-[11px] text-ink-300">
                        Verstuurd op{" "}
                        {l.demoSentAt.toLocaleDateString("nl-NL", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    )}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof GlyphPay;
  label: string;
  value: string | number;
  tone: "ink" | "sage" | "brand";
}) {
  const toneClass =
    tone === "brand" ? "text-brand" : tone === "sage" ? "text-sage-600" : "text-ink";
  return (
    <div className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink/5">
      <Icon className={`h-5 w-5 ${tone === "ink" ? "text-ink-300" : toneClass}`} />
      <p className={`mt-2 text-2xl font-extrabold tracking-tight ${toneClass}`}>{value}</p>
      <p className="text-[11px] font-semibold text-ink-500">{label}</p>
    </div>
  );
}
