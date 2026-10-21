-- DogWare — partnercommissies uitbetalen en e-mailadres veilig wijzigen
--
-- Uitsluitend toevoegend en veilig om opnieuw te draaien, in dezelfde stijl
-- als 0001–0005. Er wordt niets gewijzigd of verwijderd en geen bestaande rij
-- aangeraakt. Bestaande commissies (afgeleid uit de journey) blijven exact
-- zoals ze zijn; een rij in partner_commissions ontstaat pas wanneer een
-- beheerder of een betaalde webhook de commissie controleert.

CREATE TABLE IF NOT EXISTS "partner_commissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "partner_id" uuid NOT NULL REFERENCES "partners"("id") ON DELETE RESTRICT,
  "lead_id" uuid NOT NULL REFERENCES "leads"("id") ON DELETE RESTRICT,
  "amount_cents" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'WACHT_OP_BETALING',
  "payable_at" timestamptz,
  "payable_check" jsonb,
  "prepared_at" timestamptz,
  "prepared_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "payee_name" text,
  "payee_iban_enc" text,
  "approved_at" timestamptz,
  "approved_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "paid_at" timestamptz,
  "paid_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "paid_amount_cents" integer,
  "payment_reference" text,
  "payable_mail_sent_at" timestamptz,
  "paid_mail_sent_at" timestamptz,
  "cancelled_at" timestamptz,
  "cancel_reason" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Eén commissie per aanvraag: de database weigert een tweede.
CREATE UNIQUE INDEX IF NOT EXISTS "partner_commissions_lead_idx"
  ON "partner_commissions" ("lead_id");
CREATE INDEX IF NOT EXISTS "partner_commissions_partner_idx"
  ON "partner_commissions" ("partner_id", "status");

CREATE TABLE IF NOT EXISTS "email_changes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "old_email" text NOT NULL,
  "new_email" text NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "confirmed_at" timestamptz,
  "cancelled_at" timestamptz,
  "requested_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "reason" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_changes_token_idx"
  ON "email_changes" ("token_hash");
CREATE INDEX IF NOT EXISTS "email_changes_user_idx"
  ON "email_changes" ("user_id", "created_at");
