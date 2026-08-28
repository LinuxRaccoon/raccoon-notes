import { db } from "../../db/index.js";
import { notes } from "../../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { requireUserId, unauthorized } from "./_shared/auth.js";

export default async (req) => {
  const userId = await requireUserId(req);
  if (!userId) return unauthorized();

  const { searchParams } = new URL(req.url);

  if (req.method === "GET") {
    const folderId = searchParams.get("folderId");
    const conditions = [eq(notes.userId, userId)];
    if (folderId) conditions.push(eq(notes.folderId, Number(folderId)));

    const rows = await db
      .select()
      .from(notes)
      .where(and(...conditions))
      .orderBy(desc(notes.updatedAt));
    return Response.json(rows);
  }

  if (req.method === "POST") {
    const body = await req.json();
    const [created] = await db
      .insert(notes)
      .values({
        userId,
        folderId: body.folderId ?? null,
        title: body.title ?? "",
        body: body.body ?? "",
        isMarkdown: body.isMarkdown ?? true,
        lat: body.lat ?? null,
        lng: body.lng ?? null,
      })
      .returning();
    return Response.json(created, { status: 201 });
  }

  if (req.method === "PATCH") {
    const id = Number(searchParams.get("id"));
    if (!id) return Response.json({ error: "id is required" }, { status: 400 });

    const body = await req.json();
    const updatable = {};
    for (const key of ["title", "body", "folderId", "isMarkdown", "lat", "lng"]) {
      if (key in body) updatable[key] = body[key];
    }
    updatable.updatedAt = new Date();

    const [updated] = await db
      .update(notes)
      .set(updatable)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .returning();

    if (!updated) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(updated);
  }

  if (req.method === "DELETE") {
    const id = Number(searchParams.get("id"));
    if (!id) return Response.json({ error: "id is required" }, { status: 400 });
    await db
      .delete(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)));
    return new Response(null, { status: 204 });
  }

  return new Response("Method not allowed", { status: 405 });
};
