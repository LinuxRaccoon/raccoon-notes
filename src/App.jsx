import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  SignedIn,
  SignedOut,
  SignIn,
  UserButton,
  useAuth,
} from "@clerk/clerk-react";
import { api } from "./lib/api.js";
import { offlineStore } from "./lib/offlineStore.js";
import { syncPendingOps } from "./lib/sync.js";

// ---- tiny dependency-free markdown-ish renderer ----
function renderMarkdown(src) {
  const escaped = (src || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const lines = escaped.split("\n");
  const html = lines
    .map((line) => {
      if (/^#\s+/.test(line)) return `<h3 class="md-h">${line.replace(/^#\s+/, "")}</h3>`;
      if (/^-\s+/.test(line)) return `<li class="md-li">${line.replace(/^-\s+/, "")}</li>`;
      if (line.trim() === "") return `<div style="height:8px"></div>`;
      return `<p class="md-p">${line}</p>`;
    })
    .join("");
  return html
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="md-code">$1</code>');
}

function PawIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <ellipse cx="12" cy="16" rx="6" ry="5" fill="currentColor" opacity="0.9" />
      <ellipse cx="5.5" cy="9" rx="2.2" ry="2.8" fill="currentColor" opacity="0.9" />
      <ellipse cx="10" cy="6.2" rx="2.2" ry="2.8" fill="currentColor" opacity="0.9" />
      <ellipse cx="14" cy="6.2" rx="2.2" ry="2.8" fill="currentColor" opacity="0.9" />
      <ellipse cx="18.5" cy="9" rx="2.2" ry="2.8" fill="currentColor" opacity="0.9" />
    </svg>
  );
}

function RaccoonMark({ size = 32 }) {
  return (
    <img
      src="/raccoon-icon.png"
      alt="Raccoon Notes"
      width={size}
      height={size}
      style={{ display: "block" }}
    />
  );
}

function isTempId(id) {
  return typeof id === "string" && id.startsWith("local-");
}

