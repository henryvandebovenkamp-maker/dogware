"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  ALGEMEEN,
  brancheContent,
  getBranche,
  type BrancheContent,
  type BrancheSlug,
} from "@/lib/branches";

const STORAGE_KEY = "dogware:branche";

/**
 * De gekozen branche als kleine externe store. Bewust géén React-context met
 * een effect dat de opslag inleest: met useSyncExternalStore rendert de
 * server de algemene versie, en schakelt de client na hydratie in één keer
 * door naar de gekozen branche — zonder cascaderende renders.
 *
 * De keuze staat in sessionStorage en nadrukkelijk niet in localStorage: hij
 * hoort bij dít bezoek. Eerder bleef een klik onbeperkt staan, waardoor iemand
 * die ooit één keer op "Chipservice" klikte de site maanden later nog als
 * chipserviceproduct terugzag. Een nieuw tabblad of een nieuw bezoek begint nu
 * altijd blanco bij de algemene positionering; binnen het bezoek blijft de
 * keuze gewoon staan als je doorklikt naar een andere pagina.
 *
 * (De hero trekt zich sowieso niets van deze keuze aan — die leest
 * `positioneringContent()`. Dit gaat over de secties eronder.)
 */
let current: BrancheSlug | null = null;
let gelezen = false;
const listeners = new Set<() => void>();

function lees(): BrancheSlug | null {
  try {
    // Opruimen van de oude, permanente opslag. Zonder dit blijft bij bestaande
    // bezoekers een sleutel achter die niets meer doet maar wel verwarring
    // wekt bij het volgende onderzoek naar "waarom zie ik deze branche?".
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage kan geblokkeerd zijn; dan valt er ook niets op te ruimen.
  }
  try {
    const saved = window.sessionStorage.getItem(STORAGE_KEY);
    return saved && getBranche(saved) ? (saved as BrancheSlug) : null;
  } catch {
    // Opslag kan geblokkeerd zijn; dan tonen we gewoon de algemene versie.
    return null;
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function getSnapshot(): BrancheSlug | null {
  if (!gelezen) {
    current = lees();
    gelezen = true;
  }
  return current;
}

/** Tijdens server-rendering is er nog geen keuze bekend. */
function getServerSnapshot(): BrancheSlug | null {
  return null;
}

function schrijf(slug: BrancheSlug | null) {
  current = slug;
  gelezen = true;
  try {
    if (slug) window.sessionStorage.setItem(STORAGE_KEY, slug);
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // niets aan te doen; de keuze werkt deze paginaweergave gewoon
  }
  for (const l of listeners) l();
}

export function useBranche() {
  const active = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const select = useCallback((slug: BrancheSlug | null) => schrijf(slug), []);
  return { active, content: brancheContent(active), select };
}

/**
 * De inhoud voor de huidige keuze. Geef een slug mee als `override` op een
 * branchelandingspagina: die pagina staat altijd vast op één branche.
 *
 * Bewust een string en geen Branche-object: servercomponenten kunnen geen
 * objecten met iconcomponenten doorgeven aan clientcomponenten.
 */
export function useBrancheContent(override?: string | null): BrancheContent {
  const active = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (override) return brancheContent(override);
  return active ? brancheContent(active) : ALGEMEEN;
}
