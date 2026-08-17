import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  HQ_OBJECT_TYPE,
  HqAuditFailure,
  buildHqAuditEntry,
  sanitizeHqMeta,
  withHqAudit,
  type HqAuditEntry,
} from "../lib/hq/audit-core.ts";

/**
 * De auditregels van HQ. De kern van deze test: een HQ-handeling die niet
 * geregistreerd kan worden, mag niet doorgaan en mag geen resultaat opleveren.
 */

const CTX = {
  actorUserId: "11111111-2222-3333-4444-555555555555",
  action: "HQ_STATUS_READ",
  requestId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  model: null,
  meta: { bron: "test", readOnly: true },
};

/** Verzamelt wat er geschreven zou worden, zonder database. */
function recorder() {
  const regels: HqAuditEntry[] = [];
  const writer = async (e: HqAuditEntry) => {
    regels.push(e);
  };
  return { regels, writer };
}

const klok = () => new Date("2026-08-17T10:00:00.000Z");

describe("10. een bevoegde statuscontrole maakt de verplichte auditregels", () => {
  it("schrijft een regel vóór en een regel ná de handeling", async () => {
    const { regels, writer } = recorder();
    const uitkomst = await withHqAudit(CTX, writer, async () => "klaar", klok);

    assert.equal(uitkomst, "klaar");
    assert.equal(regels.length, 2);
    assert.deepEqual(
      regels.map((r) => r.newValue.phase),
      ["start", "ok"],
    );
  });

  it("elke regel bevat de verplichte velden", async () => {
    const { regels, writer } = recorder();
    await withHqAudit(CTX, writer, async () => null, klok);

    for (const r of regels) {
      assert.equal(r.objectType, HQ_OBJECT_TYPE, "objectType moet 'hq' zijn");
      assert.equal(r.actorUserId, CTX.actorUserId, "actor ontbreekt");
      assert.equal(r.action, CTX.action, "actietype ontbreekt");
      assert.equal(r.objectId, CTX.requestId, "request-id ontbreekt");
      assert.equal(r.newValue.requestId, CTX.requestId);
      assert.equal(r.newValue.model, null, "modelnaam moet expliciet null zijn");
      assert.ok("model" in r.newValue, "het model-veld moet aanwezig zijn, ook als null");
      assert.ok(r.newValue.status, "resultaat/status ontbreekt");
      assert.ok(Date.parse(r.newValue.at) > 0, "tijdstip ontbreekt of is ongeldig");
    }
  });

  it("de twee regels delen hetzelfde request-id", async () => {
    const { regels, writer } = recorder();
    await withHqAudit(CTX, writer, async () => null, klok);
    assert.equal(regels[0].objectId, regels[1].objectId);
  });
});

describe("11. een mislukte verplichte auditwrite laat de handeling veilig falen", () => {
  it("faalt de 'voor'-regel, dan draait de handeling nooit", async () => {
    let uitgevoerd = false;
    const writer = async () => {
      throw new Error("database weg");
    };

    await assert.rejects(
      () =>
        withHqAudit(CTX, writer, async () => {
          uitgevoerd = true;
          return "resultaat";
        }, klok),
      (err: unknown) => err instanceof HqAuditFailure && err.phase === "start",
    );
    assert.equal(uitgevoerd, false, "de handeling had niet mogen draaien");
  });

  it("faalt de 'na'-regel, dan komt het resultaat er niet uit", async () => {
    const writer = async (e: HqAuditEntry) => {
      if (e.newValue.phase === "ok") throw new Error("database weg");
    };

    await assert.rejects(
      () => withHqAudit(CTX, writer, async () => "geheim resultaat", klok),
      (err: unknown) => err instanceof HqAuditFailure && err.phase === "ok",
    );
  });

  it("een fout in de handeling zelf wordt eerst geregistreerd en daarna doorgegeven", async () => {
    const { regels, writer } = recorder();
    const stuk = new TypeError("iets ging mis");

    await assert.rejects(
      () =>
        withHqAudit(CTX, writer, async () => {
          throw stuk;
        }, klok),
      (err: unknown) => err === stuk,
    );

    assert.deepEqual(
      regels.map((r) => r.newValue.phase),
      ["start", "error"],
    );
    assert.equal(regels[1].newValue.status, "mislukt");
    assert.equal(regels[1].newValue.meta.fouttype, "TypeError");
  });

  it("de foutmelding zelf komt niet in het logboek terecht", async () => {
    const { regels, writer } = recorder();
    await assert.rejects(() =>
      withHqAudit(CTX, writer, async () => {
        throw new Error("klant Jan de Vries, iban NL00BANK0123456789");
      }, klok),
    );
    const alles = JSON.stringify(regels);
    assert.ok(!alles.includes("Jan de Vries"), "foutmelding lekte het logboek in");
    assert.ok(!alles.includes("NL00BANK"), "foutmelding lekte het logboek in");
  });
});

describe("auditmetadata bevat nooit geheimen of persoonsgegevens", () => {
  it("filtert verdachte sleutels weg", () => {
    const schoon = sanitizeHqMeta({
      bron: "test",
      sessionToken: "abc",
      dw_session: "xyz",
      apiKey: "sk-geheim",
      magicCode: "123456",
      wachtwoord: "hunter2",
      email: "iemand@voorbeeld.nl",
      naam: "Jan de Vries",
      iban: "NL00BANK0123456789",
      authHeader: "Bearer xyz",
    });
    assert.deepEqual(schoon, { bron: "test" });
  });

  it("laat alleen primitieven door en kort lange tekst in", () => {
    const schoon = sanitizeHqMeta({
      tekst: "x".repeat(500),
      getal: 42,
      vlag: true,
      leeg: null,
      object: { diep: "waarde" },
      lijst: [1, 2, 3],
      nan: Number.NaN,
    });
    assert.equal(schoon.tekst?.toString().length, 120);
    assert.equal(schoon.getal, 42);
    assert.equal(schoon.vlag, true);
    assert.equal(schoon.leeg, null);
    assert.ok(!("object" in schoon), "objecten mogen niet mee");
    assert.ok(!("lijst" in schoon), "arrays mogen niet mee");
    assert.ok(!("nan" in schoon), "NaN mag niet mee");
  });

  it("een auditregel van een handeling bevat geen ruwe context", () => {
    const entry = buildHqAuditEntry(
      { ...CTX, meta: { bron: "route_handler", sessionCookie: "geheim" } },
      "start",
      klok(),
    );
    assert.ok(!JSON.stringify(entry).includes("geheim"));
  });
});
