"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { logActivity } from "@/lib/audit";
import { draaiAgent, zorgVoorAgents } from "@/lib/groei/agents";
import { VINDBARE_BRANCHES } from "@/lib/groei/bronnen/osm";
import type { BrancheSlug } from "@/lib/branches";

export type AgentState = { status: "idle" | "ok" | "error"; message?: string };

const schoon = (v: FormDataEntryValue | null, max = 200) =>
  String(v ?? "").trim().slice(0, max);

/**
 * Zet de standaardagents klaar als er nog geen zijn.
 * Geeft niets terug: wordt rechtstreeks als form-action gebruikt.
 */
export async function maakStandaardAgents(): Promise<void> {
  const user = await requireAdmin();
  await zorgVoorAgents(user.id);
  revalidatePath("/admin/groei/agents");
  revalidatePath("/admin/groei");
  revalidatePath("/admin/groei/bedrijven");
}

/** Eén agent nu laten zoeken. Henry drukt op de knop; de agent doet het werk. */
export async function draaiAgentNu(
  _prev: AgentState,
  form: FormData,
): Promise<AgentState> {
  const user = await requireAdmin();
  const db = getDb();
  if (!db) return { status: "error", message: "Geen database." };

  const id = schoon(form.get("agentId"), 40);
  const [agent] = await db
    .select()
    .from(schema.groeiAgents)
    .where(
      and(
        eq(schema.groeiAgents.id, id),
        eq(schema.groeiAgents.ownerUserId, user.id),
      ),
    )
    .limit(1);
  if (!agent) return { status: "error", message: "Agent niet gevonden." };
  if (!agent.actief) {
    return { status: "error", message: "Deze agent staat op pauze." };
  }

  try {
    const res = await draaiAgent(agent);
    await logActivity({
      actorUserId: user.id,
      action: "groei.agent_run",
      objectType: "groei_agent",
      objectId: agent.id,
      newValue: { gevonden: res.gevonden, nieuw: res.nieuw },
    });
    revalidatePath("/admin/groei/agents");
    revalidatePath("/admin/groei/bedrijven");
    revalidatePath("/admin/groei");
    return { status: "ok", message: res.samenvatting };
  } catch (err) {
    const bericht = err instanceof Error ? err.message : "onbekende fout";
    console.error(
      JSON.stringify({
        evt: "groei.agent_fout",
        at: new Date().toISOString(),
        agent: agent.naam,
        error: bericht,
      }),
    );
    revalidatePath("/admin/groei/agents");
    return {
      status: "error",
      message: `Het zoeken lukte niet: ${bericht}`,
    };
  }
}

/** Pauzeren of weer aanzetten. */
export async function zetAgentAanUit(
  _prev: AgentState,
  form: FormData,
): Promise<AgentState> {
  const user = await requireAdmin();
  const db = getDb();
  if (!db) return { status: "error", message: "Geen database." };

  const id = schoon(form.get("agentId"), 40);
  const [agent] = await db
    .select({ actief: schema.groeiAgents.actief })
    .from(schema.groeiAgents)
    .where(
      and(
        eq(schema.groeiAgents.id, id),
        eq(schema.groeiAgents.ownerUserId, user.id),
      ),
    )
    .limit(1);
  if (!agent) return { status: "error", message: "Agent niet gevonden." };

  await db
    .update(schema.groeiAgents)
    .set({ actief: !agent.actief })
    .where(eq(schema.groeiAgents.id, id));

  revalidatePath("/admin/groei/agents");
  return { status: "ok" };
}

/** Zoekgebied en tempo bijstellen. */
export async function bewerkAgent(
  _prev: AgentState,
  form: FormData,
): Promise<AgentState> {
  const user = await requireAdmin();
  const db = getDb();
  if (!db) return { status: "error", message: "Geen database." };

  const id = schoon(form.get("agentId"), 40);
  const branche = schoon(form.get("branche"), 40) as BrancheSlug;
  if (!VINDBARE_BRANCHES.includes(branche)) {
    return {
      status: "error",
      message: "Deze branche is niet vindbaar in de huidige bron.",
    };
  }

  const provincies = form.getAll("provincies").map((p) => schoon(p, 40)).filter(Boolean);
  const maxPerRun = Math.min(Math.max(Number(form.get("maxPerRun")) || 25, 1), 100);

  await db
    .update(schema.groeiAgents)
    .set({ branche, provincies, maxPerRun })
    .where(
      and(
        eq(schema.groeiAgents.id, id),
        eq(schema.groeiAgents.ownerUserId, user.id),
      ),
    );

  revalidatePath("/admin/groei/agents");
  return { status: "ok", message: "Aangepast." };
}
