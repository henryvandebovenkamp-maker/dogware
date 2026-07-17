import { FasePlaceholder } from "../fase-placeholder";

export const metadata = { title: "Facturen" };

export default function FacturenPage() {
  return (
    <FasePlaceholder
      titel="Facturen"
      omschrijving="Facturatie (concept, open, betaald, te laat, gecrediteerd) wordt hier ingericht, gekoppeld aan klanten, opdrachten en partnercommissies. Er worden geen verzonnen facturen getoond."
    />
  );
}
