import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { BRANCHES } from "@/lib/branches";

/**
 * De intelligentie achter Groei.
 *
 * Twee taken, allebei met een strak schema zodat er nooit losse prozateksten
 * uit komen die we niet kunnen controleren:
 *  1. een website lezen en er opbouwend iets over zeggen;
 *  2. daar een bericht van maken dat klinkt alsof Henry het zelf typte.
 *
 * Loopt via de Vercel AI Gateway (AI_GATEWAY_API_KEY), zodat kosten en
 * fallbacks zichtbaar blijven in Vercel.
 */

/**
 * Standaard Sonnet 5: dat model is beschikbaar op de gratis gateway-laag,
 * terwijl Opus 5 daar geblokkeerd wordt ("Free tier users do not have access
 * to this model"). Wil je Opus 5 — merkbaar sterker op nuance en toon — zet
 * dan credits bij op Vercel en gebruik:
 *
 *   GROEI_MODEL=anthropic/claude-opus-5
 */
const MODEL = process.env.GROEI_MODEL?.trim() || "anthropic/claude-sonnet-5";

/**
 * De gateway haalt zijn credentials zelf op: een AI_GATEWAY_API_KEY als die
 * er is, anders het OIDC-token van het gekoppelde Vercel-project. Dat werkt
 * ook zonder dat er iets in de environment staat, dus een harde check op een
 * sleutel zou een werkende opstelling ten onrechte blokkeren. Gaat er toch
 * iets mis, dan komt dat als nette foutmelding terug uit de aanroep zelf.
 */
export function aiBeschikbaar(): boolean {
  return true;
}

/* ---------------------------------------------------------------- analyse -- */

const analyseSchema = z.object({
  sterk: z
    .array(z.string())
    .describe(
      "Wat er al goed gaat aan dit bedrijf en hun website. Minstens één, altijd oprecht.",
    ),
  details: z
    .array(
      z.object({
        wat: z.string().describe("Een concreet detail dat je op hun site zag"),
        waar: z.string().describe("Waar op de site je het zag"),
      }),
    )
    .describe(
      "Concrete, verifieerbare details van hún website: een cursusnaam, openingstijden, de naam van hun hond, een zin uit hun verhaal. Verzin niets. Leeg laten mag als je niets concreets vond.",
    ),
  kansen: z
    .array(
      z.object({
        titel: z.string(),
        waarom: z
          .string()
          .describe("Waarom dit hén zou helpen, in hun dagelijkse praktijk"),
        module: z.string().describe("Welk DogWare-onderdeel hierbij hoort"),
      }),
    )
    .max(3),
  past: z
    .boolean()
    .describe(
      "Zou DogWare dit bedrijf echt verder helpen? Nee is een goed antwoord als ze bijvoorbeeld al een uitstekend systeem hebben.",
    ),
  passendheidUitleg: z.string(),
});

export type GroeiAnalyseResultaat = z.infer<typeof analyseSchema>;

const ANALYSE_SYSTEEM = `Je helpt Henry, zelf hondenondernemer en oprichter van DogWare, bij het bekijken van websites van collega-hondenbedrijven.

Je bent geen verkoper. Je bent een collega die meekijkt.

Regels:
- Schrijf nooit negatief over hun website. Niet "de site is verouderd", wel "online kunnen boeken zou een mooie aanvulling zijn".
- Noem alleen details die je daadwerkelijk in de aangeleverde tekst tegenkomt. Verzin er nooit één bij; een verzonnen detail is erger dan geen detail.
- Als DogWare dit bedrijf weinig te bieden heeft, zeg dat. Niet elk bedrijf hoeft benaderd te worden.
- Nederlands, gewone woorden, geen marketingtaal.`;

