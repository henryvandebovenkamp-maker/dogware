import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Structuurbewaking van HQ.
 *
 * De toegangsmatrix zelf is elders getest. Wat hier bewaakt wordt is dat de
 * matrix ook werkelijk op elk binnenkomend pad wordt aangeroepen — een
 * server action of route handler is een gewone POST/GET en passeert de layout
 * níet. Dit zijn regels die een refactor stilletjes kan slopen; daarom staan
 * ze hier vast.
 */

const wortel = new URL("..", import.meta.url).pathname;
const lees = (p: string) => readFileSync(join(wortel, p), "utf8");

function alleBestanden(map: string, uit: string[] = []): string[] {
  for (const naam of readdirSync(join(wortel, map))) {
    const pad = join(map, naam);
    if (statSync(join(wortel, pad)).isDirectory()) alleBestanden(pad, uit);
    else uit.push(pad);
  }
  return uit;
}

const HQ_BESTANDEN = alleBestanden("app/hq");

describe("9. elk binnenkomend HQ-pad controleert zelfstandig opnieuw", () => {
  it("de layout is de autoritatieve server-side poort", () => {
    const src = lees("app/hq/layout.tsx");
    assert.match(src, /requireOwner\(\)/, "layout roept requireOwner() niet aan");
    assert.match(src, /from "@\/lib\/hq-auth"/);
  });

  it("elke server action en route handler bewaakt zichzelf", () => {
    const ingangen = HQ_BESTANDEN.filter(
      (p) => p.endsWith("/route.ts") || p.endsWith("/actions.ts"),
    );
    assert.ok(ingangen.length >= 2, "verwacht minimaal een action en een route handler");

    for (const pad of ingangen) {
      const src = lees(pad);
      assert.match(
        src,
        /getOwnerActor\(\)|requireOwner\(\)/,
        `${pad} controleert de eigenaar niet zelf`,
      );
      assert.match(
        src,
        /runAuditedHqAction/,
        `${pad} registreert de handeling niet in het auditlogboek`,
      );
    }
  });

  it("onbevoegd levert een 404 op — nooit een redirect, 403 of uitleg", () => {
    for (const pad of HQ_BESTANDEN.filter((p) => p.endsWith(".ts") || p.endsWith(".tsx"))) {
      const src = lees(pad);
      assert.ok(
        !/redirect\(/.test(src),
        `${pad} stuurt door in plaats van te verbergen dat HQ bestaat`,
      );
      assert.ok(!/\b403\b/.test(src), `${pad} geeft een zichtbare 403`);
    }
    assert.match(lees("app/hq/status/route.ts"), /status: 404/);
  });

  it("de statusroute geeft bij weigering een lege body terug", () => {
    const src = lees("app/hq/status/route.ts");
    assert.match(
      src,
      /new NextResponse\(null, \{ status: 404 \}\)/,
      "een geweigerde request mag geen enkel gegeven teruggeven",
    );
  });
});

describe("13. HQ lekt niets naar de client of naar onbevoegden", () => {
  it("de feature flag bestaat niet als NEXT_PUBLIC-variabele", () => {
    const verdacht: string[] = [];
    for (const map of ["app", "lib", "components", "scripts"]) {
      for (const pad of alleBestanden(map)) {
        if (!/\.(ts|tsx|mjs|css)$/.test(pad)) continue;
        // Alleen echt gebruik telt, niet een vermelding in een toelichting.
        if (/process\.env\.NEXT_PUBLIC_HQ/.test(lees(pad))) verdacht.push(pad);
      }
    }
    assert.deepEqual(verdacht, [], "HQ_ENABLED mag nooit een NEXT_PUBLIC-variabele zijn");
    assert.ok(
      !/^\s*NEXT_PUBLIC_HQ/m.test(lees(".env.example")),
      "de env-documentatie mag geen NEXT_PUBLIC-variabele voor HQ aanbieden",
    );
  });

  it("HQ_ENABLED wordt alleen server-side uitgelezen", () => {
    const lezers: string[] = [];
    for (const map of ["app", "lib", "components"]) {
      for (const pad of alleBestanden(map)) {
        if (!/\.(ts|tsx)$/.test(pad)) continue;
        if (/process\.env\.HQ_ENABLED/.test(lees(pad))) lezers.push(pad);
      }
    }
    assert.deepEqual(
      lezers.sort(),
      ["lib/hq/flags.ts", "proxy.ts"].filter((p) => lezers.includes(p)).sort(),
      `onverwachte plek leest HQ_ENABLED: ${lezers.join(", ")}`,
    );
    assert.match(lees("lib/hq/flags.ts"), /^import "server-only";/m);
  });

  it("geen enkel clientbestand van HQ bevat status of gegevens", () => {
    for (const pad of HQ_BESTANDEN.filter((p) => p.endsWith(".tsx"))) {
      const src = lees(pad);
      if (!/^"use client"/m.test(src)) continue;
      assert.ok(
        !/process\.env/.test(src),
        `${pad} is een clientcomponent en leest de environment`,
      );
      assert.ok(
        !/getOwnerActor|getCurrentUser|getDb/.test(src),
        `${pad} is een clientcomponent en raakt de serverlaag aan`,
      );
    }
  });

  it("HQ raakt geen klant-, lead-, betaal- of organisatiegegevens aan", () => {
    const verboden =
      /schema\.(leads|customers|klanten|invoices|facturen|payments|partners|organisations|organisaties|intakes|drafts)/;
    for (const pad of HQ_BESTANDEN) {
      assert.ok(
        !verboden.test(lees(pad)),
        `${pad} bevraagt gegevens die in stap 1 buiten HQ horen te blijven`,
      );
    }
  });

  it("HQ kent geen AI-, spraak-, betaal- of uitvoerende koppeling", () => {
    const verboden = /\b(openai|anthropic|from "ai"|@ai-sdk|mollie|resend|SpeechRecognition|webkitSpeech)\b/i;
    for (const pad of HQ_BESTANDEN) {
      assert.ok(!verboden.test(lees(pad)), `${pad} koppelt iets aan dat in stap 1 niet mag`);
    }
  });
});

describe("7. HQ blijft buiten zoekmachines", () => {
  it("staat in robots.ts op disallow", () => {
    assert.match(lees("app/robots.ts"), /"\/hq"/);
  });

  it("zet noindex in de metadata van de layout", () => {
    assert.match(lees("app/hq/layout.tsx"), /index:\s*false/);
    assert.match(lees("app/hq/layout.tsx"), /follow:\s*false/);
  });

  it("de titel van HQ staat achter dezelfde controle als de pagina", () => {
    // Next lost metadata los van het renderen op. Een statische
    // `export const metadata = { title: "DogWare Orbit" }` belandde daardoor
    // óók in de 404 van een uitgelogde bezoeker. De titel moet dus uit een
    // generateMetadata komen die zelf de toegang controleert.
    const src = lees("app/hq/layout.tsx");
    assert.ok(
      !/export const metadata/.test(src),
      "een statische metadata-export lekt de titel naar onbevoegden",
    );
    assert.match(src, /export async function generateMetadata/);
    assert.match(
      src,
      /checkHqAccess\(\)[\s\S]{0,200}result\.allowed \?/,
      "de titel moet afhangen van de toegangscontrole",
    );
  });

  it("er staat nergens een publieke link naar /hq", () => {
    const links: string[] = [];
    for (const map of ["app", "components"]) {
      for (const pad of alleBestanden(map)) {
        if (!/\.tsx?$/.test(pad) || pad.startsWith("app/hq")) continue;
        if (/href=["'`]\/hq/.test(lees(pad))) links.push(pad);
      }
    }
    assert.deepEqual(links, [], "HQ mag nergens vanaf gelinkt worden");
  });
});

describe("de eigenaarrol blijft gescheiden van de gewone rollen", () => {
  it("staat niet in USER_ROLES", () => {
    const schema = lees("lib/db/schema.ts");
    const blok = schema.slice(schema.indexOf("export const USER_ROLES"));
    assert.ok(
      !blok.slice(0, 200).includes("DOGWARE_OWNER"),
      "de eigenaarrol hoort niet in de gewone rollenlijst",
    );
  });

  it("wordt uit de sessierollen gefilterd", () => {
    assert.match(lees("lib/auth/session.ts"), /ur\.role <> \$\{HQ_OWNER_ROLE\}/);
  });

  it("is nergens in het beheerportaal toe te kennen", () => {
    for (const pad of alleBestanden("app/admin")) {
      if (!/\.tsx?$/.test(pad)) continue;
      assert.ok(
        !lees(pad).includes("DOGWARE_OWNER"),
        `${pad} noemt de eigenaarrol — die mag niet via het beheer toegekend worden`,
      );
    }
    for (const pad of alleBestanden("app/actions")) {
      assert.ok(!lees(pad).includes("DOGWARE_OWNER"), `${pad} noemt de eigenaarrol`);
    }
  });

  it("er staat geen e-mailadres, id of naam hardcoded in het toekenningsscript", () => {
    const src = lees("scripts/grant-hq-owner.mjs");
    assert.ok(
      !/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(src.replace(/email@voorbeeld\.nl/g, "")),
      "het script bevat een hardcoded e-mailadres",
    );
    assert.ok(
      !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(src),
      "het script bevat een hardcoded gebruikers-id",
    );
  });
});
