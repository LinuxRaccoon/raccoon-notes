import { getStore } from "@netlify/blobs";
import { db } from "../../db/index.js";
import { attachments, notes } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";
import { requireUserId, unauthorized } from "./_shared/auth.js";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB per photo — generous for a phone camera shot, small enough to stay fast

export default async (req) => {
  const userId = await requireUserId(req);
  if (!userId) return unauthorized();

  const store = getStore({ name: "attachments" });
  const { searchParams } = new URL(req.url);

  if (req.method === "GET") {
    const attachmentId = searchParams.get("id");
    const noteId = searchParams.get("noteId");

    if (attachmentId) {
      // fetch one image's bytes
      const [row] = await db
        .select()
        .from(attachments)
        .where(and(eq(attachments.id, Number(attachmentId)), eq(attachments.userId, userId)));
      if (!row) return Response.json({ error: "Not found" }, { status: 404 });

      const data = await store.get(row.blobKey, { type: "arrayBuffer" });
      if (!data) return Response.json({ error: "Not found" }, { status: 404 });

      return new Response(data, {
        headers: { "Content-Type": row.contentType },
      });
    }

    if (noteId) {
      // list metadata only — the app fetches each image's bytes separately
      const rows = await db
        .select()
        .from(attachments)
        .where(and(eq(attachments.noteId, Number(noteId)), eq(attachments.userId, userId)));
      return Response.json(rows);
    }

    return Response.json({ error: "id or noteId is required" }, { status: 400 });
  }

  if (req.method === "POST") {
    const noteId = Number(searchParams.get("noteId"));
    const filename = searchParams.get("filename") || "photo.jpg";
    const contentType = req.headers.get("Content-Type") || "application/octet-stream";
    if (!noteId) return Response.json({ error: "noteId is required" }, { status: 400 });

    // the note has to be real (synced) and belong to this user
    const [note] = await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, noteId), eq(notes.userId, userId)));
    if (!note) return Response.json({ error: "Note not found" }, { status: 404 });

    const bytes = await req.arrayBuffer();
    if (bytes.byteLength > MAX_BYTES) {
      return Response.json({ error: "Photo is too large (8MB max)" }, { status: 413 });
    }

    const blobKey = `${userId}/${noteId}/${Date.now()}-${filename}`;
    await store.set(blobKey, bytes, { metadata: { contentType } });

    const [created] = await db
      .insert(attachments)
      .values({ noteId, userId, blobKey, filename, contentType })
      .returning();

    return Response.json(created, { status: 201 });
  }

  if (req.method === "DELETE") {
    const id = Number(searchParams.get("id"));
    if (!id) return Response.json({ error: "id is required" }, { status: 400 });

    const [row] = await db
      .select()
      .from(attachments)
      .where(and(eq(attachments.id, id), eq(attachments.userId, userId)));
    if (!row) return new Response(null, { status: 204 });

    await store.delete(row.blobKey);
    await db.delete(attachments).where(eq(attachments.id, id));
    return new Response(null, { status: 204 });
  }

  return new Response("Method not allowed", { status: 405 });
};
