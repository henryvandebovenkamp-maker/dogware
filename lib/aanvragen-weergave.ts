import { actiefInWerkvoorraad, inWerkvoorraad, type AanvraagAfleiding, type Bakje } from "@/lib/aanvragen";

/**
 * Wat het aanvragenscherm toont: de werkvoorraad of het archief van afgeronde
 * demo's, gefilterd op bakje en zoekterm. Puur, zodat het te testen is; de
 * pagina roept alleen deze functie aan.
 */

type Rij = {
  lead: { bedrijfsnaam: string; naam: string; email: string; plaats: string };
  afleiding: Pick<AanvraagAfleiding, "afgerondeDemo" | "bakje">;
  demoAfsluiting: { afgerondOp: Date } | null;
};

export function past(a: Rij, zoekterm: string): boolean {
  const zoek = zoekterm.trim().toLowerCase();
  if (!zoek) return true;
  const l = a.lead;
  return [l.bedrijfsnaam, l.naam, l.email, l.plaats].join(" ").toLowerCase().includes(zoek);
}

export function aanvragenWeergave<T extends Rij>(
  alle: readonly T[],
  opties: { archief: boolean; bakje: Bakje | null; zoek: string },
) {
  const werkvoorraad = alle.filter((a) => inWerkvoorraad(a.afleiding));
  const lopend = werkvoorraad.filter((a) => actiefInWerkvoorraad(a.afleiding));
  // Meest recent afgerond bovenaan.
  const afgerondeDemos = alle
    .filter((a) => a.demoAfsluiting)
    .sort((x, y) => y.demoAfsluiting!.afgerondOp.getTime() - x.demoAfsluiting!.afgerondOp.getTime());

  const bron = opties.archief ? afgerondeDemos : opties.bakje ? werkvoorraad : lopend;
  const zichtbaar = bron.filter(
    (a) => (opties.archief || !opties.bakje || a.afleiding.bakje === opties.bakje) && past(a, opties.zoek),
  );
  return { werkvoorraad, lopend, afgerondeDemos, zichtbaar };
}
