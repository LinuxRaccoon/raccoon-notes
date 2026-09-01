async function authFetch(getToken, url, options = {}) {
  const token = await getToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  listFolders: (getToken) => authFetch(getToken, "/.netlify/functions/folders"),
  createFolder: (getToken, name) =>
    authFetch(getToken, "/.netlify/functions/folders", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  deleteFolder: (getToken, id) =>
    authFetch(getToken, `/.netlify/functions/folders?id=${id}`, {
      method: "DELETE",
    }),

  listNotes: (getToken) => authFetch(getToken, "/.netlify/functions/notes"),
  createNote: (getToken, data) =>
    authFetch(getToken, "/.netlify/functions/notes", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateNote: (getToken, id, data) =>
    authFetch(getToken, `/.netlify/functions/notes?id=${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteNote: (getToken, id) =>
    authFetch(getToken, `/.netlify/functions/notes?id=${id}`, {
      method: "DELETE",
    }),

  listAttachments: (getToken, noteId) =>
    authFetch(getToken, `/.netlify/functions/attachments?noteId=${noteId}`),

  uploadAttachment: async (getToken, noteId, file) => {
    const token = await getToken();
    const res = await fetch(
      `/.netlify/functions/attachments?noteId=${noteId}&filename=${encodeURIComponent(file.name)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`${res.status} ${res.statusText}: ${text}`);
    }
    return res.json();
  },

  fetchAttachmentBlob: async (getToken, id) => {
    const token = await getToken();
    const res = await fetch(`/.netlify/functions/attachments?id=${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.blob();
  },

  deleteAttachment: (getToken, id) =>
    authFetch(getToken, `/.netlify/functions/attachments?id=${id}`, {
      method: "DELETE",
    }),
};
