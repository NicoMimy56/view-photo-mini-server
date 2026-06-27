const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const {
  TRASH_DIR,
  TRASH_RETENTION_DAYS,
  TRASH_POSTPONE_DAYS,
  PHOTOS_DIR
} = require("../config");
const { resolveFolderPath, toRelativePath, isAllowedExtension } = require("../paths");
const { deleteThumbnail } = require("./thumbnails");

const MANIFEST_PATH = path.join(TRASH_DIR, "manifest.json");
const DATA_DIR = path.join(TRASH_DIR, "data");

async function ensureTrashDirs() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readManifest() {
  await ensureTrashDirs();
  try {
    const raw = await fs.readFile(MANIFEST_PATH, "utf8");
    const data = JSON.parse(raw);
    if (!Array.isArray(data.items)) data.items = [];
    return data;
  } catch (err) {
    if (err.code === "ENOENT") return { version: 1, items: [] };
    throw err;
  }
}

async function writeManifest(manifest) {
  await ensureTrashDirs();
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");
}

function daysSince(isoDate) {
  return (Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24);
}

function trashItemPath(itemId) {
  return path.join(DATA_DIR, itemId);
}

async function getItemSize(item) {
  const base = trashItemPath(item.id);
  let total = 0;

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) {
        const stat = await fs.stat(full);
        total += stat.size;
      }
    }
  }

  try {
    await walk(base);
  } catch {
    return 0;
  }
  return total;
}

async function movePathToTrash(relativePath, type) {
  let sourceFull;
  let fileName = path.basename(relativePath);

  if (type === "photo") {
    const folder = path.dirname(relativePath) === "." ? "" : path.dirname(relativePath);
    sourceFull = path.join(resolveFolderPath(folder), fileName);
  } else {
    sourceFull = path.join(PHOTOS_DIR, ...relativePath.split("/"));
  }

  try {
    await fs.access(sourceFull);
  } catch {
    const err = new Error(type === "photo" ? "Photo not found." : "Folder not found.");
    err.code = "not_found";
    throw err;
  }

  const manifest = await readManifest();
  const id = crypto.randomUUID();
  const destDir = trashItemPath(id);
  await fs.mkdir(destDir, { recursive: true });

  const preserved = type === "photo" ? relativePath : relativePath;
  const destFull = path.join(destDir, preserved.split("/").join(path.sep));
  await fs.mkdir(path.dirname(destFull), { recursive: true });
  try {
    await fs.rename(sourceFull, destFull);
  } catch (err) {
    if (err.code !== "EXDEV") throw err;
    await fs.copyFile(sourceFull, destFull);
    await fs.unlink(sourceFull);
  }

  if (type === "photo") {
    await deleteThumbnail(relativePath);
  }

  const item = {
    id,
    type,
    name: type === "photo" ? fileName : path.basename(relativePath),
    originalPath: relativePath,
    deletedAt: new Date().toISOString(),
    purgePending: false,
    purgeNotifiedAt: null,
    postponedUntil: null
  };

  manifest.items.push(item);
  await writeManifest(manifest);
  return item;
}

async function trashPhoto(relativePath) {
  return movePathToTrash(relativePath, "photo");
}

async function trashFolder(relativePath) {
  return movePathToTrash(relativePath, "folder");
}

async function listTrash() {
  const manifest = await readManifest();
  const items = [];

  for (const item of manifest.items) {
    items.push({
      ...item,
      daysInTrash: Math.floor(daysSince(item.deletedAt)),
      size: await getItemSize(item)
    });
  }

  items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  return items;
}

async function restoreItem(itemId) {
  const manifest = await readManifest();
  const index = manifest.items.findIndex((item) => item.id === itemId);
  if (index === -1) {
    const err = new Error("Trash item not found.");
    err.code = "not_found";
    throw err;
  }

  const item = manifest.items[index];
  const sourceFull = path.join(trashItemPath(item.id), item.originalPath.split("/").join(path.sep));
  const destFull = path.join(PHOTOS_DIR, item.originalPath.split("/").join(path.sep));

  try {
    await fs.access(destFull);
    const err = new Error("Cannot restore: a file or folder already exists at the original location.");
    err.code = "file_exists";
    throw err;
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }

  await fs.mkdir(path.dirname(destFull), { recursive: true });
  await fs.rename(sourceFull, destFull);
  await fs.rm(trashItemPath(item.id), { recursive: true, force: true });

  manifest.items.splice(index, 1);
  await writeManifest(manifest);
  return { restored: item };
}

