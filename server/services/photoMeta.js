const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");
const { DATA_DIR } = require("../config");

const META_PATH = path.join(DATA_DIR, "photo-meta.json");

async function readStore() {
  try {
    const raw = await fs.readFile(META_PATH, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return {};
    throw err;
  }
}

async function writeStore(store) {
  await fs.mkdir(path.dirname(META_PATH), { recursive: true });
  await fs.writeFile(META_PATH, JSON.stringify(store, null, 2), "utf8");
}

function parseExifDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const normalized = String(value).replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function extractTakenAt(absolutePath) {
  const { isVideoFile } = require("./mediaTypes");
  if (isVideoFile(absolutePath)) {
    try {
      const stat = await fs.stat(absolutePath);
      return stat.mtime.toISOString();
    } catch {
      return null;
    }
  }

  try {
    const meta = await sharp(absolutePath).metadata();
    if (meta.exif) {
      const str = Buffer.from(meta.exif).toString("latin1");
      const match = str.match(/(\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2})/);
      if (match) return parseExifDate(match[1]);
    }
  } catch {
    /* fallback below */
  }

  try {
    const stat = await fs.stat(absolutePath);
    return stat.mtime.toISOString();
  } catch {
    return null;
  }
}

async function getTakenAt(relativePath, absolutePath) {
  const store = await readStore();
  if (store[relativePath]?.takenAt) return store[relativePath].takenAt;

  const takenAt = await extractTakenAt(absolutePath);
  store[relativePath] = { takenAt, updatedAt: new Date().toISOString() };
  await writeStore(store);
  return takenAt;
}

async function updatePath(oldRelative, newRelative) {
  const store = await readStore();
  if (store[oldRelative]) {
    store[newRelative] = store[oldRelative];
    delete store[oldRelative];
    await writeStore(store);
  }
}

async function removePath(relativePath) {
  const store = await readStore();
  if (store[relativePath]) {
    delete store[relativePath];
    await writeStore(store);
  }
}

function folderMatchesPrefix(relativePath, prefix) {
  return relativePath === prefix || relativePath.startsWith(`${prefix}/`);
}

function remapFolderPath(relativePath, fromRel, toRel) {
  if (relativePath === fromRel) return toRel;
  if (relativePath.startsWith(`${fromRel}/`)) return toRel + relativePath.slice(fromRel.length);
  return relativePath;
}

async function renameFolderPrefix(fromRel, toRel) {
  const store = await readStore();
  const next = { ...store };
  let changed = false;

  for (const key of Object.keys(store)) {
    if (!folderMatchesPrefix(key, fromRel)) continue;
    const newKey = remapFolderPath(key, fromRel, toRel);
    next[newKey] = store[key];
    delete next[key];
    changed = true;
  }

  if (changed) await writeStore(next);
}

async function removeFolderPrefix(folderRel) {
  const store = await readStore();
  const next = { ...store };
  let changed = false;

  for (const key of Object.keys(store)) {
    if (folderMatchesPrefix(key, folderRel)) {
      delete next[key];
      changed = true;
    }
  }

  if (changed) await writeStore(next);
}

module.exports = {
  getTakenAt,
  extractTakenAt,
  updatePath,
  removePath,
  renameFolderPrefix,
  removeFolderPrefix
};
