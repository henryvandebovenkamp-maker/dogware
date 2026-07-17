/**
 * Eigen illustratiestijl voor de DogWare demo-experience.
 * Handgetekende lijnillustraties — bewust géén iconbibliotheek.
 * Stijl: 1.75 stroke, ronde uiteinden, ink-lijnen met één warm accent.
 */

type IllustrationProps = {
  className?: string;
};

const stroke = {
  fill: "none",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Hondenschool — hond springt door een hoepel */
export function IlluSchool({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="34" cy="30" r="17" {...stroke} stroke="var(--color-brand)" opacity="0.9" />
      {/* springende hond */}
      <path
        d="M18 40c3-6 8-9 13-9 4 0 6 2 9 2 2.5 0 4-1.5 5-3"
        {...stroke}
        stroke="currentColor"
      />
      <path d="M45 30c1.5-.5 3-.2 3.5 1l-2.5 2" {...stroke} stroke="currentColor" />
      <path d="M22 40l-3 6M30 39l-1 7M38 35l2 6M44 33l4 5" {...stroke} stroke="currentColor" />
      <path d="M18 40c-2-1-3.5-3-3.5-5" {...stroke} stroke="currentColor" />
      {/* grond */}
      <path d="M10 52h44" {...stroke} stroke="currentColor" opacity="0.25" />
    </svg>
  );
}

/** Uitlaatservice — riem, wandelpad en pootafdrukken */
export function IlluWalk({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path
        d="M14 50c10-2 8-14 18-16s14 4 20-2"
        {...stroke}
        stroke="var(--color-brand)"
        opacity="0.9"
      />
      <path d="M52 32c1.5-1.5 2-3.5 1.5-5.5" {...stroke} stroke="currentColor" />
      {/* pootafdrukken langs het pad */}
      <circle cx="20" cy="41" r="1.4" fill="currentColor" />
      <circle cx="24" cy="44" r="1.4" fill="currentColor" />
      <circle cx="33" cy="34" r="1.4" fill="currentColor" />
      <circle cx="37" cy="37" r="1.4" fill="currentColor" />
      <circle cx="45" cy="31" r="1.4" fill="currentColor" />
      {/* horizon */}
      <path d="M10 54h44" {...stroke} stroke="currentColor" opacity="0.25" />
      <path d="M40 16c2-3 6-4 8-2s1 6-2 8c-2.5 1.7-6 1-8-2" {...stroke} stroke="currentColor" opacity="0.4" />
    </svg>
  );
}

/** Dagopvang — huisje met kwispelende staart */
export function IlluDaycare({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path d="M16 30l16-13 16 13" {...stroke} stroke="currentColor" />
      <path d="M20 28v20h24V28" {...stroke} stroke="currentColor" />
      <path d="M28 48v-10h8v10" {...stroke} stroke="var(--color-brand)" opacity="0.9" />
      {/* kwispel */}
      <path d="M46 38c3-1 5-4 4-7M46 38c3 .5 6-1 7-3.5" {...stroke} stroke="var(--color-brand)" opacity="0.6" />
      <path d="M12 52h40" {...stroke} stroke="currentColor" opacity="0.25" />
    </svg>
  );
}

/** Pension — maan, mand en rust */
export function IlluPension({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path
        d="M42 14a10 10 0 1 0 9 14 8 8 0 0 1-9-14z"
        {...stroke}
        stroke="var(--color-brand)"
        opacity="0.9"
      />
      {/* mand */}
      <path d="M14 44c0-5 5-8 12-8s12 3 12 8" {...stroke} stroke="currentColor" />
      <path d="M12 44h28l-2 6H14z" {...stroke} stroke="currentColor" />
      {/* slapende hond: rug-lijn */}
      <path d="M19 40c2-3 6-4.5 9-3.5 2.5.8 4 2.5 4 4" {...stroke} stroke="currentColor" opacity="0.7" />
    </svg>
  );
}

/** Trimsalon — schaar en vachtkrullen */
export function IlluGrooming({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="20" cy="42" r="4" {...stroke} stroke="currentColor" />
      <circle cx="20" cy="24" r="4" {...stroke} stroke="currentColor" />
      <path d="M23 39L46 22M23 27l23 17" {...stroke} stroke="currentColor" />
      {/* krullen */}
      <path d="M48 18c2.5 0 4 1.8 4 4M50 44c2.5 0 4-1.8 4-4" {...stroke} stroke="var(--color-brand)" opacity="0.9" />
      <path d="M44 12c1.8 0 3 1.3 3 3" {...stroke} stroke="var(--color-brand)" opacity="0.5" />
    </svg>
  );
}

/** Gedragstherapie — hondenprofiel met rustlijn en hart */
export function IlluBehavior({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      {/* hondenkop profiel */}
      <path
        d="M18 40c0-9 6-16 14-16 5 0 8 3 10 6l6 2-4 4c0 8-6 12-13 12"
        {...stroke}
        stroke="currentColor"
      />
      <path d="M30 24c-1-3 0-6 3-8 1 3 .5 6-1 8" {...stroke} stroke="currentColor" />
      <circle cx="37" cy="33" r="1.4" fill="currentColor" />
      {/* hartslag → rustlijn */}
      <path d="M10 52h10l3-5 4 8 3-5h24" {...stroke} stroke="var(--color-brand)" opacity="0.9" />
    </svg>
  );
}

/** Webshop — tas met poot */
export function IlluShop({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path d="M18 24h28l-3 26H21z" {...stroke} stroke="currentColor" />
      <path d="M25 24v-3a7 7 0 0 1 14 0v3" {...stroke} stroke="currentColor" />
      {/* poot */}
      <ellipse cx="32" cy="40" rx="4" ry="3.2" {...stroke} stroke="var(--color-brand)" opacity="0.9" />
      <circle cx="26.5" cy="35" r="1.5" fill="var(--color-brand)" opacity="0.9" />
      <circle cx="30" cy="32.5" r="1.5" fill="var(--color-brand)" opacity="0.9" />
      <circle cx="34" cy="32.5" r="1.5" fill="var(--color-brand)" opacity="0.9" />
      <circle cx="37.5" cy="35" r="1.5" fill="var(--color-brand)" opacity="0.9" />
    </svg>
  );
}

/** Oppas aan huis — sleutel met pootlabel */
export function IlluSitter({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="24" cy="26" r="9" {...stroke} stroke="currentColor" />
      <circle cx="24" cy="26" r="3.2" {...stroke} stroke="currentColor" opacity="0.5" />
      <path d="M31 33l14 14M40 42l4-4M45 47l4-4" {...stroke} stroke="currentColor" />
      <path d="M14 46c3-2 7-2 10 0" {...stroke} stroke="var(--color-brand)" opacity="0.9" />
    </svg>
  );
}

/** Mond-tot-mond — twee spraakwolkjes met vonk */
export function IlluWordOfMouth({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path d="M12 20a6 6 0 0 1 6-6h12a6 6 0 0 1 6 6v6a6 6 0 0 1-6 6h-6l-6 6v-6a6 6 0 0 1-6-6z" {...stroke} stroke="currentColor" />
      <path d="M40 30h4a6 6 0 0 1 6 6v4a6 6 0 0 1-6 6h-2v5l-5-5h-5a6 6 0 0 1-5-3" {...stroke} stroke="currentColor" opacity="0.7" />
      <path d="M21 22h10M21 26h6" {...stroke} stroke="var(--color-brand)" opacity="0.9" />
    </svg>
  );
}

/** Eigen website — venster met pootcursor */
export function IlluWebsite({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect x="12" y="16" width="40" height="30" rx="4" {...stroke} stroke="currentColor" />
      <path d="M12 24h40" {...stroke} stroke="currentColor" opacity="0.5" />
      <circle cx="17" cy="20" r="1.1" fill="currentColor" opacity="0.5" />
      <circle cx="21" cy="20" r="1.1" fill="currentColor" opacity="0.5" />
      <path d="M18 32h14M18 37h9" {...stroke} stroke="currentColor" opacity="0.5" />
      <path d="M38 34l8 3-3.5 1.5L41 42z" {...stroke} stroke="var(--color-brand)" opacity="0.9" />
    </svg>
  );
}

/** Social media — telefoon met hartje */
export function IlluSocial({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect x="22" y="10" width="20" height="40" rx="5" {...stroke} stroke="currentColor" />
      <path d="M29 14h6" {...stroke} stroke="currentColor" opacity="0.5" />
      <path
        d="M32 36c-4-3-6-5.6-6-8.2 0-2 1.5-3.4 3.3-3.4 1.2 0 2.2.6 2.7 1.6.5-1 1.5-1.6 2.7-1.6 1.8 0 3.3 1.4 3.3 3.4 0 2.6-2 5.2-6 8.2z"
        {...stroke}
        stroke="var(--color-brand)"
        opacity="0.9"
      />
    </svg>
  );
}

/* --- Kleine glyphs voor de live preview & modules (eigen stijl, 24px) --- */

const glyph = {
  fill: "none",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  stroke: "currentColor",
};

export function GlyphAgenda({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="4" y="6" width="16" height="14" rx="3" {...glyph} />
      <path d="M4 11h16M9 4v4M15 4v4" {...glyph} />
    </svg>
  );
}

export function GlyphClients({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="9" cy="9" r="3.2" {...glyph} />
      <path d="M4 19c.6-3 2.6-4.6 5-4.6s4.4 1.6 5 4.6" {...glyph} />
      <path d="M15.5 6.5a3 3 0 0 1 0 5M17.5 14.8c1.4.7 2.3 2 2.5 4.2" {...glyph} />
    </svg>
  );
}

export function GlyphPay({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="3.5" y="6" width="17" height="12" rx="3" {...glyph} />
      <path d="M3.5 10h17" {...glyph} />
      <path d="M7 14.5h4" {...glyph} />
    </svg>
  );
}

export function GlyphShopSmall({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M6 9h12l-1.2 10H7.2z" {...glyph} />
      <path d="M9 9V7.5a3 3 0 0 1 6 0V9" {...glyph} />
    </svg>
  );
}

export function GlyphTeam({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="8" r="3" {...glyph} />
      <path d="M6 19c.7-3.2 3-5 6-5s5.3 1.8 6 5" {...glyph} />
    </svg>
  );
}

export function GlyphPortal({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="4" {...glyph} />
      <path d="M4 9.5h16M9.5 9.5V20" {...glyph} />
    </svg>
  );
}

export function GlyphCard({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="3" {...glyph} />
      <path d="M8 9.5h8M8 13h5" {...glyph} />
      <circle cx="16.5" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function GlyphSpark({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12 4l1.8 5.2L19 11l-5.2 1.8L12 18l-1.8-5.2L5 11l5.2-1.8z" {...glyph} />
    </svg>
  );
}

export function GlyphCheck({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" {...glyph} />
    </svg>
  );
}

export function GlyphArrow({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5" {...glyph} />
    </svg>
  );
}

export function GlyphPaw({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <ellipse cx="12" cy="14.5" rx="4" ry="3.4" {...glyph} />
      <circle cx="6.8" cy="10" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="10.2" cy="7.6" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="13.8" cy="7.6" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="17.2" cy="10" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
