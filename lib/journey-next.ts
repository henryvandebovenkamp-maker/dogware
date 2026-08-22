import type { CommerceStatus, JourneyStage } from "@/lib/db/schema";

/**
 * De volgende-stap-motor van de commerciële journey.
 *
 * Eén pure functie die uit de feitelijke toestand afleidt wat er nú moet
 * gebeuren, wie aan zet is, en welke ene knop de beheerder ziet. Bewust géén
 * losse if-jes in de UI: dan lopen het adminscherm, het klantportaal en de
 * mails vroeg of laat uiteen over "waar staan we".
 *
 * Client-safe: pure functie, geen imports met bijwerkingen.
 */

/** Wie is aan zet? Bepaalt de toon in de admin ("wachten op klant"). */
export type WaitingOn = "admin" | "klant" | "niemand";

export type NextAction = {
  /** Korte constatering van waar we staan, in gewone taal. */
  situatie: string;
  /** Wat de volgende stap is. */
  volgende: string;
  /** De ene primaire knop, of null als de beheerder niets hoeft te doen. */
  cta: {
    label: string;
    /** Machinecode die de UI koppelt aan de juiste action/link. */
    action: NextActionKey;
    /** Relatieve link, als de actie een pagina opent. */
    href?: string;
  } | null;
  waitingOn: WaitingOn;
};

export type NextActionKey =
  | "demo-akkoord"
  | "voorstel-maken"
  | "voorstel-bewerken"
  | "voorstel-versturen"
  | "voorstel-herinneren"
  | "overeenkomst-herinneren"
  | "aanbetaling-herinneren"
  | "oplevering-klaarzetten"
  | "restbetaling-herinneren"
  | "livegang"
  | "klaar";

export type JourneySnapshot = {
  stage: JourneyStage;
  commerceStatus: CommerceStatus | null;
  /** Bestaat er een concept-voorstel dat nog niet verstuurd is? */
  heeftConcept: boolean;
  /** Is er ooit een voorstel verstuurd? */
  voorstelVerstuurd: boolean;
  voorstelBekeken: boolean;
  voorstelGeaccepteerd: boolean;
  overeenkomstGetekend: boolean;
  aanbetalingBetaald: boolean;
  opleveringKlaar: boolean;
  restbetalingBetaald: boolean;
  mandaatActief: boolean;
  live: boolean;
  /** Is het maandbedrag > 0? Zonder abonnement is er geen mandaat nodig. */
  heeftAbonnement: boolean;
};

/**
 * De volgorde is bewust van achter naar voren: de verst gevorderde waarheid
 * wint. Zo kan een handmatig teruggezette stage de werkelijkheid (er ís
 * betaald) niet overschrijven.
 */
export function nextAction(s: JourneySnapshot, leadId: string): NextAction {
  const base = `/admin/leads/${leadId}`;

  if (s.live && (!s.heeftAbonnement || s.mandaatActief)) {
    return {
      situatie: "De website is live en de klant is actief.",
      volgende: "Niets — dit traject is afgerond.",
      cta: null,
      waitingOn: "niemand",
    };
  }

  if (s.restbetalingBetaald && s.heeftAbonnement && !s.mandaatActief) {
    return {
      situatie: "De tweede termijn is betaald, maar er is nog geen geldig incassomandaat.",
      volgende: "Controleer het mandaat bij Mollie of vraag de klant het opnieuw te bevestigen.",
      cta: { label: "Mandaat opnieuw aanvragen", action: "restbetaling-herinneren" },
      waitingOn: "klant",
    };
  }

  if (s.restbetalingBetaald) {
    return {
      situatie: "Alles is betaald en het mandaat staat klaar.",
      volgende: "Zet de website live en maak de klant actief.",
      cta: { label: "Website live zetten", action: "livegang" },
      waitingOn: "admin",
    };
  }

  if (s.opleveringKlaar) {
    return {
      situatie: "De oplevering staat klaar; de klant moet de tweede termijn nog voldoen.",
      volgende: "Wachten op de laatste betaling.",
      cta: { label: "Herinnering laatste termijn sturen", action: "restbetaling-herinneren" },
      waitingOn: "klant",
    };
  }

  if (s.aanbetalingBetaald) {
    return {
      situatie: "De eerste termijn is binnen — we zijn aan het bouwen.",
      volgende: "Rond de bouw af en zet de oplevering klaar.",
      cta: { label: "Oplevering klaarzetten", action: "oplevering-klaarzetten" },
      waitingOn: "admin",
    };
  }

  if (s.overeenkomstGetekend) {
    return {
      situatie: "De overeenkomst is getekend; de eerste termijn staat open.",
      volgende: "Wachten op de aanbetaling.",
      cta: { label: "Herinnering eerste termijn sturen", action: "aanbetaling-herinneren" },
      waitingOn: "klant",
    };
  }

  if (s.voorstelGeaccepteerd) {
    return {
      situatie: "Het voorstel is geaccepteerd; de overeenkomst is nog niet getekend.",
      volgende: "Wachten tot de klant de overeenkomst tekent.",
      cta: { label: "Herinnering overeenkomst sturen", action: "overeenkomst-herinneren" },
      waitingOn: "klant",
    };
  }

  if (s.voorstelVerstuurd) {
    return {
      situatie: s.voorstelBekeken
        ? "Het voorstel is verstuurd en bekeken, maar nog niet geaccepteerd."
        : "Het voorstel is verstuurd; de klant heeft het nog niet geopend.",
      volgende: "Wachten op akkoord van de klant.",
      cta: { label: "Herinnering voorstel sturen", action: "voorstel-herinneren" },
      waitingOn: "klant",
    };
  }

  if (s.heeftConcept) {
    return {
      situatie: "Er ligt een concept-voorstel klaar.",
      volgende: "Controleer het en verstuur het naar de klant.",
      cta: {
        label: "Voorstel afmaken en versturen",
        action: "voorstel-bewerken",
        href: `${base}/voorstel`,
      },
      waitingOn: "admin",
    };
  }

  if (s.stage === "demo-akkoord") {
    return {
      situatie: "De klant wil doorgaan.",
      volgende: "Maak het voorstel.",
      cta: { label: "Voorstel maken", action: "voorstel-maken", href: `${base}/voorstel` },
      waitingOn: "admin",
    };
  }

  return {
    situatie: "De demo loopt nog.",
    volgende: "Zodra de klant aangeeft door te willen, maak je het voorstel.",
    cta: { label: "Klant wil doorgaan", action: "demo-akkoord" },
    waitingOn: "klant",
  };
}
