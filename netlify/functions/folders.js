import { db } from "../../db/index.js";
import { folders } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";
import { requireUserId, unauthorized } from "./_shared/auth.js";

export default async (req) => {
  const userId = await requireUserId(req);
  if (!userId) return unauthorized();

  const { searchParams } = new URL(req.url);

  if (req.method === "GET") {
    const rows = await db
      .select()
      .from(folders)
      .where(eq(folders.userId, userId));
    return Response.json(rows);
  }

  if (req.method === "POST") {
    const body = await req.json();
    if (!body?.name || typeof body.name !== "string") {
      return Response.json({ error: "name is required" }, { status: 400 });
    }
    const [created] = await db
      .insert(folders)
      .values({ userId, name: body.name.trim() })
      .returning();
    return Response.json(created, { status: 201 });
  }

  if (req.method === "DELETE") {
    const id = Number(searchParams.get("id"));
    if (!id) return Response.json({ error: "id is required" }, { status: 400 });
    await db
      .delete(folders)
      .where(and(eq(folders.id, id), eq(folders.userId, userId)));
    return new Response(null, { status: 204 });
  }

  return new Response("Method not allowed", { status: 405 });
};
