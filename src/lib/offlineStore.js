const NOTES_KEY = "raccoon-notes:cache:notes";
const FOLDERS_KEY = "raccoon-notes:cache:folders";
const QUEUE_KEY = "raccoon-notes:queue";

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or unavailable — fail silently, the next successful
    // sync will re-establish an accurate cache anyway
  }
}

function newOpId() {
  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const offlineStore = {
  getNotes: () => read(NOTES_KEY, []),
  setNotes: (notes) => write(NOTES_KEY, notes),

  getFolders: () => read(FOLDERS_KEY, []),
  setFolders: (folders) => write(FOLDERS_KEY, folders),

  getQueue: () => read(QUEUE_KEY, []),
  setQueue: (queue) => write(QUEUE_KEY, queue),

  addOp(op) {
    const queue = this.getQueue();
    queue.push({ id: newOpId(), ...op });
    this.setQueue(queue);
  },
  removeOp(opId) {
    this.setQueue(this.getQueue().filter((o) => o.id !== opId));
  },
  updateOp(opId, patch) {
    this.setQueue(
      this.getQueue().map((o) => (o.id === opId ? { ...o, ...patch } : o))
    );
  },
};
