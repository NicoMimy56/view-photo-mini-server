let maxUploadFiles = 100;

export function setUploadLimits({ maxFiles } = {}) {
  if (Number.isFinite(maxFiles) && maxFiles > 0) {
    maxUploadFiles = Math.floor(maxFiles);
  }
}

function chunkFiles(files, size) {
  const chunks = [];
  for (let i = 0; i < files.length; i += size) {
    chunks.push(files.slice(i, i + size));
  }
  return chunks;
}

async function parseJsonResponse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data.message || data.error || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function apiGet(path) {
  const res = await fetch(path, { credentials: "same-origin" });
  return parseJsonResponse(res);
}

export async function apiSend(path, method, body) {
  const res = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: body != null ? JSON.stringify(body) : undefined
  });
  return parseJsonResponse(res);
}

async function uploadBatch(folder, files, { duplicate = "rename", onProgress } = {}) {
  const form = new FormData();
  for (const file of files) {
    form.append("photos", file);
  }

  const params = new URLSearchParams();
  if (folder) params.set("folder", folder);
  if (duplicate) params.set("duplicate", duplicate);
  const query = params.toString() ? `?${params}` : "";

  if (onProgress) {
    return uploadWithProgress(`/api/upload${query}`, form, onProgress);
  }

  const res = await fetch(`/api/upload${query}`, {
    method: "POST",
    credentials: "same-origin",
    body: form
  });
  return parseJsonResponse(res);
}

export async function apiUpload(folder, files, { duplicate = "rename", onProgress } = {}) {
  const batches = chunkFiles(files, maxUploadFiles);
  if (batches.length === 1) {
    return uploadBatch(folder, batches[0], { duplicate, onProgress });
  }

  const aggregate = { uploaded: [], skipped: [], count: 0 };

  for (let i = 0; i < batches.length; i++) {
    const result = await uploadBatch(folder, batches[i], {
      duplicate,
      onProgress: onProgress
        ? (progress) => {
            const overall = Math.round(((i + progress.percent / 100) / batches.length) * 100);
            onProgress({
              ...progress,
              percent: overall,
              batchIndex: i + 1,
              batchCount: batches.length
            });
          }
        : undefined
    });

    aggregate.uploaded.push(...(result.uploaded || []));
    aggregate.skipped.push(...(result.skipped || []));
    aggregate.count += result.count || 0;
  }

  return aggregate;
}

function uploadWithProgress(url, form, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.withCredentials = true;

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      onProgress({
        loaded: event.loaded,
        total: event.total,
        percent: Math.round((event.loaded / event.total) * 100)
      });
    });

    xhr.addEventListener("load", () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText || "{}");
      } catch {
        data = {};
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
        return;
      }
      const err = new Error(data.message || data.error || `Upload failed (${xhr.status})`);
      err.status = xhr.status;
      err.data = data;
      reject(err);
    });

    xhr.addEventListener("error", () => reject(new Error("Upload di rete fallito.")));
    xhr.send(form);
  });
}

export const authApi = {
  me: () => apiGet("/api/auth/me"),
  login: (username, password) => apiSend("/api/auth/login", "POST", { username, password }),
  logout: () => apiSend("/api/auth/logout", "POST", {})
};

export const folderApi = {
  list: () => apiGet("/api/folders"),
  create: (path) => apiSend("/api/folders", "POST", { path }),
  move: (from, to) => apiSend("/api/folders", "PATCH", { from, to }),
  rename: (from, to) => apiSend("/api/folders", "PATCH", { from, to }),
  remove: (path, confirmPath) =>
    apiSend(`/api/folders?path=${encodeURIComponent(path)}`, "DELETE", { confirmPath }),
  inspect: (path) => apiGet(`/api/folders/inspect?path=${encodeURIComponent(path)}`),
  getCovers: () => apiGet("/api/folders/covers"),
  setCover: (folder, photoId) => apiSend("/api/folders/cover", "PUT", { folder, photoId })
};

export const photoApi = {
  list: (folder = "", { sort = "modified", order = "desc" } = {}) =>
    apiGet(`/api/photos?folder=${encodeURIComponent(folder)}&sort=${sort}&order=${order}`),
  search: (q, folder = "", { sort = "modified", order = "desc" } = {}) =>
    apiGet(
      `/api/photos/search?q=${encodeURIComponent(q)}&folder=${encodeURIComponent(folder)}&sort=${sort}&order=${order}`
    ),
  remove: (id, confirmName) => apiSend(`/api/photos/${id}`, "DELETE", { confirmName }),
  removeBatch: (ids, confirmPhrase) =>
    apiSend("/api/photos/delete-batch", "POST", { ids, confirmPhrase }),
  move: (id, folder) => apiSend(`/api/photos/${id}`, "PATCH", { folder }),
  moveBatch: (ids, folder) => apiSend("/api/photos/move-batch", "POST", { ids, folder }),
  rename: (id, name, confirmName) =>
    apiSend(`/api/photos/${id}`, "PATCH", { name, confirmName })
};

export const trashApi = {
  list: () => apiGet("/api/trash"),
  notification: () => apiGet("/api/trash/notification"),
  restore: (id) => apiSend("/api/trash/restore", "POST", { id }),
  confirmPurge: (confirmPhrase) => apiSend("/api/trash/confirm-purge", "POST", { confirmPhrase }),
  postpone: () => apiSend("/api/trash/postpone", "POST", {}),
  empty: (confirmPhrase) => apiSend("/api/trash/empty", "POST", { confirmPhrase }),
  remove: (id, confirmName) => apiSend(`/api/trash/${id}`, "DELETE", { confirmName })
};

export async function downloadZip(ids) {
  const res = await fetch("/api/photos/download-zip", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids })
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || data.error || "Download failed.");
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `viewphoto-${new Date().toISOString().slice(0, 10)}.zip`;
  link.click();
  URL.revokeObjectURL(url);
}

export function thumbUrl(id) {
  return `/api/photos/${id}/thumb`;
}

export function viewUrl(id) {
  return `/api/photos/${id}`;
}

export function downloadUrl(id) {
  return `/api/photos/${id}/download`;
}

export function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}
