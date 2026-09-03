import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { before, beforeEach, describe, it } from "node:test";
import { branding } from "../lib/branding.ts";

/**
 * Antwoorden op DogWare-post komen bij Henry terecht.
 *
 * Dit is geen cosmetische kopregel. Klikt een klant op Beantwoorden en gaat dat
 * antwoord naar een postbus die niemand leest, dan is de klant weg zonder dat
 * iemand het merkt. Daarom toetst deze test niet wat onze eigen helpers
 * beweren, maar de PAYLOAD die de Resend-SDK werkelijk krijgt.
 */

const ANTWOORDADRES = "henry@dog-connect.nl";
const AFZENDER = "DogWare <noreply@dogware.nl>";

type Payload = { from: string; replyTo?: string; subject: string; to: unknown };

let sendMail: typeof import("../lib/email/service.ts").sendMail;

/** De payloads die de (gestubde) Resend-SDK deze test heeft ontvangen. */
function payloads(): Payload[] {
  return (globalThis as unknown as { __resendPayloads: Payload[] }).__resendPayloads;
}

/** Verstuurt een mail en geeft terug wat Resend ervan zou zien. */
async function verstuur(
  type: Parameters<typeof sendMail>[0],
  opties: Partial<Parameters<typeof sendMail>[1]> = {},
): Promise<Payload> {
  const result = await sendMail(type, {
    to: "klant@voorbeeld.nl",
    subject: "Onderwerp",
    text: "Inhoud",
    ...opties,
  } as Parameters<typeof sendMail>[1]);
  assert.equal(result.ok, true, "de mail hoort te slagen in de teststub");
  const laatste = payloads().at(-1);
  assert.ok(laatste, "Resend hoort een payload te hebben gekregen");
  return laatste;
}

before(async () => {
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.EMAIL_FROM = AFZENDER;
  process.env.EMAIL_SANDBOX_TO = "";
  sendMail = (await import("../lib/email/service.ts")).sendMail;
});

beforeEach(() => {
  (globalThis as unknown as { __resendPayloads: Payload[] }).__resendPayloads = [];
});

describe("1. het antwoordadres staat op één centrale plek", () => {
  it("is henry@dog-connect.nl in de branding-config", () => {
    assert.equal(branding.replyToEmail, ANTWOORDADRES);
  });

  it("staat nergens anders in de code overgetypt", () => {
    const bestanden = [
      "../lib/email/service.ts",
      "../lib/email/send.tsx",
      "../lib/email/types.ts",
      "../app/actions/groei.ts",
    ];
    for (const bestand of bestanden) {
      const bron = readFileSync(new URL(bestand, import.meta.url), "utf8");
      assert.ok(
        !bron.includes(ANTWOORDADRES),
        `${bestand} typt het antwoordadres over in plaats van branding.replyToEmail te gebruiken`,
      );
    }
  });
});

describe("2. iedere soort mail krijgt dezelfde Reply-To", () => {
  it("gewone transactionele mail (bevestiging, factuur)", async () => {
    const payload = await verstuur("demo-confirmation");
    assert.equal(payload.replyTo, ANTWOORDADRES);
  });

  it("automatische journey-mail (demo-ready)", async () => {
    const payload = await verstuur("demo-ready");
    assert.equal(payload.replyTo, ANTWOORDADRES);
  });

  it("handmatig vanuit de admin verzonden mail (groeibericht, testmail)", async () => {
    for (const type of ["groei-bericht", "test"] as const) {
      const payload = await verstuur(type);
      assert.equal(payload.replyTo, ANTWOORDADRES, `type ${type}`);
    }
  });

  it("interne notificatie van een nieuwe aanvraag", async () => {
    const payload = await verstuur("demo-request", { to: "intern@dogware.nl" });
    assert.equal(payload.replyTo, ANTWOORDADRES);
  });

  it("ook zonder dat de aanroeper iets over antwoorden zegt", async () => {
    const payload = await verstuur("notification");
    assert.equal(payload.replyTo, ANTWOORDADRES);
  });
});

describe("3. niets kan de standaard onbedoeld overschrijven", () => {
  it("MailOptions heeft geen replyTo-veld meer", () => {
    const types = readFileSync(new URL("../lib/email/types.ts", import.meta.url), "utf8");
    const blok = types.slice(
      types.indexOf("export type MailOptions"),
      types.indexOf("export type MailResult"),
    );
    assert.ok(blok.length > 0, "MailOptions hoort te bestaan");
    assert.ok(
      !/^\s*replyTo\??:/m.test(blok),
      "MailOptions heeft weer een replyTo — dan kan een losse route de standaard omzeilen",
    );
  });

  it("geen enkele verzendhelper zet nog een eigen replyTo", () => {
    const send = readFileSync(new URL("../lib/email/send.tsx", import.meta.url), "utf8");
    assert.ok(
      !/replyTo\s*:/.test(send),
      "lib/email/send.tsx zet weer een eigen replyTo per mailtype",
    );
  });

  it("een oude EMAIL_REPLY_TO uit de omgeving wordt genegeerd", async () => {
    process.env.EMAIL_REPLY_TO = "oud-adres@dogware.nl";
    try {
      const payload = await verstuur("welcome");
      assert.equal(payload.replyTo, ANTWOORDADRES);
    } finally {
      delete process.env.EMAIL_REPLY_TO;
    }
  });

  it("de mailservice leest het antwoordadres niet uit de omgeving", () => {
    const service = readFileSync(
      new URL("../lib/email/service.ts", import.meta.url),
      "utf8",
    );
    assert.ok(!service.includes("EMAIL_REPLY_TO"));
  });
});

describe("4. de afzender blijft ongemoeid", () => {
  it("EMAIL_FROM gaat onveranderd naar Resend", async () => {
    const payload = await verstuur("demo-confirmation");
    assert.equal(payload.from, AFZENDER);
    assert.notEqual(payload.from, ANTWOORDADRES);
  });

  it("ook in sandbox-modus verandert alleen de ontvanger, niet de afzender", async () => {
    process.env.EMAIL_FROM = "DogWare <onboarding@resend.dev>";
    process.env.EMAIL_SANDBOX_TO = "henry@dog-connect.nl";
    try {
      const payload = await verstuur("demo-confirmation");
      assert.equal(payload.from, "DogWare <onboarding@resend.dev>");
      assert.equal(payload.replyTo, ANTWOORDADRES);
      assert.equal(payload.to, "henry@dog-connect.nl");
    } finally {
      process.env.EMAIL_FROM = AFZENDER;
      process.env.EMAIL_SANDBOX_TO = "";
    }
  });
});