async function permanentlyDeleteItem(itemId) {
  const manifest = await readManifest();
  const index = manifest.items.findIndex((item) => item.id === itemId);
  if (index === -1) {
    const err = new Error("Trash item not found.");
    err.code = "not_found";
    throw err;
  }

  const item = manifest.items[index];
  await fs.rm(trashItemPath(item.id), { recursive: true, force: true });
  manifest.items.splice(index, 1);
  await writeManifest(manifest);
  return { deleted: item };
}

async function markPendingPurge() {
  const manifest = await readManifest();
  let changed = false;

  for (const item of manifest.items) {
    if (item.postponedUntil && new Date(item.postponedUntil) > new Date()) continue;

    const age = daysSince(item.deletedAt);
    if (age >= TRASH_RETENTION_DAYS && !item.purgePending) {
      item.purgePending = true;
      item.purgeNotifiedAt = new Date().toISOString();
      changed = true;
    }
  }

  if (changed) await writeManifest(manifest);
  return getPurgeNotification();
}

async function getPurgeNotification() {
  const manifest = await readManifest();
  const pending = manifest.items.filter((item) => item.purgePending);
  if (!pending.length) {
    return { pending: false, count: 0, totalSize: 0, items: [] };
  }

  const items = [];
  let totalSize = 0;
  for (const item of pending) {
    const size = await getItemSize(item);
    totalSize += size;
    items.push({
      id: item.id,
      name: item.name,
      originalPath: item.originalPath,
      type: item.type,
      deletedAt: item.deletedAt,
      daysInTrash: Math.floor(daysSince(item.deletedAt)),
      size
    });
  }

  return {
    pending: true,
    count: pending.length,
    totalSize,
    retentionDays: TRASH_RETENTION_DAYS,
    items
  };
}

async function confirmPurge(confirmPhrase) {
  const { assertTypedConfirmation } = require("../paths");
  assertTypedConfirmation(confirmPhrase, "SVUOTA CESTINO");

  const manifest = await readManifest();
  const toDelete = manifest.items.filter((item) => item.purgePending);
  const deleted = [];

  for (const item of toDelete) {
    await fs.rm(trashItemPath(item.id), { recursive: true, force: true });
    deleted.push(item);
  }

  manifest.items = manifest.items.filter((item) => !item.purgePending);
  await writeManifest(manifest);
  return { deleted, count: deleted.length };
}

async function postponePurge() {
  const manifest = await readManifest();
  const until = new Date(Date.now() + TRASH_POSTPONE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  for (const item of manifest.items) {
    if (item.purgePending) {
      item.purgePending = false;
      item.purgeNotifiedAt = null;
      item.postponedUntil = until;
    }
  }

  await writeManifest(manifest);
  return { postponedUntil: until };
}

async function emptyAllTrash(confirmPhrase) {
  const { assertTypedConfirmation } = require("../paths");
  assertTypedConfirmation(confirmPhrase, "SVUOTA TUTTO");

  const manifest = await readManifest();
  for (const item of manifest.items) {
    await fs.rm(trashItemPath(item.id), { recursive: true, force: true });
  }
  const count = manifest.items.length;
  manifest.items = [];
  await writeManifest(manifest);
  return { count };
}

async function reconcileManifest() {
  const manifest = await readManifest();
  const before = manifest.items.length;
  const kept = [];

  for (const item of manifest.items) {
    try {
      await fs.access(trashItemPath(item.id));
      kept.push(item);
    } catch {
      /* orphan entry — file missing on disk */
    }
  }

  manifest.items = kept;
  if (kept.length !== before) {
    await writeManifest(manifest);
  }

  return { removed: before - kept.length, remaining: kept.length };
}

module.exports = {
  trashPhoto,
  trashFolder,
  listTrash,
  restoreItem,
  permanentlyDeleteItem,
  markPendingPurge,
  getPurgeNotification,
  confirmPurge,
  postponePurge,
  emptyAllTrash,
  reconcileManifest
};
