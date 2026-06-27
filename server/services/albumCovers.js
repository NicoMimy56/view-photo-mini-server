const fs = require("fs/promises");
const path = require("path");
const { DATA_DIR } = require("../config");
const { encodePhotoId, decodePhotoId } = require("../paths");

const COVERS_PATH = path.join(DATA_DIR, "album-covers.json");

async function readCovers() {
  try {
    const raw = await fs.readFile(COVERS_PATH, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return {};
    throw err;
  }
}

async function writeCovers(covers) {
  await fs.mkdir(path.dirname(COVERS_PATH), { recursive: true });
  await fs.writeFile(COVERS_PATH, JSON.stringify(covers, null, 2), "utf8");
}

async function getCover(folderPath) {
  const covers = await readCovers();
  return covers[folderPath] || null;
}

async function setCover(folderPath, photoId) {
  const covers = await readCovers();
  if (!photoId) delete covers[folderPath];
  else covers[folderPath] = photoId;
  await writeCovers(covers);
  return { folder: folderPath, coverId: photoId || null };
}

async function getAllCovers() {
  return readCovers();
}

function folderMatchesPrefix(folderPath, prefix) {
  return folderPath === prefix || folderPath.startsWith(`${prefix}/`);
}

function remapFolderPath(folderPath, fromRel, toRel) {
  if (folderPath === fromRel) return toRel;
  if (folderPath.startsWith(`${fromRel}/`)) return toRel + folderPath.slice(fromRel.length);
  return folderPath;
}

function remapPhotoId(photoId, fromRel, toRel) {
  if (!photoId) return photoId;
  try {
    const rel = decodePhotoId(photoId);
    if (folderMatchesPrefix(rel, fromRel)) {
      return encodePhotoId(remapFolderPath(rel, fromRel, toRel));
    }
  } catch {
    /* keep original id */
  }
  return photoId;
}

async function renameFolderPrefix(fromRel, toRel) {
  const covers = await readCovers();
  const next = {};
  let changed = false;

  for (const [folderPath, photoId] of Object.entries(covers)) {
    const newFolder = remapFolderPath(folderPath, fromRel, toRel);
    const newPhotoId = remapPhotoId(photoId, fromRel, toRel);
    if (newFolder !== folderPath || newPhotoId !== photoId) changed = true;
    next[newFolder] = newPhotoId;
  }

  if (changed) await writeCovers(next);
}

async function removeFolderPrefix(folderRel) {
  const covers = await readCovers();
  const next = {};
  let changed = false;

  for (const [folderPath, photoId] of Object.entries(covers)) {
    if (folderMatchesPrefix(folderPath, folderRel)) {
      changed = true;
      continue;
    }
    if (photoId) {
      try {
        if (folderMatchesPrefix(decodePhotoId(photoId), folderRel)) {
          changed = true;
          continue;
        }
      } catch {
        /* keep cover entry */
      }
    }
    next[folderPath] = photoId;
  }

  if (changed) await writeCovers(next);
}

module.exports = {
  getCover,
  setCover,
  getAllCovers,
  renameFolderPrefix,
  removeFolderPrefix
};
