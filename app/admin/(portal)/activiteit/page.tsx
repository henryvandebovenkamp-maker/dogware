import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

export const metadata = { title: "Activiteit" };

export default async function ActivityPage() {
  const db = getDb();
  const entries = db
    ? await db
        .select({ log: schema.activityLog, actor: schema.users })
        .from(schema.activityLog)
        .leftJoin(schema.users, eq(schema.activityLog.actorUserId, schema.users.id))
        .orderBy(desc(schema.activityLog.createdAt))
        .limit(200)
    : [];

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">Activiteit</h1>
      <p className="mt-1 text-sm text-ink-500">
        Auditlog van belangrijke handelingen — wie deed wat, en wanneer.
      </p>

      {!db && (
        <div className="mt-6 rounded-2xl bg-brand-100 p-5 text-sm text-brand-600">
          <strong>Database niet gekoppeld.</strong>
        </div>
      )}

      {db && entries.length === 0 && (
        <p className="mt-10 text-center text-sm text-ink-300">Nog geen activiteit.</p>
      )}

      <ul className="mt-6 space-y-2">
        {entries.map(({ log, actor }) => (
          <li
            key={log.id}
            className="rounded-xl bg-white px-4 py-3 shadow-soft ring-1 ring-ink/5"
          >
            <div className="flex flex-wrap items-center gap-2.5 text-[13px]">
              <span className="text-[11px] text-ink-300">
                {log.createdAt.toLocaleString("nl-NL", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span className="rounded-md bg-cream-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-ink-700">
                {log.action}
              </span>
              <span className="text-ink-500">
                {log.objectType}
                {log.objectId && (
                  <span className="text-ink-300"> · {log.objectId.slice(0, 8)}…</span>
                )}
              </span>
              <span className="ml-auto text-[11px] font-semibold text-ink-300">
                {actor?.naam ?? "systeem"}
              </span>
            </div>
            {log.reason && (
              <p className="mt-1 text-[12px] text-ink-500">Reden: {log.reason}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
