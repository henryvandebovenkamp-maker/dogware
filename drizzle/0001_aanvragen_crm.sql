-- DogWare — e-maillogboek en taakvelden
--
-- Handgeschreven en niet door drizzle-kit gegenereerd. Dit project gebruikte
-- tot nu toe `push`, waardoor er geen migratiehistorie is; een diff van het
-- hele schema tegen productie kan dan destructieve wijzigingen voorstellen.
-- Deze migratie is daarom uitsluitend toevoegend: geen DROP, geen wijziging
-- van bestaande kolommen, en alles met IF NOT EXISTS zodat hij veilig
-- opnieuw kan draaien.

-- Verzonden e-mail per aanvraag. Alleen een logboek — het versturen blijft
-- volledig bij Resend en lib/email.
CREATE TABLE IF NOT EXISTS "emails" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lead_id"     uuid NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "soort"       text NOT NULL,
  "ontvanger"   text NOT NULL,
  "onderwerp"   text NOT NULL,
  "status"      text NOT NULL,
  "provider_id" text,
  "fout"        text,
  "created_at"  timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "emails_lead_idx" ON "emails" ("lead_id", "created_at");

-- Taken krijgen een deadline en een verantwoordelijke. Beide nullable: een
-- bestaande taak zonder datum blijft geldig en hoeft niets ingevuld te krijgen.
ALTER TABLE "journey_tasks" ADD COLUMN IF NOT EXISTS "due_at" timestamp with time zone;
ALTER TABLE "journey_tasks" ADD COLUMN IF NOT EXISTS "assignee_user_id" uuid;

-- De foreign key apart, zodat het toevoegen van de kolom niet faalt op een
-- bestaande constraint bij een herhaalde run.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'journey_tasks_assignee_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "journey_tasks"
      ADD CONSTRAINT "journey_tasks_assignee_user_id_users_id_fk"
      FOREIGN KEY ("assignee_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;
END $$;
