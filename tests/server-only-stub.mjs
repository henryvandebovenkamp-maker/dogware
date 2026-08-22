/**
 * Vervangt het `server-only`-pakket tijdens tests.
 *
 * Buiten een bundler gooit dat pakket altijd: het onderscheidt server- en
 * clientcode via een conditionele export die Node niet kent. In een test dráait
 * alles server-side, dus een lege module is hier het juiste antwoord.
 */
export {};
