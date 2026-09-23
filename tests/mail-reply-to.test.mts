import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { before, beforeEach, describe, it } from "node:test";
import { branding } from "../lib/branding.ts";

/**
 * Afzender en Reply-To van DogWare-systeemmail.
 *
 * Dit is geen cosmetische kopregel. Klikt een klant op Beantwoorden en gaat dat
 * antwoord naar een postbus die niemand leest, dan is de klant weg zonder dat
 * iemand het merkt. Daarom toetst deze test niet wat onze eigen helpers
 * beweren, maar de PAYLOAD die de Resend-SDK werkelijk krijgt.
 */

const ANTWOORDADRES = "henry@dogware.nl";
const AFZENDER = "DogWare <mail@dogware.nl>";
const NOREPLY = "DogWare <noreply@dogware.nl>";
const BEZOEKER = "isabel@gmail.com";

type Payload = {
  from: string;
  replyTo?: string;
  subject: string;
  to: unknown;
  html?: string;
  text?: string;
  attachments?: unknown[];
};

let sendMail: typeof import("../lib/email/service.ts").sendMail;

/** De payloads die de (gestubde) Resend-SDK deze test heeft ontvangen. */
function payloads(): Payload[] {
  return (globalThis as unknown as { __resendPayloads: Payload[] }).__resendPayloads;
}

type Opties = Partial<Parameters<typeof sendMail>[1]>;

function opties(extra: Opties = {}): Parameters<typeof sendMail>[1] {
  return {
    to: "klant@voorbeeld.nl",
    subject: "Onderwerp",
    text: "Inhoud",
    ...extra,
  } as Parameters<typeof sendMail>[1];
}

/** Verstuurt een mail en geeft terug wat Resend ervan zou zien. */
async function verstuur(
  type: Parameters<typeof sendMail>[0],
  extra: Opties = {},
): Promise<Payload> {
  const result = await sendMail(type, opties(extra));
  assert.equal(result.ok, true, "de mail hoort te slagen in de teststub");
  const laatste = payloads().at(-1);
  assert.ok(laatste, "Resend hoort een payload te hebben gekregen");
  return laatste;
}

before(async () => {
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.EMAIL_FROM = AFZENDER;
  process.env.EMAIL_FROM_NOREPLY = NOREPLY;
  process.env.EMAIL_SANDBOX_TO = "";
  sendMail = (await import("../lib/email/service.ts")).sendMail;
});

beforeEach(() => {
  (globalThis as unknown as { __resendPayloads: Payload[] }).__resendPayloads = [];
});