/** Lees een website en vorm er een opbouwend oordeel over. */
export async function analyseerWebsite(input: {
  bedrijfsnaam: string;
  branche: string | null;
  website: string;
  paginaTekst: string;
}): Promise<GroeiAnalyseResultaat & { model: string }> {
  const branche = BRANCHES.find((b) => b.slug === input.branche);
  const brancheContext = branche
    ? `Dit is een ${branche.naamKlein}. Wat er in die branche speelt: ${branche.problem.intro}
Wat DogWare voor ${branche.meervoud} doet: ${branche.features.join(", ")}.`
    : "De branche is nog niet vastgesteld; leid hem zo mogelijk af uit de tekst.";

  const { object, response } = await generateObject({
    model: MODEL,
    schema: analyseSchema,
    system: ANALYSE_SYSTEEM,
    prompt: `Bedrijf: ${input.bedrijfsnaam}
Website: ${input.website}

${brancheContext}

Hieronder de tekst van hun website. Lees hem en beantwoord het schema.

---
${input.paginaTekst.slice(0, 24_000)}
---`,
  });

  return { ...object, model: response.modelId ?? MODEL };
}

/* ------------------------------------------------------------- conceptmail -- */

const berichtSchema = z.object({
  onderwerp: z
    .string()
    .describe("Kort, zonder uitroepteken, klinkt als een gewone mail van een mens"),
  tekst: z
    .string()
    .describe("De volledige mailtekst, inclusief aanhef en afsluiting met Henry"),
  gebruikteDetails: z
    .array(z.string())
    .describe("Welke concrete details uit de analyse je in de tekst hebt verwerkt"),
});

export type GroeiBerichtResultaat = z.infer<typeof berichtSchema>;

const BERICHT_SYSTEEM = `Je schrijft een mail namens Henry van de Bovenkamp, oprichter van DogWare en zelf hondenondernemer. De mail gaat naar een collega-hondenbedrijf.

Dit is geen verkoopmail. Het is een collega die iets deelt.

Zo schrijft Henry:
- korte zinnen, veel witregels
- gewone woorden, geen jargon, geen marketingtaal
- nieuwsgierig in plaats van overtuigend
- hij vraagt wat de ander ervan vindt, hij drukt niet aan

Nooit gebruiken: "oplossing", "propositie", "kans", "vrijblijvend gesprek", "wij zijn het platform dat", uitroeptekens, opsommingen met bullets, of woorden die naar AI ruiken.

Verplicht: verwerk minstens één concreet detail van hún website in de tekst, zo dat het duidelijk is dat er echt gekeken is. Zonder zo'n detail is de mail waardeloos.

De mail eindigt met een link naar het inspiratievoorstel — die link wordt er later ingezet, laat daar de plaatshouder {{voorstel}} staan.

Ondertekenen met alleen "Henry".`;

/** Schrijf het concept dat Henry daarna zelf nog aanpast. */
export async function schrijfBericht(input: {
  bedrijfsnaam: string;
  voornaam: string | null;
  branche: string | null;
  analyse: GroeiAnalyseResultaat;
  eerdereZinnenDieWerkten: string[];
}): Promise<GroeiBerichtResultaat & { model: string }> {
  const branche = BRANCHES.find((b) => b.slug === input.branche);

  const bibliotheek = input.eerdereZinnenDieWerkten.length
    ? `\nZinnen uit eerdere berichten waar een mens op reageerde. Gebruik ze als toon, niet als sjabloon:\n${input.eerdereZinnenDieWerkten.map((z) => `- ${z}`).join("\n")}`
    : "";

  const { object, response } = await generateObject({
    model: MODEL,
    schema: berichtSchema,
    system: BERICHT_SYSTEEM,
    prompt: `Aan: ${input.bedrijfsnaam}${input.voornaam ? ` (aanhef: ${input.voornaam})` : " (geen naam bekend — schrijf een aanhef zonder naam)"}
${branche ? `Branche: ${branche.naam}` : ""}

Wat er al goed gaat:
${input.analyse.sterk.map((s) => `- ${s}`).join("\n")}

Concrete details die ik op hun site zag:
${input.analyse.details.map((d) => `- ${d.wat} (${d.waar})`).join("\n") || "- (geen)"}

Ideeën die bij hen zouden passen:
${input.analyse.kansen.map((k) => `- ${k.titel}: ${k.waarom}`).join("\n")}
${bibliotheek}

Schrijf de mail.`,
  });

  return { ...object, model: response.modelId ?? MODEL };
}
