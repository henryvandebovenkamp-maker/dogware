import { createContext } from "react";

/**
 * Injecteert de actuele e-maillogo-URL in de gedeelde header (base.tsx) zonder
 * elke template aan te passen. `null` = geen override; de header valt dan terug
 * op de statische default uit lib/branding.ts.
 *
 * De waarde wordt in lib/email/service.ts gezet, vlak voordat de mail rendert.
 */
export const EmailLogoContext = createContext<string | null>(null);
