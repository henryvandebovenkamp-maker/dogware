import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { voornaamUitAanvraag } from "../lib/voornaam.ts";

/**
 * De aanhef van de demo-mail.
 *
 * Deze mail is het eerste wat een potentiële klant van DogWare ziet, en hij is
 * geschreven alsof Henry hem persoonlijk stuurde. Eén verkeerd woord in de
 * aanhef haalt dat onderuit: "Hoi hond," leest als automatisch verstuurde post,
 * en dan is de rest van de tekst niet meer geloofwaardig.
 *
 * Dat ging mis omdat het eerste woord van het contactveld werd gepakt. Meestal
 * klopt dat, maar niet als iemand zijn bedrijfsnaam vóór zijn eigen naam typt —
 * en juist die aanvraag verdient dezelfde persoonlijke aanhef als de rest.
 *
 * Deze tests leggen twee dingen vast: welke voornaam eruit komt, en wanneer er
 * bewust géén naam uit komt. Dat tweede is even belangrijk. Een verzonnen naam
 * of een bedrijfsnaam in de aanhef is erger dan een neutrale begroeting.
 */

describe("de voornaam voor de aanhef van de demo-mail", () => {
  describe("1. gewone aanvragen", () => {
    it("neemt de voornaam uit een volledige naam", () => {
      assert.equal(voornaamUitAanvraag("Miranda Tijman", "The Happy Dogs"), "Miranda");
      assert.equal(voornaamUitAanvraag("Annegreet Bos", "OH MY CAT!"), "Annegreet");
      assert.equal(voornaamUitAanvraag("Robin Smout", "Walk&Care"), "Robin");
    });

    it("laat een losse voornaam ongemoeid", () => {
      assert.equal(voornaamUitAanvraag("Nadine", "Walk the dog"), "Nadine");
      assert.equal(voornaamUitAanvraag("Bionda", "Kynologenclub Arnhem"), "Bionda");
    });

    it("houdt een dubbele voornaam heel", () => {
      assert.equal(voornaamUitAanvraag("Jan-Willem de Vries", "Hondenschool X"), "Jan-Willem");
    });

    it("slaat het tussenvoegsel over bij een naam zonder voornaam", () => {
      assert.equal(voornaamUitAanvraag("de Vries", "Trimsalon Bello"), "Vries");
    });
  });

  describe("2. de bedrijfsnaam in het contactveld", () => {
    it("vindt de persoon achter de bedrijfsomschrijving", () => {
      assert.equal(
        voornaamUitAanvraag("hond & gedrag Pieke Everaert", "hond & gedrag Pieke Everaert"),
        "Pieke",
      );
    });

    it("noemt nooit een bedrijfswoord als voornaam", () => {
      assert.equal(voornaamUitAanvraag("hond & gedrag", "hond & gedrag"), undefined);
      assert.equal(voornaamUitAanvraag("Hondenschool", "Hondenschool"), undefined);
      assert.equal(voornaamUitAanvraag("Uitlaatservice de Wandelaar", "x"), "Wandelaar");
    });

    it("valt terug op niets als het contactveld precies de bedrijfsnaam is", () => {
      assert.equal(voornaamUitAanvraag("Bello", "Bello"), undefined);
    });
  });

  describe("3. slordig ingevulde velden", () => {
    it("geeft een kleingeschreven naam een hoofdletter", () => {
      assert.equal(voornaamUitAanvraag("pieke everaert", "hond & gedrag"), "Pieke");
      assert.equal(voornaamUitAanvraag("hond & gedrag pieke everaert", "x"), "Pieke");
    });

    it("schreeuwt niet terug bij hoofdletters", () => {
      assert.equal(voornaamUitAanvraag("MARJON VERHAGEN", "Neus in de wind"), "Marjon");
    });

    it("spreekt niemand aan met een initiaal", () => {
      assert.equal(voornaamUitAanvraag("P. Everaert", "hond & gedrag"), "Everaert");
    });

    it("negeert losse leestekens en extra spaties", () => {
      assert.equal(voornaamUitAanvraag("  hond  &  Pieke  ", "x"), "Pieke");
    });
  });

  describe("4. geen naam is geen probleem, een verzonnen naam wel", () => {
    it("geeft niets terug bij een leeg veld", () => {
      assert.equal(voornaamUitAanvraag("", "Walk the dog"), undefined);
      assert.equal(voornaamUitAanvraag("   ", "Walk the dog"), undefined);
      assert.equal(voornaamUitAanvraag(null, "Walk the dog"), undefined);
      assert.equal(voornaamUitAanvraag(undefined, "Walk the dog"), undefined);
    });

    it("pakt nooit de bedrijfsnaam erbij als het contactveld niets oplevert", () => {
      const uitkomst = voornaamUitAanvraag("hond & honden", "Walk the dog");
      assert.equal(uitkomst, undefined);
      assert.notEqual(uitkomst, "Walk the dog");
    });
  });
});
