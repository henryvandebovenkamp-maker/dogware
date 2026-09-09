-- DogWare — referral-attributie op first touch
--
-- Handgeschreven, in dezelfde stijl als 0001: uitsluitend toevoegend. Geen
-- DROP, geen wijziging van bestaande kolommen, alles met IF NOT EXISTS zodat
-- hij veilig opnieuw kan draaien. Bestaande aanvragen, partners, betalingen en
-- commissiecijfers blijven ongemoeid.
--
-- Wat er verandert:
--   1. een klik onthoudt voortaan ook waar de bezoeker vandaan kwam;
--   2. een aanvraag onthoudt beide aanrakingen (eerste en laatste partnerlink)
--      plus de marketingherkomst van dat eerste bezoek.
--
-- `affiliate_partner_id` blijft onaangeroerd de partner die de commissie
-- toekomt. De nieuwe kolommen documenteren de reis; ze bepalen geen geld.

/* ------------------------------------------------------------- clicks ---- */

ALTER TABLE "referral_clicks"
  ADD COLUMN IF NOT EXISTS "referrer" text;

/* -------------------------------------------------------------- leads ---- */

ALTER TABLE "leads"
  ADD COLUMN IF NOT EXISTS "first_touch_partner_id" uuid
  REFERENCES "partners"("id") ON DELETE SET NULL;

ALTER TABLE "leads"
  ADD COLUMN IF NOT EXISTS "last_touch_partner_id" uuid
  REFERENCES "partners"("id") ON DELETE SET NULL;

ALTER TABLE "leads"
  ADD COLUMN IF NOT EXISTS "referral_first_seen_at" timestamp with time zone;

ALTER TABLE "leads"
  ADD COLUMN IF NOT EXISTS "referral_landing_page" text;

ALTER TABLE "leads"
  ADD COLUMN IF NOT EXISTS "referral_referrer" text;

ALTER TABLE "leads"
  ADD COLUMN IF NOT EXISTS "utm" jsonb;

CREATE INDEX IF NOT EXISTS "leads_first_touch_idx"
  ON "leads" ("first_touch_partner_id");

/* ------------------------------------------------------------ backfill --- */

-- Bestaande gekoppelde aanvragen kregen hun partner onder het oude
-- last-touch-model. Die ene bekende aanraking geldt dus als eerste én laatste;
-- iets anders verzinnen zou geschiedenis vervalsen.
UPDATE "leads"
SET "first_touch_partner_id" = "affiliate_partner_id",
    "last_touch_partner_id"  = "affiliate_partner_id"
WHERE "affiliate_partner_id" IS NOT NULL
  AND "first_touch_partner_id" IS NULL;

-- Wat er van dat bezoek bewaard is, staat in het clickrecord.
UPDATE "leads" l
SET "referral_first_seen_at" = c."first_seen_at",
    "referral_landing_page"  = c."landing_page",
    "utm"                    = c."utm"
FROM "referral_clicks" c
WHERE l."referral_click_id" = c."id"
  AND l."referral_first_seen_at" IS NULL;

-- Zonder clickrecord is het moment van toekennen het beste dat we hebben.
UPDATE "leads"
SET "referral_first_seen_at" = "attributed_at"
WHERE "affiliate_partner_id" IS NOT NULL
  AND "referral_first_seen_at" IS NULL
  AND "attributed_at" IS NOT NULL;

-- Aanvragen van vóór deze migratie zijn toegekend volgens het oude model. Dat
-- label blijft staan; alleen nieuwe aanvragen krijgen FIRST_TOUCH.
