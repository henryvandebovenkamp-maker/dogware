"use client";

import { useState, useTransition } from "react";
import { hqStatusCheck } from "./actions";
import styles from "./orbit.module.css";

/**
 * Knop die de alleen-lezen statuscontrole aanroept.
 *
 * Het enige stukje client-JavaScript in HQ. Het bevat geen gegevens en geen
 * beslissing: de server action controleert zelf opnieuw wie er aanklopt en
 * registreert de controle. Wat hier binnenkomt is dus altijd al goedgekeurd.
 */
export function StatusCheck() {
  const [bezig, start] = useTransition();
  const [uitkomst, setUitkomst] = useState<
    { ok: true; tijd: string; requestId: string } | { ok: false } | null
  >(null);

  return (
    <div className={styles.controle}>
      <button
        type="button"
        className={styles.knop}
        disabled={bezig}
        onClick={() =>
          start(async () => {
            try {
              const r = await hqStatusCheck();
              setUitkomst({
                ok: true,
                tijd: new Date(r.gecontroleerdOp).toLocaleTimeString("nl-NL"),
                requestId: r.requestId.slice(0, 8),
              });
            } catch {
              // Bewust geen details: een foutmelding zegt iets over de binnenkant.
              setUitkomst({ ok: false });
            }
          })
        }
      >
        {bezig ? "Controleren…" : "Statuscontrole uitvoeren"}
      </button>

      <p className={styles.uitkomst} role="status" aria-live="polite">
        {uitkomst === null && "Voert een alleen-lezen controle uit en legt die vast."}
        {uitkomst?.ok === true && (
          <span className={styles.uitkomstOk}>
            Geverifieerd om {uitkomst.tijd} · vastgelegd onder {uitkomst.requestId}…
          </span>
        )}
        {uitkomst?.ok === false && (
          <span className={styles.uitkomstFout}>
            Controle niet voltooid — niets vastgelegd, niets uitgevoerd.
          </span>
        )}
      </p>
    </div>
  );
}
