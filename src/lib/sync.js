import { api } from "./api.js";
import { offlineStore } from "./offlineStore.js";

// Attempts to flush the pending operation queue against the server.
// Netlify's database is always the source of truth: anything that can
// be applied unambiguously (nothing else touched that note while we
// were offline) is applied automatically. Anything genuinely ambiguous
// — the note changed both here and on the server — comes back as a
// conflict for the person to resolve, rather than being silently merged.
export async function syncPendingOps(getToken, { onNoteSynced, onNoteRemoved } = {}) {
  const queue = offlineStore.getQueue();
  if (queue.length === 0) return { conflicts: [] };

  let serverNotes;
  try {
    serverNotes = await api.listNotes(getToken);
  } catch {
    // still offline, or the server's unreachable — try again next time
    return { conflicts: [] };
  }

  const conflicts = [];

  for (const op of queue) {
    try {
      if (op.type === "create") {
        const created = await api.createNote(getToken, op.payload);
        offlineStore.removeOp(op.id);
        onNoteSynced?.({ tempId: op.tempId, serverNote: created });
      } else if (op.type === "update") {
        const serverNote = serverNotes.find((n) => n.id === op.noteId);

        if (!serverNote) {
          // deleted elsewhere while we were offline — genuinely ambiguous
          conflicts.push({ op, serverNote: null });
          continue;
        }

        const unchanged =
          new Date(serverNote.updatedAt).getTime() ===
          new Date(op.baseUpdatedAt).getTime();

        if (unchanged) {
          const updated = await api.updateNote(getToken, op.noteId, op.payload);
          offlineStore.removeOp(op.id);
          onNoteSynced?.({ tempId: null, serverNote: updated });
        } else {
          conflicts.push({ op, serverNote });
        }
      } else if (op.type === "delete") {
        await api.deleteNote(getToken, op.noteId).catch(() => {});
        offlineStore.removeOp(op.id);
        onNoteRemoved?.(op.noteId);
      }
    } catch {
      // a network hiccup mid-sync, not a real conflict — leave this
      // op (and anything after it) queued, we'll retry on the next pass
      break;
    }
  }

  return { conflicts };
}
