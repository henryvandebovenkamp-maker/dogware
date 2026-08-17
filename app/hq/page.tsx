import { isDbConfigured } from "@/lib/db";
import { requireOwner } from "@/lib/hq-auth";
import { isHqEnabled } from "@/lib/hq/flags";
import { StatusCheck } from "./status-check";
import styles from "./orbit.module.css";

/**
 * DogWare Orbit — de eerste schil van Jarvis HQ.
 *
 * Alles op deze pagina is echt. Er staan geen agents op die zogenaamd draaien,
 * geen verzonnen cijfers en geen voortgangsbalken zonder werk erachter. Wat
 * hier staat is de stand van de beveiliging zelf, en verder niets: HQ raakt in
 * deze stap geen klant-, lead-, betaal- of organisatiegegevens aan.
 */

/** Kleurbetekenis van stap 1 — één plek, zodat de taal consistent blijft. */
const KLEUR = {
  veilig: "var(--hq-cyaan)", // veilig en verbonden
  gelukt: "var(--hq-groen)", // controle geslaagd
  volgend: "var(--hq-goud)", // nog niet actief, volgende fase
  aandacht: "var(--hq-oranje)", // aandacht nodig
  geblokkeerd: "var(--hq-rood)", // geblokkeerd of uitgeschakeld
} as const;

type Node = {
  label: string;
  waarde: string;
  kleur: string;
  /** Plaats in de baan om de bol, alleen op brede schermen. */
  nx: string;
  ny: string;
};

export default async function HqPage() {
  // De layout bewaakt deze route al; de pagina vraagt het bewust opnieuw, zodat
  // hij ook veilig is als hij ooit ergens anders wordt ingehangen.
  const eigenaar = await requireOwner();

  const auditBeschikbaar = isDbConfigured();
  const omgeving = process.env.NODE_ENV;

  const nodes: Node[] = [
    {
      label: "Toegang",
      waarde: "Eigenaar geverifieerd",
      kleur: KLEUR.gelukt,
      nx: "-18rem",
      ny: "-9.5rem",
    },
    {
      label: "Beveiliging",
      waarde: "Drie lagen actief",
      kleur: KLEUR.veilig,
      nx: "-19.5rem",
      ny: "0rem",
    },
    {
      label: "Feature flag",
      waarde: isHqEnabled() ? "HQ_ENABLED aan" : "HQ_ENABLED uit",
      kleur: isHqEnabled() ? KLEUR.veilig : KLEUR.geblokkeerd,
      nx: "-18rem",
      ny: "9.5rem",
    },
    {
      label: "Audit",
      waarde: auditBeschikbaar ? "Logboek actief" : "Logboek onbereikbaar",
      kleur: auditBeschikbaar ? KLEUR.gelukt : KLEUR.aandacht,
      nx: "18rem",
      ny: "-9.5rem",
    },
    {
      label: "Modus",
      waarde: "Alleen-lezen",
      kleur: KLEUR.veilig,
      nx: "19.5rem",
      ny: "0rem",
    },
    {
      label: "Uitvoering",
      waarde: "AI uitgeschakeld",
      kleur: KLEUR.volgend,
      nx: "18rem",
      ny: "9.5rem",
    },
  ];

  return (
    <main>
      <header className={styles.header}>
        <div>
          <h1 className={styles.wordmark}>
            Dogware <span>Orbit</span>
          </h1>
          <p className={styles.subtitel}>Jarvis HQ · Fase 1 · {eigenaar.naam}</p>
        </div>
        <p className={styles.zegel}>Veilig · Alleen-lezen</p>
      </header>

      <div className={styles.stage}>
        <div className={styles.orb}>
          <span className={`${styles.ring} ${styles.ringBuiten}`} aria-hidden="true" />
          <span className={`${styles.ring} ${styles.ringMidden}`} aria-hidden="true" />
          <span className={`${styles.ring} ${styles.ringBinnen}`} aria-hidden="true" />
          <span className={styles.halo} aria-hidden="true" />
          <span className={styles.kern} aria-hidden="true" />
          <span className={styles.kernLabel}>
            <span className={styles.kernTitel}>Jarvis</span>
            <span className={styles.kernStatus}>Standby</span>
          </span>
        </div>

        <ul className={styles.nodes} aria-label="Status van de beveiliging">
          {nodes.map((n) => (
            <li
              key={n.label}
              className={styles.node}
              style={{ "--nx": n.nx, "--ny": n.ny } as React.CSSProperties}
            >
              <span
                className={styles.stip}
                style={{ "--stip": n.kleur } as React.CSSProperties}
                aria-hidden="true"
              />
              <span>
                <span className={styles.nodeLabel}>{n.label}</span>
                <span className={styles.nodeWaarde}>{n.waarde}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <StatusCheck />

      <div className={styles.voetbalk}>
        <span className={styles.spraak} aria-disabled="true">
          <span className={styles.mic} aria-hidden="true">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 3v9" />
              <path d="M7 11a5 5 0 0 0 10 0" />
              <path d="M12 18v3" />
            </svg>
          </span>
          Spraak volgt in stap 3
        </span>
        <p className={styles.uitkomst}>
          Omgeving {omgeving} · geen klantgegevens, geen model, geen koppelingen
          aangesloten.
        </p>
      </div>
    </main>
  );
}
