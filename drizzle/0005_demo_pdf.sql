-- DogWare — demo afronden: de PDF van de voorbeeldwebsite bewaren
--
-- Uitsluitend toevoegend en veilig om opnieuw te draaien, in dezelfde stijl
-- als 0001–0004. Er wordt niets gewijzigd of verwijderd.
--
-- Het documenttype "DEMO_PDF" is een nieuwe waarde in een bestaande
-- tekstkolom (documents.type); daarvoor is geen DDL nodig.

CREATE TABLE IF NOT EXISTS "document_files" (
  "document_id" uuid PRIMARY KEY REFERENCES "documents"("id") ON DELETE CASCADE,
  "bestandsnaam" text NOT NULL,
  "mime" text NOT NULL,
  "grootte" integer NOT NULL,
  "sha256" text NOT NULL,
  "inhoud" bytea NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
