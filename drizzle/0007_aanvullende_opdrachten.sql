-- DogWare — aanvullende opdrachten voor klanten die al live zijn
--
-- Uitsluitend toevoegend en veilig om opnieuw te draaien, in dezelfde stijl
-- als 0001–0006. Er wordt niets gewijzigd of verwijderd en geen bestaande rij
-- aangeraakt. Bestaande betalingen en documenten krijgen een lege
-- extra_order_id en lopen precies zoals altijd.

-- 1. De opdracht ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS "extra_orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lead_id" uuid NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "commerce_id" uuid NOT NULL REFERENCES "commerce"("id") ON DELETE CASCADE,
  "volgnummer" integer NOT NULL,
  "status" text DEFAULT 'CONCEPT' NOT NULL,
  "version" integer DEFAULT 0 NOT NULL,
  "titel" text DEFAULT '' NOT NULL,
  "omschrijving" text,
  "werkzaamheden" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "price_ex_vat_cents" integer DEFAULT 0 NOT NULL,
  "vat_percent" integer DEFAULT 21 NOT NULL,
  "deposit_percent" integer DEFAULT 50 NOT NULL,
  "monthly_delta_cents" integer DEFAULT 0 NOT NULL,
  "maand_ingang" text DEFAULT 'oplevering' NOT NULL,
  "maand_ingang_datum" text,
  "verwachte_oplevering" text,
  "geldig_tot" timestamptz,
  "interne_notitie" text,
  "sent_at" timestamptz,
  "reminded_at" timestamptz,
  "first_viewed_at" timestamptz,
  "accepted_at" timestamptz,
  "accepted_version" integer,
  "accepted_name" text,
  "accepted_ip_hash" text,
  "accepted_user_agent" text,
  "agrees_opdracht" boolean DEFAULT false NOT NULL,
  "agrees_maandbedrag" boolean DEFAULT false NOT NULL,
  "accepted_snapshot" jsonb,
  "deposit_paid_at" timestamptz,
  "build_started_at" timestamptz,
  "delivered_at" timestamptz,
  "final_paid_at" timestamptz,
  "completed_at" timestamptz,
  "cancelled_at" timestamptz,
  "cancel_reason" text,
  "maand_toegepast_at" timestamptz,
  "maand_van_cents" integer,
  "maand_naar_cents" integer,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

-- Volgnummer per klant: twee gelijktijdige "Nieuwe opdracht"-kliks botsen hier.
CREATE UNIQUE INDEX IF NOT EXISTS "extra_orders_lead_seq_idx"
  ON "extra_orders" ("lead_id", "volgnummer");
CREATE INDEX IF NOT EXISTS "extra_orders_commerce_idx"
  ON "extra_orders" ("commerce_id", "created_at");
CREATE INDEX IF NOT EXISTS "extra_orders_status_idx"
  ON "extra_orders" ("status");

-- 2. Verstuurde versies (onveranderlijk) ---------------------------------

CREATE TABLE IF NOT EXISTS "extra_order_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "extra_order_id" uuid NOT NULL REFERENCES "extra_orders"("id") ON DELETE CASCADE,
  "lead_id" uuid NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "status" text DEFAULT 'VERZONDEN' NOT NULL,
  "inhoud" jsonb NOT NULL,
  "geldig_tot" timestamptz,
  "sent_at" timestamptz DEFAULT now() NOT NULL,
  "sent_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "closed_at" timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS "extra_order_versions_seq_idx"
  ON "extra_order_versions" ("extra_order_id", "version");

-- 3. Koppeling vanuit betalingen en documenten (geen FK, net als installment_id)

ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "extra_order_id" uuid;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "extra_order_id" uuid;
CREATE INDEX IF NOT EXISTS "documents_extra_order_idx" ON "documents" ("extra_order_id");

-- Per termijn hooguit één lopende betaling (dubbelklik) en één betaalde
-- (dubbel betalen). Bestaande betalingen hebben geen extra_order_id en vallen
-- er dus buiten.
CREATE UNIQUE INDEX IF NOT EXISTS "payments_extra_active_idx"
  ON "payments" ("extra_order_id", "type")
  WHERE "extra_order_id" IS NOT NULL AND "status" IN ('CREATED', 'OPEN', 'PENDING');
CREATE UNIQUE INDEX IF NOT EXISTS "payments_extra_paid_idx"
  ON "payments" ("extra_order_id", "type")
  WHERE "extra_order_id" IS NOT NULL AND "status" = 'PAID';
