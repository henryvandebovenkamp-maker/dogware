/**
 * Was dit een schending van een unieke index — en zo ja, van welke?
 *
 * Drizzle (vanaf 0.44) verpakt elke databasefout in een DrizzleQueryError
 * met als melding "Failed query: <sql>". De echte Postgres-fout, met de
 * indexnaam en code 23505, zit in `cause`. Wie alleen `err.message` leest,
 * herkent een botsing op een unieke index dus nooit — en dan werkt de
 * herkansing die op die index leunt (factuurnummer, één factuur per
 * betaling, één lopende betaling per termijn) niet.
 *
 * Deze functie kijkt door de hele keten heen.
 */
export function isUniekeSchending(err: unknown, index?: string): boolean {
  let huidig: unknown = err;
  for (let diepte = 0; huidig && diepte < 5; diepte++) {
    const e = huidig as { code?: unknown; constraint?: unknown; message?: unknown; cause?: unknown };
    const tekst = `${typeof e.message === "string" ? e.message : ""} ${typeof e.constraint === "string" ? e.constraint : ""}`;
    const uniek = e.code === "23505" || /duplicate key|unique constraint/i.test(tekst);
    if (uniek && (!index || tekst.includes(index))) return true;
    huidig = e.cause;
  }
  return false;
}
