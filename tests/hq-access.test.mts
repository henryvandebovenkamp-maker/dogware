import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  HQ_OWNER_ROLE,
  evaluateHqAccess,
  parseHqFlag,
  type HqAccessInput,
} from "../lib/hq/access.ts";

/**
 * De toegangsmatrix van HQ.
 *
 * Deze test bestaat om één ding aan te tonen: er is precies één combinatie
 * die de deur opent. Alle andere gevallen — hoe hoog de rol ook is — geven
 * geen toegang, en dus een 404.
 */

const sessie = (
  roles: string[],
  status = "ACTIVE",
): HqAccessInput["session"] => ({ status, roles });

/** Kortste weg naar een beslissing, met alles standaard "goed" behalve wat de test wijzigt. */
function toegang(overrides: Partial<HqAccessInput>) {
  return evaluateHqAccess({
    hqEnabled: true,
    session: sessie([HQ_OWNER_ROLE]),
    hasOwnerGrant: true,
    ...overrides,
  });
}

describe("HQ-toegangsmatrix", () => {
  it("1. uitgelogd: geen toegang", () => {
    const r = toegang({ session: null, hasOwnerGrant: false });
    assert.equal(r.allowed, false);
    assert.equal(r.allowed === false && r.reason, "geen_sessie");
  });

  it("2. CUSTOMER: geen toegang", () => {
    const r = toegang({ session: sessie(["CUSTOMER"]), hasOwnerGrant: false });
    assert.equal(r.allowed, false);
    assert.equal(r.allowed === false && r.reason, "geen_eigenaar");
  });

  it("3. AFFILIATE_PARTNER: geen toegang", () => {
    const r = toegang({
      session: sessie(["AFFILIATE_PARTNER"]),
      hasOwnerGrant: false,
    });
    assert.equal(r.allowed, false);
  });

  it("4. gewone admin zonder eigenaarrol: geen toegang", () => {
    const r = toegang({
      session: sessie(["CUSTOMER", "AFFILIATE_PARTNER"]),
      hasOwnerGrant: false,
    });
    assert.equal(r.allowed, false);
  });

  it("5. SUPER_ADMIN zonder eigenaarrol: geen toegang", () => {
    const r = toegang({ session: sessie(["SUPER_ADMIN"]), hasOwnerGrant: false });
    assert.equal(r.allowed, false);
    assert.equal(r.allowed === false && r.reason, "geen_eigenaar");
  });

  it("5b. ook SUPER_ADMIN + alle andere rollen tegelijk geeft geen toegang", () => {
    const r = toegang({
      session: sessie(["SUPER_ADMIN", "AFFILIATE_PARTNER", "CUSTOMER"]),
      hasOwnerGrant: false,
    });
    assert.equal(r.allowed, false);
  });

  it("6. eigenaar met HQ_ENABLED=false: geen toegang", () => {
    const r = toegang({ hqEnabled: parseHqFlag("false") });
    assert.equal(r.allowed, false);
    assert.equal(r.allowed === false && r.reason, "flag_uit");
  });

  it("7. eigenaar met ontbrekende flag: geen toegang", () => {
    const r = toegang({ hqEnabled: parseHqFlag(undefined) });
    assert.equal(r.allowed, false);
    assert.equal(r.allowed === false && r.reason, "flag_uit");
  });

  it("8. eigenaar met HQ_ENABLED=true: wél toegang", () => {
    const r = toegang({ hqEnabled: parseHqFlag("true") });
    assert.equal(r.allowed, true);
  });

  it("geblokkeerd of nog niet geactiveerd account: geen toegang, ook als eigenaar", () => {
    for (const status of ["BLOCKED", "INVITED", ""]) {
      const r = toegang({ session: sessie([HQ_OWNER_ROLE], status) });
      assert.equal(r.allowed, false, `status ${status} kreeg toegang`);
    }
  });

  it("de eigenaarrol in de gewone rollenlijst geeft op zichzelf geen toegang", () => {
    // Zelfs als DOGWARE_OWNER ooit in session.roles zou opduiken, telt alleen
    // de aparte toekenning. Dit borgt dat roles nooit als sleutel gaat werken.
    const r = toegang({
      session: sessie([HQ_OWNER_ROLE, "SUPER_ADMIN"]),
      hasOwnerGrant: false,
    });
    assert.equal(r.allowed, false);
  });

  it("de flag wordt vóór de sessie beoordeeld", () => {
    // Met de flag uit mag er geen enkel onderscheid meetbaar zijn tussen een
    // eigenaar en een willekeurige bezoeker.
    const eigenaar = toegang({ hqEnabled: false });
    const vreemde = toegang({ hqEnabled: false, session: null, hasOwnerGrant: false });
    assert.deepEqual(eigenaar, vreemde);
  });
});

describe("HQ_ENABLED wordt fail closed gelezen", () => {
  it("alleen exact 'true' zet HQ aan", () => {
    assert.equal(parseHqFlag("true"), true);
  });

  it("alle andere waarden betekenen uit", () => {
    const uit = [
      undefined,
      null,
      "",
      " ",
      "true ",
      " true",
      "TRUE",
      "True",
      "1",
      "yes",
      "ja",
      "on",
      "enabled",
      "false",
      "0",
    ];
    for (const waarde of uit) {
      assert.equal(parseHqFlag(waarde), false, `${JSON.stringify(waarde)} zette HQ aan`);
    }
  });
});
