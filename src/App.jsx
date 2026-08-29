import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  SignedIn,
  SignedOut,
  SignIn,
  UserButton,
  useAuth,
} from "@clerk/clerk-react";
import { api } from "./lib/api.js";

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

function RaccoonMark({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      {/* ears */}
      <circle cx="10" cy="11" r="5.5" className="mark-fur" />
      <circle cx="30" cy="11" r="5.5" className="mark-fur" />
      <circle cx="10" cy="11" r="2.6" className="mark-mask" />
      <circle cx="30" cy="11" r="2.6" className="mark-mask" />
      {/* head */}
      <ellipse cx="20" cy="23" rx="13.5" ry="12" className="mark-fur" />
      {/* mask band */}
      <path d="M8 20 Q20 15 32 20 Q30 27 20 28 Q10 27 8 20Z" className="mark-mask" />
      {/* eyes */}
      <ellipse cx="15.5" cy="21" rx="2.6" ry="3" fill="var(--bg-app)" />
      <ellipse cx="24.5" cy="21" rx="2.6" ry="3" fill="var(--bg-app)" />
      <circle cx="15.5" cy="21.5" r="1.2" className="mark-mask" />
      <circle cx="24.5" cy="21.5" r="1.2" className="mark-mask" />
      {/* nose */}
      <ellipse cx="20" cy="27.5" rx="1.8" ry="1.3" className="mark-mask" />
    </svg>
  );
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

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("raccoon-theme", theme);
  }, [theme]);

  useEffect(() => {
    (async () => {
      try {
        const [f, n] = await Promise.all([
          api.listFolders(getToken),
          api.listNotes(getToken),
        ]);
        setFolders(f);
        setNotes(n);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // debounced save so we're not firing a PATCH on every keystroke
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

  function updateNoteLocal(field, value) {
    setNotes((prev) =>
      prev.map((n) => (n.id === selectedNoteId ? { ...n, [field]: value } : n))
    );
    scheduleSave(selectedNoteId, { [field]: value });
  }

  async function createNote() {
    try {
      const created = await api.createNote(getToken, {
        folderId: selectedFolder,
        title: "",
        body: "",
        isMarkdown: true,
      });
      setNotes((prev) => [created, ...prev]);
      setSelectedNoteId(created.id);
      setPreview(false);
      setMobileView("editor");
    } catch (e) {
      setError(e.message);
    }
  }

  async function deleteNote(id) {
    try {
      await api.deleteNote(getToken, id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (selectedNoteId === id) setSelectedNoteId(null);
    } catch (e) {
      setError(e.message);
    }
  }

  async function commitNewFolder() {
    const name = newFolderName.trim();
    setNewFolderName("");
    setAddingFolder(false);
    if (!name) return;
    try {
      const created = await api.createFolder(getToken, name);
      setFolders((prev) => [...prev, created]);
    } catch (e) {
      setError(e.message);
    }
  }

  async function deleteFolder(id) {
    try {
      await api.deleteFolder(getToken, id);
      setFolders((prev) => prev.filter((f) => f.id !== id));
      if (selectedFolder === id) setSelectedFolder(null);
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
            <RaccoonMark size={26} />
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
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 12px 0" }}>
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
              <div className="note-title">{n.title || "Untitled"}</div>
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
            display: "flex", justifyContent: "center", alignItems: "center",
            minHeight: "100vh", background: "#F7F4EE",
          }}
        >
          <SignIn routing="hash" />
        </div>
      </SignedOut>
      <SignedIn>
        <RaccoonApp />
      </SignedIn>
    </>
  );
}
