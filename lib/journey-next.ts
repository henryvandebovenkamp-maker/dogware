import type { CommerceStatus, JourneyStage, JourneyVariant } from "@/lib/db/schema";

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
  | "demo-versturen"
  | "demo-akkoord"
  | "voorstel-maken"
  | "voorstel-bewerken"
  | "voorstel-versturen"
  | "voorstel-herinneren"
  | "geldigheid-verlengen"
  | "overeenkomst-herinneren"
  | "aanbetaling-herinneren"
  | "oplevering-klaarzetten"
  | "restbetaling-herinneren"
  | "livegang"
  | "termijn-herinneren"
  | "mandaat-opnieuw"
  | "klaar";

export type JourneySnapshot = {
  stage: JourneyStage;
  /**
   * De route. "direct" betekent: geen voorbeeldwebsite, en het tekenen van de
   * overeenkomst ís het akkoord op de opdracht. Leeg = "demo", zodat elke
   * bestaande aanroep ongewijzigd blijft werken.
   */
  variant?: JourneyVariant;
  commerceStatus: CommerceStatus | null;
  /** Is het voorbeeld (demolink + inloglink) al naar de klant gemaild? */
  demoVerstuurd: boolean;
  /** Staan beide links klaar? Zonder die twee kan er niets verstuurd worden. */
  demoLinksKlaar: boolean;
  /** Bestaat er een concept-voorstel dat nog niet verstuurd is? */
  heeftConcept: boolean;
  /** Is er ooit een voorstel verstuurd? */
  voorstelVerstuurd: boolean;
  voorstelBekeken: boolean;
  voorstelGeaccepteerd: boolean;
  /**
   * Is het geldende, nog niet geaccepteerde voorstel over zijn geldigheid
   * heen? Een geaccepteerd voorstel is nooit verlopen. Leeg = nee, zodat
   * bestaande aanroepen ongewijzigd blijven werken.
   */
  voorstelVerlopen?: boolean;
  overeenkomstGetekend: boolean;
  aanbetalingBetaald: boolean;
  opleveringKlaar: boolean;
  restbetalingBetaald: boolean;
  mandaatActief: boolean;
  live: boolean;
  /** Is het maandbedrag > 0? Zonder abonnement is er geen mandaat nodig. */
  heeftAbonnement: boolean;
  /**
   * De stand van het betaalschema, als de getekende overeenkomst er een
   * heeft. Leeg of "50-50" = de bestaande logica hieronder, ongewijzigd.
   */
  regeling?: RegelingStand | null;
};

/** Het deel van het betaalschema dat de volgende-stap-motor nodig heeft. */
export type RegelingStand = {
  soort: "50-50" | "volledig" | "termijnen";
  aantal: number;
  betaaldAantal: number;
  teLaatAantal: number;
  allesBetaald: boolean;
  /** De eerstvolgende onbetaalde termijn. */
  volgende: { volgnummer: number; teLaat: boolean } | null;
};

/**
 * De volgorde is bewust van achter naar voren: de verst gevorderde waarheid
 * wint. Zo kan een handmatig teruggezette stage de werkelijkheid (er ís
 * betaald) niet overschrijven.
 */
