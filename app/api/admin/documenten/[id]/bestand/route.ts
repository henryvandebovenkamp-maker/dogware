import { eq } from "drizzle-orm";
import { getAdminActor } from "@/lib/admin-auth";
import { getDb, schema } from "@/lib/db";

/**
 * Het bestand achter een document (nu: de demo-PDF), alleen voor de
 * beheerder. `?download=1` biedt het aan als download, anders inline om te
 * bekijken. Geen publieke URL: zonder beheerderssessie is er niets.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getAdminActor();
  if (!actor) return new Response("Niet gevonden", { status: 404 });
  const db = getDb();
  if (!db) return new Response("Niet gevonden", { status: 404 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Niet gevonden", { status: 404 });

  const [bestand] = await db
    .select()
    .from(schema.documentFiles)
    .where(eq(schema.documentFiles.documentId, id))
    .limit(1);
  if (!bestand) return new Response("Niet gevonden", { status: 404 });

  const download = new URL(req.url).searchParams.get("download") === "1";
  const naam = bestand.bestandsnaam.replace(/[^\w.\-]+/g, "-");
  return new Response(new Uint8Array(bestand.inhoud), {
    headers: {
      "Content-Type": bestand.mime,
      "Content-Length": String(bestand.grootte),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${naam}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