describe("1. het antwoordadres staat op één centrale plek", () => {
  it("is henry@dogware.nl (de TransIP-mailbox) in de branding-config", () => {
    assert.equal(branding.replyToEmail, ANTWOORDADRES);
  });

  it("staat nergens anders in de maillaag overgetypt", () => {
    const bestanden = [
      "../lib/email/service.ts",
      "../lib/email/send.tsx",
      "../lib/email/types.ts",
      "../lib/email/config.ts",
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

  it("dog-connect.nl komt in de code niet meer voor", () => {
    for (const bestand of ["../lib/branding.ts", "../lib/email/service.ts", "../.env.example"]) {
      const bron = readFileSync(new URL(bestand, import.meta.url), "utf8");
      assert.ok(!bron.includes("dog-connect"), `${bestand} verwijst nog naar dog-connect.nl`);
    }
  });
});

describe("2. klantmail: systeemafzender, Reply-To naar Henry", () => {
  it("gewone transactionele mail (bevestiging)", async () => {
    const payload = await verstuur("demo-confirmation");
    assert.equal(payload.from, AFZENDER);
    assert.equal(payload.replyTo, ANTWOORDADRES);
    assert.equal(payload.to, "klant@voorbeeld.nl");
  });

  it("factuur- en journey-mail (demo-ready)", async () => {
    const payload = await verstuur("demo-ready");
    assert.equal(payload.from, AFZENDER);
    assert.equal(payload.replyTo, ANTWOORDADRES);
  });

  it("handmatig vanuit de admin verzonden mail (groeibericht, testmail)", async () => {
    for (const type of ["groei-bericht", "test"] as const) {
      const payload = await verstuur(type);
      assert.equal(payload.from, AFZENDER, `type ${type}`);
      assert.equal(payload.replyTo, ANTWOORDADRES, `type ${type}`);
    }
  });

  it("gewone notificatie, ook zonder dat de aanroeper iets over antwoorden zegt", async () => {
    const payload = await verstuur("notification");
    assert.equal(payload.replyTo, ANTWOORDADRES);
  });

  it("de afzender is nooit Henry's persoonlijke mailbox", async () => {
    for (const type of ["demo-confirmation", "magic-login", "contact-message"] as const) {
      const payload = await verstuur(type, { replyToVisitor: BEZOEKER });
      assert.ok(!payload.from.includes(ANTWOORDADRES), `type ${type}`);
    }
  });
});

describe("3. inlogcode: noreply-afzender", () => {
  it("magic-login komt van EMAIL_FROM_NOREPLY", async () => {
    const payload = await verstuur("magic-login");
    assert.equal(payload.from, NOREPLY);
    // Antwoordt iemand toch ("dit heb ik niet aangevraagd"), dan bereikt dat een mens.
    assert.equal(payload.replyTo, ANTWOORDADRES);
  });

  it("zonder EMAIL_FROM_NOREPLY valt hij terug op EMAIL_FROM", async () => {
    delete process.env.EMAIL_FROM_NOREPLY;
    try {
      const payload = await verstuur("magic-login");
      assert.equal(payload.from, AFZENDER);
    } finally {
      process.env.EMAIL_FROM_NOREPLY = NOREPLY;
    }
  });
});

describe("4. websiteformulieren: nooit de bezoeker als From", () => {
  for (const type of ["contact-message", "demo-request", "intake-request"] as const) {
    it(`${type}: From = DogWare Website, Reply-To = bezoeker, To = Henry`, async () => {
      const payload = await verstuur(type, { to: ANTWOORDADRES, replyToVisitor: BEZOEKER });
      assert.equal(payload.from, "DogWare Website <mail@dogware.nl>");
      assert.equal(payload.replyTo, BEZOEKER);
      assert.equal(payload.to, ANTWOORDADRES);
      assert.ok(!payload.from.includes(BEZOEKER));
    });
  }

  it("een ongeldig bezoekersadres valt terug op het vaste antwoordadres", async () => {
    for (const fout of ["geen-adres", "a@b.nl\r\nBcc: x@y.nl", "  "]) {
      const payload = await verstuur("contact-message", { replyToVisitor: fout });
      assert.equal(payload.replyTo, ANTWOORDADRES, JSON.stringify(fout));
    }
  });

  it("op klantmail wordt replyToVisitor genegeerd", async () => {
    for (const type of ["demo-confirmation", "magic-login", "notification", "test"] as const) {
      const payload = await verstuur(type, { replyToVisitor: BEZOEKER });
      assert.equal(payload.replyTo, ANTWOORDADRES, `type ${type}`);
    }
  });

  it("de drie formulierhelpers geven het bezoekersadres mee", () => {
    const send = readFileSync(new URL("../lib/email/send.tsx", import.meta.url), "utf8");
    const aantal = send.match(/replyToVisitor:\s*data\.email/g)?.length ?? 0;
    assert.equal(aantal, 3);
    assert.ok(!/\breplyTo\s*:/.test(send), "send.tsx zet een vrij replyTo");
  });
});

describe("5. niets kan de standaard onbedoeld overschrijven", () => {
  it("MailOptions heeft geen vrij replyTo-veld", () => {
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

  it("een oude EMAIL_REPLY_TO uit de omgeving wordt genegeerd", async () => {
    process.env.EMAIL_REPLY_TO = "oud-adres@dogware.nl";
    try {
      const payload = await verstuur("welcome");
      assert.equal(payload.replyTo, ANTWOORDADRES);
    } finally {
      delete process.env.EMAIL_REPLY_TO;
    }
  });

  it("de maillaag leest het antwoordadres niet uit de omgeving", () => {
    for (const bestand of ["../lib/email/service.ts", "../lib/email/config.ts"]) {
      const bron = readFileSync(new URL(bestand, import.meta.url), "utf8");
      assert.ok(!bron.includes("EMAIL_REPLY_TO"), bestand);
    }
  });
});

describe("6. inhoud en bijlagen", () => {
  it("HTML en platte tekst gaan allebei mee", async () => {
    const payload = await verstuur("notification", { html: "<p>Hoi</p>", text: "Hoi" });
    assert.equal(payload.html, "<p>Hoi</p>");
    assert.equal(payload.text, "Hoi");
  });

  it("bijlagen (PDF + JPG) gaan ongewijzigd mee", async () => {
    const attachments = [
      { filename: "factuur.pdf", content: Buffer.from("%PDF-1.4") },
      { filename: "foto.jpg", content: "aGFsbG8=" },
    ];
    const payload = await verstuur("demo-ready", { attachments });
    assert.deepEqual(payload.attachments, attachments);
  });
});

describe("7. fouten verdwijnen niet stil", () => {
  it("ontbrekende API key → NOT_CONFIGURED, niets naar Resend", async () => {
    delete process.env.RESEND_API_KEY;
    try {
      const result = await sendMail("demo-confirmation", opties());
      assert.equal(result.ok, false);
      assert.equal(!result.ok && result.error.code, "NOT_CONFIGURED");
      assert.equal(payloads().length, 0);
    } finally {
      process.env.RESEND_API_KEY = "re_test_key";
    }
  });

  it("ongeldig ontvangersadres → INVALID_RECIPIENT, niets naar Resend", async () => {
    for (const to of ["geen-adres", "a b@c.nl", ""]) {
      const result = await sendMail("demo-confirmation", opties({ to }));
      assert.equal(!result.ok && result.error.code, "INVALID_RECIPIENT", JSON.stringify(to));
    }
    assert.equal(payloads().length, 0);
  });

  it("een Resend-fout komt terug als PROVIDER_ERROR", async () => {
    (globalThis as unknown as { __resendNextError: unknown }).__resendNextError = {
      name: "validation_error",
      message: "The dogware.nl domain is not verified.",
    };
    const result = await sendMail("demo-confirmation", opties());
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error.code, "PROVIDER_ERROR");
  });
});

describe("8. sandbox-modus", () => {
  it("alleen de ontvanger verandert; alle typen gebruiken de proefafzender", async () => {
    process.env.EMAIL_FROM = "DogWare <onboarding@resend.dev>";
    process.env.EMAIL_SANDBOX_TO = "test@voorbeeld.nl";
    try {
      const gewoon = await verstuur("demo-confirmation");
      assert.equal(gewoon.from, "DogWare <onboarding@resend.dev>");
      assert.equal(gewoon.replyTo, ANTWOORDADRES);
      assert.equal(gewoon.to, "test@voorbeeld.nl");

      const login = await verstuur("magic-login");
      assert.equal(login.from, "DogWare <onboarding@resend.dev>");
    } finally {
      process.env.EMAIL_FROM = AFZENDER;
      process.env.EMAIL_SANDBOX_TO = "";
    }
  });
});
