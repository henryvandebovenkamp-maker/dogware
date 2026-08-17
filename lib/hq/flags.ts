import "server-only";
import { parseHqFlag } from "./access";

/**
 * De server-side feature flag van HQ.
 *
 * Bewust `HQ_ENABLED` en nadrukkelijk NIET `NEXT_PUBLIC_HQ_ENABLED`: de
 * waarde mag de browser nooit bereiken. Omdat `process.env.HQ_ENABLED` hier
 * letterlijk wordt uitgelezen in een module met `server-only`, kan Next deze
 * variabele niet in een clientbundle inlinen.
 *
 * De parsing zelf staat in ./access.ts, zodat de fail-closed-regel getest kan
 * worden zonder de servergrens aan te raken.
 */
export function isHqEnabled(): boolean {
  return parseHqFlag(process.env.HQ_ENABLED);
}
