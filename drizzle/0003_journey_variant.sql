-- DogWare — tweede instroomroute: directe klant zonder voorbeeldwebsite
--
-- Handgeschreven, in dezelfde stijl als 0001 en 0002: uitsluitend toevoegend,
-- veilig om opnieuw te draaien. Geen bestaande kolom wordt gewijzigd.
--
-- Elke bestaande aanvraag krijgt "demo" — via de DEFAULT bij het toevoegen
-- van de kolom én expliciet hieronder. Geen enkele lopende aanvraag verandert
-- daardoor van route; alleen nieuw handmatig toegevoegde directe klanten
-- krijgen "direct".

ALTER TABLE "leads"
  ADD COLUMN IF NOT EXISTS "journey_variant" text NOT NULL DEFAULT 'demo';

UPDATE "leads"
SET "journey_variant" = 'demo'
WHERE "journey_variant" IS NULL OR "journey_variant" NOT IN ('demo', 'direct');
