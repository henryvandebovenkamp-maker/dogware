-- DogWare — betaalregelingen: 50/50, in één keer, of in termijnen
--
-- Handgeschreven, in dezelfde stijl als 0001–0003: uitsluitend toevoegend en
-- veilig om opnieuw te draaien. Er wordt geen kolom gewijzigd of verwijderd
-- en geen bestaande rij herberekend.
--
-- Elke bestaande afspraak krijgt via de DEFAULT "50-50" — precies wat hij al
-- was. Bestaande (getekende) overeenkomsten krijgen GEEN betaalschema: zij
-- lopen ongewijzigd via de bestaande aanbetaling en restbetaling. Een schema
-- ontstaat alleen bij een overeenkomst die ná deze migratie wordt getekend.

-- 1. De keuze, op de centrale afspraak -------------------------------------

ALTER TABLE "commerce" ADD COLUMN IF NOT EXISTS "payment_plan" text NOT NULL DEFAULT '50-50';
ALTER TABLE "commerce" ADD COLUMN IF NOT EXISTS "installment_count" integer NOT NULL DEFAULT 6;
ALTER TABLE "commerce" ADD COLUMN IF NOT EXISTS "installment_start" text NOT NULL DEFAULT 'bij-akkoord';
ALTER TABLE "commerce" ADD COLUMN IF NOT EXISTS "installment_start_date" text;

-- 2. Het betaalschema ------------------------------------------------------

CREATE TABLE IF NOT EXISTS "payment_installments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "commerce_id" uuid NOT NULL REFERENCES "commerce"("id") ON DELETE CASCADE,
  "lead_id" uuid NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "agreement_id" uuid NOT NULL REFERENCES "agreements"("id") ON DELETE RESTRICT,
  "proposal_id" uuid REFERENCES "proposals"("id") ON DELETE SET NULL,
  "plan" text NOT NULL,
  "volgnummer" integer NOT NULL,
  "aantal" integer NOT NULL,
  "moment" text NOT NULL,
  "due_at" timestamptz,
  "amount_ex_vat_cents" integer NOT NULL,
  "vat_cents" integer NOT NULL,
  "amount_incl_vat_cents" integer NOT NULL,
  "vat_percent" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'GEPLAND',
  "payment_id" uuid,
  "mollie_payment_id" text,
  "document_id" uuid,
  "paid_at" timestamptz,
  "notified_at" timestamptz,
  "reminded_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Eén schema per overeenkomst: dubbel aanmaken is onmogelijk.
CREATE UNIQUE INDEX IF NOT EXISTS "payment_installments_agreement_seq_idx"
  ON "payment_installments" ("agreement_id", "volgnummer");
CREATE INDEX IF NOT EXISTS "payment_installments_commerce_idx"
  ON "payment_installments" ("commerce_id", "volgnummer");
CREATE INDEX IF NOT EXISTS "payment_installments_due_idx"
  ON "payment_installments" ("status", "due_at");

-- 3. De koppeling betaling → termijn --------------------------------------

ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "installment_id" uuid;
CREATE INDEX IF NOT EXISTS "payments_installment_idx" ON "payments" ("installment_id");

-- Hooguit één lopende betaling per termijn. Bestaande betalingen hebben geen
-- installment_id en vallen er dus buiten.
CREATE UNIQUE INDEX IF NOT EXISTS "payments_installment_active_idx"
  ON "payments" ("installment_id")
  WHERE "installment_id" IS NOT NULL AND "status" IN ('CREATED', 'OPEN', 'PENDING');