export function nextAction(s: JourneySnapshot, leadId: string): NextAction {
  const base = `/admin/leads/${leadId}`;

  const regeling = s.regeling && s.regeling.soort !== "50-50" ? s.regeling : null;
  if (regeling) {
    const eigen = regelingAction(s, regeling);
    if (eigen) return eigen;
  }

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

  /*
   * Directe klant: er is geen demo en geen los voorstelakkoord. Alles vóór de
   * handtekening draait om één stuk — de opdrachtbevestiging, die meteen als
   * overeenkomst ter ondertekening klaarstaat. De stappen hierboven (tekenen,
   * betalen, bouwen, opleveren) zijn voor beide routes gelijk.
   */
  if (s.variant === "direct") {
    if (s.voorstelVerstuurd && s.voorstelVerlopen) return verlopenAction(base, "De opdrachtbevestiging");
    if (s.voorstelVerstuurd) {
      return {
        situatie: "De opdrachtbevestiging is verstuurd; de klant heeft nog niet getekend.",
        volgende: "Wachten tot de klant de opdrachtbevestiging digitaal ondertekent.",
        cta: { label: "Herinnering opdrachtbevestiging sturen", action: "overeenkomst-herinneren" },
        waitingOn: "klant",
      };
    }
    if (s.heeftConcept) {
      return {
        situatie: "Er ligt een concept-opdrachtbevestiging klaar.",
        volgende: "Controleer de afspraken en verstuur de opdrachtbevestiging ter ondertekening.",
        cta: {
          label: "Opdrachtbevestiging afmaken en versturen",
          action: "voorstel-bewerken",
          href: `${base}/voorstel`,
        },
        waitingOn: "admin",
      };
    }
    return {
      situatie: "Directe klant — er is nog geen opdrachtbevestiging.",
      volgende: "Leg vast wat we bouwen en wat het kost, en verstuur het ter ondertekening.",
      cta: { label: "Opdrachtbevestiging maken", action: "voorstel-maken", href: `${base}/voorstel` },
      waitingOn: "admin",
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

  if (s.voorstelVerstuurd && s.voorstelVerlopen) return verlopenAction(base, "Het voorstel");

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

  // De demofase — de eerste echte handeling van de beheerder: het voorbeeld
  // klaarzetten en de twee links (de demolink naar de voorbeeldwebsite en de
  // inloglink naar het demoportaal) naar de klant mailen. Dit staat bewust ná
  // "demo-akkoord": wie al heeft vastgelegd dat de klant doorwil, wordt niet
  // teruggestuurd naar de demo — maar zolang dat niet zo is, is dit de stap.
  if (!s.demoVerstuurd) {
    return {
      situatie: s.demoLinksKlaar
        ? "De links staan klaar, maar het voorbeeld is nog niet verstuurd."
        : "De aanvraag is binnen; het voorbeeld is nog niet verstuurd.",
      volgende: s.demoLinksKlaar
        ? "Verstuur de demolink en de inloglink naar de klant."
        : "Zet de voorbeeldwebsite klaar en vul de demolink en de inloglink in.",
      cta: {
        label: s.demoLinksKlaar ? "Voorbeeld versturen" : "Voorbeeld klaarzetten",
        action: "demo-versturen",
        href: `${base}#voorbeeld`,
      },
      waitingOn: "admin",
    };
  }

  return {
    situatie: "Het voorbeeld is verstuurd; de klant kijkt rond.",
    volgende: "Zodra de klant aangeeft door te willen, maak je het voorstel.",
    cta: { label: "Klant wil doorgaan", action: "demo-akkoord" },
    waitingOn: "klant",
  };
}

/**
 * Het voorstel is verlopen vóór acceptatie. De klant kan nu niets; een
 * herinnering zou hem naar een doodlopende pagina sturen. Aan zet: de
 * beheerder, met één handeling — verlengen (of een nieuwe versie).
 */
function verlopenAction(base: string, stuk: string): NextAction {
  return {
    situatie: `${stuk} is verlopen voordat de klant akkoord gaf.`,
    volgende: "Verleng de geldigheid (de klant kan dan meteen verder), of maak een nieuwe versie als er iets aan de afspraak verandert.",
    cta: { label: "Geldigheid verlengen", action: "geldigheid-verlengen", href: `${base}#voorstel` },
    waitingOn: "admin",
  };
}

/**
 * "In één keer" en "in termijnen": na de eerste betaling is er geen
 * slotbetaling bij oplevering. De website kan live terwijl er nog termijnen
 * lopen, en het mandaat ontstaat bij een termijnbetaling in plaats van bij de
 * tweede termijn. Geeft null wanneer de gewone logica het over kan nemen
 * (alles vóór de eerste betaling is voor elke regeling gelijk).
 */
function regelingAction(s: JourneySnapshot, r: RegelingStand): NextAction | null {
  if (!s.aanbetalingBetaald) return null;

  const stand =
    r.soort === "termijnen" ? ` (${r.betaaldAantal} van ${r.aantal} termijnen betaald)` : "";

  if (r.volgende?.teLaat) {
    return {
      situatie: `Termijn ${r.volgende.volgnummer} van ${r.aantal} is te laat${stand}.`,
      volgende: "Stuur de klant een vriendelijke herinnering, of bel even.",
      cta: { label: "Herinnering termijn sturen", action: "termijn-herinneren" },
      waitingOn: "klant",
    };
  }

  const mandaatOntbreekt = s.heeftAbonnement && !s.mandaatActief;

  if (s.live) {
    if (mandaatOntbreekt) {
      return {
        situatie: "De website is live, maar er is nog geen actief incassomandaat voor het abonnement.",
        volgende: "Probeer het mandaat opnieuw bij Mollie, of vraag de klant de eerstvolgende termijn te betalen.",
        cta: { label: "Mandaat opnieuw proberen", action: "mandaat-opnieuw" },
        waitingOn: "admin",
      };
    }
    if (!r.allesBetaald) {
      return {
        situatie: `De website is live en de klant is actief; de termijnen lopen nog${stand}.`,
        volgende: "Niets — de klant krijgt automatisch bericht als de volgende termijn klaarstaat.",
        cta: null,
        waitingOn: "niemand",
      };
    }
    return null; // alles rond: de gewone "afgerond"-melding
  }

  if (s.opleveringKlaar) {
    if (mandaatOntbreekt) {
      return {
        situatie: "Opgeleverd, maar er is nog geen actief incassomandaat voor het abonnement.",
        volgende: r.allesBetaald
          ? "Controleer het mandaat bij Mollie en probeer het opnieuw."
          : "Het mandaat ontstaat bij de eerstvolgende termijnbetaling. Staat het al bij Mollie? Probeer het dan opnieuw.",
        cta: { label: "Mandaat opnieuw proberen", action: "mandaat-opnieuw" },
        waitingOn: r.allesBetaald ? "admin" : "klant",
      };
    }
    return {
      situatie: r.allesBetaald
        ? "Opgeleverd en de eenmalige investering is volledig betaald."
        : `Opgeleverd; de verschuldigde termijnen zijn betaald${stand}.`,
      volgende: "Zet de website live en maak de klant actief.",
      cta: { label: "Website live zetten", action: "livegang" },
      waitingOn: "admin",
    };
  }

  return {
    situatie:
      r.soort === "volledig"
        ? "De eenmalige investering is betaald — we zijn aan het bouwen."
        : `De eerste termijn is binnen — we zijn aan het bouwen${stand}.`,
    volgende: "Rond de bouw af en zet de oplevering klaar.",
    cta: { label: "Oplevering klaarzetten", action: "oplevering-klaarzetten" },
    waitingOn: "admin",
  };
}
