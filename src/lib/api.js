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
};
