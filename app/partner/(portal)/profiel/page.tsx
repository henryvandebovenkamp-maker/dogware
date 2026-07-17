import QRCode from "qrcode";
import { requirePartner } from "@/lib/auth/session";
import { referralLinkFor } from "@/lib/referral";
import { euro, getPartnerForUser } from "@/lib/partner-data";
import { decryptField } from "@/lib/crypto-field";
import { ProfileForm } from "@/components/partner/profile-form";
import { ReferralCard } from "@/components/partner/referral-card";
import type { ProfileInput } from "@/app/actions/partner-profile";

export const metadata = { title: "Profiel" };

export default async function ProfielPage() {
  const user = await requirePartner();
  const partner = await getPartnerForUser(user.id);

  if (!partner) {
    return (
      <p className="py-16 text-center text-sm text-ink-500">
        Je partnerprofiel wordt nog ingericht. Neem contact op met DogWare.
      </p>
    );
  }

  const link = referralLinkFor(partner.referralCode);
  const qrDataUrl = await QRCode.toDataURL(link, {
    width: 320,
    margin: 1,
    color: { dark: "#1c150f", light: "#ffffff" },
  });

  // Naam eventueel afleiden uit user.naam als voor-/achternaam nog leeg zijn
  const [afgeleidVoor, ...afgeleidAchter] = user.naam.split(" ");
  const initial: ProfileInput = {
    voornaam: partner.voornaam ?? afgeleidVoor ?? "",
    achternaam: partner.achternaam ?? afgeleidAchter.join(" "),
    bedrijfsnaam: partner.bedrijfsnaam ?? "",
    telefoon: partner.telefoon ?? "",
    website: partner.website ?? "",
    avatarUrl: partner.avatarUrl ?? "",
    rekeninghouder: partner.rekeninghouder ?? "",
    iban: decryptField(partner.ibanEnc),
    bic: decryptField(partner.bicEnc),
    land: partner.land ?? "Nederland",
    factuurType: partner.factuurType ?? "particulier",
    kvkNummer: partner.kvkNummer ?? "",
    btwNummer: partner.btwNummer ?? "",
  };

  return (
    <div className="mx-auto max-w-2xl">
      {/* Warme introductie */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">
          Jouw partnerprofiel
        </h1>
        <p className="mt-2 text-pretty text-[15px] leading-relaxed text-ink-500">
          Fijn dat je partner bent van DogWare! Vul hieronder je gegevens aan
          zodat wij je commissie eenvoudig kunnen uitbetalen wanneer één van
          jouw referrals klant wordt.
        </p>
      </div>

      {/* Referral-kaart */}
      <div className="mt-6">
        <ReferralCard link={link} code={partner.referralCode} qrDataUrl={qrDataUrl} />
      </div>

      {/* Partnerinformatie */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Info label="Partner sinds" value={
          (partner.activatedAt ?? partner.createdAt).toLocaleDateString("nl-NL", { month: "short", year: "numeric" })
        } />
        <Info label="Status" value={partner.status === "ACTIVE" ? "Actief" : partner.status} tone={partner.status === "ACTIVE" ? "sage" : "ink"} />
        <Info label="Commissie" value={`${euro(partner.commissionCents)}`} sub="per website" tone="brand" />
      </div>

      {/* Formulier */}
      <div className="mt-6">
        <ProfileForm
          email={user.email}
          initial={initial}
          uploadEnabled={Boolean(process.env.UPLOADTHING_TOKEN)}
        />
      </div>
    </div>
  );
}

function Info({
  label,
  value,
  sub,
  tone = "ink",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "ink" | "sage" | "brand";
}) {
  const toneClass = tone === "brand" ? "text-brand" : tone === "sage" ? "text-sage-600" : "text-ink";
  return (
    <div className="rounded-2xl bg-white p-4 text-center shadow-soft ring-1 ring-ink/5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-300">{label}</p>
      <p className={`mt-1 text-[15px] font-extrabold ${toneClass}`}>{value}</p>
      {sub && <p className="text-[10px] text-ink-300">{sub}</p>}
    </div>
  );
}