function RaccoonApp() {
  const { getToken } = useAuth();
  const [theme, setTheme] = useState(
    () => localStorage.getItem("raccoon-theme") || "light"
  );
  const [folders, setFolders] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(null); // null = All Notes
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState(true);
  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [mobileView, setMobileView] = useState("list");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(
    () => offlineStore.getQueue().length
  );
  const [conflicts, setConflicts] = useState([]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("raccoon-theme", theme);
  }, [theme]);

  // keep local notes state and the offline cache mirror in lockstep
  function commitNotes(updater) {
    setNotes((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      offlineStore.setNotes(next);
      return next;
    });
  }
  function commitFolders(updater) {
    setFolders((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      offlineStore.setFolders(next);
      return next;
    });
  }

  const runSync = useCallback(async () => {
    if (!navigator.onLine) return;
    const { conflicts: newConflicts } = await syncPendingOps(getToken, {
      onNoteSynced: ({ tempId, serverNote }) => {
        commitNotes((prev) => {
          if (tempId) {
            return prev.map((n) => (n.id === tempId ? serverNote : n));
          }
          return prev.map((n) => (n.id === serverNote.id ? serverNote : n));
        });
        setSelectedNoteId((cur) => (cur === tempId ? serverNote.id : cur));
      },
      onNoteRemoved: (id) => {
        commitNotes((prev) => prev.filter((n) => n.id !== id));
      },
    });
    setConflicts(newConflicts);
    setPendingCount(offlineStore.getQueue().length);
  }, [getToken]);

  // initial load — from the server when online, from the local cache when not
  useEffect(() => {
    (async () => {
      if (navigator.onLine) {
        try {
          const [f, n] = await Promise.all([
            api.listFolders(getToken),
            api.listNotes(getToken),
          ]);
          setFolders(f);
          setNotes(n);
          offlineStore.setFolders(f);
          offlineStore.setNotes(n);
        } catch (e) {
          setError(e.message);
          setFolders(offlineStore.getFolders());
          setNotes(offlineStore.getNotes());
        }
      } else {
        setFolders(offlineStore.getFolders());
        setNotes(offlineStore.getNotes());
      }
      setLoading(false);
      runSync();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // online/offline + tab-refocus triggers for syncing
  useEffect(() => {
    function goOnline() {
      setIsOnline(true);
      runSync();
    }
    function goOffline() {
      setIsOnline(false);
    }
    function handleVisibility() {
      if (document.visibilityState === "visible" && navigator.onLine) runSync();
    }
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [runSync]);

  const visibleNotes = useMemo(() => {
    return notes
      .filter((n) => selectedFolder === null || n.folderId === selectedFolder)
      .filter((n) =>
        query.trim() === ""
          ? true
          : (n.title + n.body).toLowerCase().includes(query.toLowerCase())
      )
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }, [notes, selectedFolder, query]);

  const selectedNote = notes.find((n) => n.id === selectedNoteId) || null;

  // debounced save for the always-online path — unchanged from before
  const saveTimers = useRef({});
  const scheduleSave = useCallback(
    (id, patch) => {
      clearTimeout(saveTimers.current[id]);
      saveTimers.current[id] = setTimeout(async () => {
        try {
          await api.updateNote(getToken, id, patch);
        } catch (e) {
          setError(e.message);
        }
      }, 700);
    },
    [getToken]
  );

  function queueOrSaveUpdate(id, patch) {
    if (isTempId(id)) {
      // not yet created on the server — fold the edit straight into
      // the pending "create" op instead of a separate update
      const createOp = offlineStore
        .getQueue()
        .find((o) => o.type === "create" && o.tempId === id);
      if (createOp) {
        offlineStore.updateOp(createOp.id, {
          payload: { ...createOp.payload, ...patch },
        });
      }
      return;
    }

    if (navigator.onLine) {
      scheduleSave(id, patch);
      return;
    }

    // offline — queue it, merging into any existing pending edit for this note
    const queue = offlineStore.getQueue();
    const existing = queue.find((o) => o.type === "update" && o.noteId === id);
    if (existing) {
      offlineStore.updateOp(existing.id, {
        payload: { ...existing.payload, ...patch },
      });
    } else {
      const note = offlineStore.getNotes().find((n) => n.id === id);
      offlineStore.addOp({
        type: "update",
        noteId: id,
        baseUpdatedAt: note?.updatedAt ?? null,
        payload: { ...patch },
      });
    }
    setPendingCount(offlineStore.getQueue().length);
  }

  function updateNoteLocal(field, value) {
    commitNotes((prev) =>
      prev.map((n) => (n.id === selectedNoteId ? { ...n, [field]: value } : n))
    );
    queueOrSaveUpdate(selectedNoteId, { [field]: value });
  }

  async function createNote() {
    const payload = {
      folderId: selectedFolder,
      title: "",
      body: "",
      isMarkdown: true,
    };

    if (navigator.onLine) {
      try {
        const created = await api.createNote(getToken, payload);
        commitNotes((prev) => [created, ...prev]);
        setSelectedNoteId(created.id);
        setPreview(false);
        setMobileView("editor");
      } catch (e) {
        setError(e.message);
      }
      return;
    }

    // offline — create locally, queue it, reconcile the id once synced
    const tempId = `local-${Date.now()}`;
    const localNote = { id: tempId, ...payload, updatedAt: new Date().toISOString() };
    commitNotes((prev) => [localNote, ...prev]);
    offlineStore.addOp({ type: "create", tempId, payload });
    setPendingCount(offlineStore.getQueue().length);
    setSelectedNoteId(tempId);
    setPreview(false);
    setMobileView("editor");
  }

  async function deleteNote(id) {
    if (isTempId(id)) {
      // never made it to the server — just drop it and its pending create
      const createOp = offlineStore
        .getQueue()
        .find((o) => o.type === "create" && o.tempId === id);
      if (createOp) offlineStore.removeOp(createOp.id);
      commitNotes((prev) => prev.filter((n) => n.id !== id));
      if (selectedNoteId === id) setSelectedNoteId(null);
      setPendingCount(offlineStore.getQueue().length);
      return;
    }

    if (navigator.onLine) {
      try {
        await api.deleteNote(getToken, id);
        commitNotes((prev) => prev.filter((n) => n.id !== id));
        if (selectedNoteId === id) setSelectedNoteId(null);
      } catch (e) {
        setError(e.message);
      }
      return;
    }

    // offline — a delete supersedes any pending edit for the same note
    offlineStore.setQueue(
      offlineStore.getQueue().filter((o) => !(o.type === "update" && o.noteId === id))
    );
    offlineStore.addOp({ type: "delete", noteId: id });
    commitNotes((prev) => prev.filter((n) => n.id !== id));
    if (selectedNoteId === id) setSelectedNoteId(null);
    setPendingCount(offlineStore.getQueue().length);
  }

  async function commitNewFolder() {
    const name = newFolderName.trim();
    setNewFolderName("");
    setAddingFolder(false);
    if (!name) return;
    if (!navigator.onLine) {
      setError("Folders need a connection — try again once you're back online.");
      return;
    }
    try {
      const created = await api.createFolder(getToken, name);
      commitFolders((prev) => [...prev, created]);
    } catch (e) {
      setError(e.message);
    }
  }

  async function deleteFolder(id) {
    if (!navigator.onLine) {
      setError("Folders need a connection — try again once you're back online.");
      return;
    }
    try {
      await api.deleteFolder(getToken, id);
      commitFolders((prev) => prev.filter((f) => f.id !== id));
      if (selectedFolder === id) setSelectedFolder(null);
    } catch (e) {
      setError(e.message);
    }
  }

  async function resolveConflict(conflict, choice) {
    const { op, serverNote } = conflict;
    try {
      if (choice === "mine") {
        if (serverNote) {
          const updated = await api.updateNote(getToken, op.noteId, op.payload);
          commitNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
        } else {
          // deleted elsewhere — recreate it with your edits
          const original = offlineStore.getNotes().find((n) => n.id === op.noteId);
          const created = await api.createNote(getToken, { ...original, ...op.payload });
          commitNotes((prev) => prev.map((n) => (n.id === op.noteId ? created : n)));
        }
      } else if (serverNote) {
        commitNotes((prev) => prev.map((n) => (n.id === serverNote.id ? serverNote : n)));
      } else {
        // server has no version either — it was deleted, so drop it locally too
        commitNotes((prev) => prev.filter((n) => n.id !== op.noteId));
        if (selectedNoteId === op.noteId) setSelectedNoteId(null);
      }
      offlineStore.removeOp(op.id);
      setConflicts((prev) => prev.filter((c) => c.op.id !== op.id));
      setPendingCount(offlineStore.getQueue().length);
    } catch (e) {
      setError(e.message);
    }
  }

  if (loading) {
    return (
      <div className="app-root">
        <div className="empty-state" style={{ width: "100%" }}>
          <RaccoonMark size={40} />
          <span style={{ fontSize: 13 }}>Loading your notes…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="app-root">
      {/* SIDEBAR */}
      <div className={`col sidebar ${mobileView === "folders" ? "" : "mob-hide"}`}>
        <div className="topbar" style={{ borderBottom: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <RaccoonMark size={32} />
            <span style={{ fontFamily: "Georgia, serif", fontWeight: 700, fontSize: 16 }}>
              Raccoon Notes
            </span>
          </div>
          <button
            className="toolbar-btn mobile-only"
            onClick={() => setMobileView("list")}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: "6px 10px", flex: 1, overflowY: "auto" }}>
          <button
            className={`folder-btn ${selectedFolder === null ? "active" : ""}`}
            onClick={() => {
              setSelectedFolder(null);
              setMobileView("list");
            }}
          >
            <PawIcon /> All Notes
          </button>

          {folders.map((f) => (
            <div key={f.id} style={{ display: "flex", alignItems: "center" }}>
              <button
                className={`folder-btn ${selectedFolder === f.id ? "active" : ""}`}
                style={{ flex: 1 }}
                onClick={() => {
                  setSelectedFolder(f.id);
                  setMobileView("list");
                }}
              >
                {f.name}
              </button>
              <button
                onClick={() => deleteFolder(f.id)}
                title="Delete folder"
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--text-secondary)", fontSize: 12, padding: "0 8px",
                }}
              >
                ✕
              </button>
            </div>
          ))}

          {addingFolder ? (
            <div style={{ padding: "6px 12px" }}>
              <input
                autoFocus
                className="newfolder-input"
                placeholder="Folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && commitNewFolder()}
                onBlur={commitNewFolder}
              />
            </div>
          ) : (
            <button className="folder-btn" onClick={() => setAddingFolder(true)}>
              + New folder
            </button>
          )}
        </div>

        <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            className="theme-toggle"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? "☀️ Light mode" : "🌙 Dark mode"}
          </div>
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>

      {/* LIST */}
      <div className={`col list-pane ${mobileView === "list" ? "" : "mob-hide"}`}>
        <div
          className="mobile-only"
          style={{ alignItems: "center", gap: 8, padding: "14px 12px 0" }}
        >
          <RaccoonMark size={26} />
          <span style={{ fontFamily: "Georgia, serif", fontWeight: 700, fontSize: 16 }}>
            Raccoon Notes
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px 0" }}>
          <button
            className="toolbar-btn mobile-only"
            onClick={() => setMobileView("folders")}
          >
            ☰
          </button>
          <span style={{ fontWeight: 700, fontSize: 13.5 }}>
            {selectedFolder === null
              ? "All Notes"
              : folders.find((f) => f.id === selectedFolder)?.name}
          </span>
        </div>
        <div className="search-box">
          <input
            placeholder="Search notes"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {visibleNotes.length === 0 && (
            <div className="empty-state" style={{ height: 200 }}>
              <span style={{ fontSize: 12.5 }}>Nothing here yet</span>
            </div>
          )}
          {visibleNotes.map((n) => (
            <div
              key={n.id}
              className={`note-card ${selectedNoteId === n.id ? "active" : ""}`}
              onClick={() => {
                setSelectedNoteId(n.id);
                setMobileView("editor");
              }}
            >
              <div className="note-title">
                {n.title || "Untitled"}
                {isTempId(n.id) && (
                  <span style={{ color: "var(--accent)", fontSize: 11, marginLeft: 6 }}>
                    ● not synced
                  </span>
                )}
              </div>
              <div className="note-snippet">{(n.body || "").replace(/\n/g, " ").slice(0, 60)}</div>
              <div className="note-date">
                {n.updatedAt ? new Date(n.updatedAt).toLocaleString() : ""}
              </div>
              <button
                className="del-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteNote(n.id);
                }}
                style={{
                  position: "absolute", top: 10, right: 12, background: "none",
                  border: "none", cursor: "pointer", color: "var(--text-secondary)",
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div style={{ padding: 12 }}>
          <button
            className="toolbar-btn"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={createNote}
          >
            + New note
          </button>
        </div>
      </div>

      {/* EDITOR */}
      <div className={`col editor-pane ${mobileView === "editor" ? "" : "mob-hide"}`}>
        {selectedNote ? (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px 8px" }}>
              <button
                className="toolbar-btn"
                onClick={() => setMobileView("list")}
              >
                ← Back
              </button>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select
                  value={selectedNote.folderId ?? ""}
                  onChange={(e) =>
                    updateNoteLocal(
                      "folderId",
                      e.target.value === "" ? null : Number(e.target.value)
                    )
                  }
                  className="toolbar-btn"
                  style={{ paddingRight: 6 }}
                >
                  <option value="">No folder</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <button
                  className={`toolbar-btn ${!preview ? "active" : ""}`}
                  onClick={() => setPreview(false)}
                >
                  Write
                </button>
                <button
                  className={`toolbar-btn ${preview ? "active" : ""}`}
                  onClick={() => setPreview(true)}
                >
                  Preview
                </button>
              </div>
            </div>

            <div style={{ padding: "4px 20px" }}>
              <input
                className="title-input"
                placeholder="Untitled"
                value={selectedNote.title}
                onChange={(e) => updateNoteLocal("title", e.target.value)}
              />
            </div>

            <div style={{ flex: 1, padding: "8px 20px 20px", overflowY: "auto" }}>
              {preview ? (
                <div
                  className="md-preview"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedNote.body) }}
                />
              ) : (
                <textarea
                  className="body-input"
                  placeholder="Start writing in Markdown…"
                  value={selectedNote.body}
                  onChange={(e) => updateNoteLocal("body", e.target.value)}
                />
              )}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <RaccoonMark size={40} />
            <span style={{ fontSize: 13 }}>Select a note, or start a new one</span>
          </div>
        )}
      </div>

      {/* OFFLINE / SYNC STATUS */}
      {(!isOnline || pendingCount > 0) && (
        <div
          style={{
            position: "fixed", bottom: 16, left: 16, background: "var(--bg-surface)",
            border: "1px solid var(--border)", padding: "8px 14px", borderRadius: 8,
            fontSize: 12.5, color: "var(--text-secondary)", zIndex: 40,
          }}
        >
          {!isOnline ? "📴 Offline" : "🔄 Syncing"}
          {pendingCount > 0 ? ` — ${pendingCount} pending` : ""}
        </div>
      )}

      {/* CONFLICT RESOLUTION */}
      {conflicts.length > 0 && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 50, padding: 20,
          }}
        >
          <div
            style={{
              background: "var(--bg-surface)", borderRadius: 12, padding: 24,
              maxWidth: 420, width: "100%", maxHeight: "80vh", overflowY: "auto",
            }}
          >
            <h3 style={{ marginTop: 0, fontFamily: "Georgia, serif" }}>
              Sync conflict{conflicts.length > 1 ? "s" : ""}
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {conflicts.some((c) => !c.serverNote)
                ? "One or more of these notes changed or were deleted elsewhere while you were offline. Pick what to keep."
                : "These notes changed elsewhere while you were offline. Pick which version to keep."}
            </p>
            {conflicts.map((c) => (
              <div
                key={c.op.id}
                style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, marginBottom: 12 }}
              >
                <div style={{ fontWeight: 700, marginBottom: 6 }}>
                  {(c.serverNote?.title || c.op.payload?.title || "Untitled")}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
                  Yours: {(c.op.payload.body ?? "").slice(0, 60) || "(no change to text)"}
                  <br />
                  {c.serverNote
                    ? `Server's: ${(c.serverNote.body ?? "").slice(0, 60)}`
                    : "Server's: (deleted elsewhere)"}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="toolbar-btn active" onClick={() => resolveConflict(c, "mine")}>
                    Keep mine
                  </button>
                  <button className="toolbar-btn" onClick={() => resolveConflict(c, "server")}>
                    {c.serverNote ? "Keep server's" : "Discard mine"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            position: "fixed", bottom: 16, right: 16, background: "#c0392b",
            color: "white", padding: "10px 14px", borderRadius: 8, fontSize: 13,
            maxWidth: 320,
          }}
          onClick={() => setError(null)}
        >
          {error}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <>
      <SignedOut>
        <div
          style={{
            display: "flex",
            minHeight: "100dvh",
            background: "#F7F4EE",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              flex: "1 1 480px",
              minHeight: 280,
              backgroundImage: "url(/raccoon-hero.png)",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div
            style={{
              flex: "1 1 380px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "32px 20px",
              gap: 20,
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontFamily: "Georgia, serif",
                  fontWeight: 700,
                  fontSize: 26,
                  color: "#26241F",
                }}
              >
                🦝 Raccoon Notes
              </div>
              <div style={{ color: "#7C7669", fontSize: 14, marginTop: 4 }}>
                Notes, tidied into dens.
              </div>
            </div>
            <SignIn routing="hash" />
          </div>
        </div>
      </SignedOut>
      <SignedIn>
        <RaccoonApp />
      </SignedIn>
    </>
  );
}
