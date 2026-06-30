const fs = require("fs/promises");
const path = require("path");
const {
  resolveFolderPath,
  toRelativePath,
  normalizeFolderPath,
  assertTypedConfirmation,
  encodePhotoId,
  isAllowedExtension
} = require("../paths");
const { FOLDER_DELETE_MODE } = require("../config");

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function countFolderContents(absolutePath) {
  let entries;
  try {
    entries = await fs.readdir(absolutePath, { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT") {
      const error = new Error("Folder not found.");
      error.code = "not_found";
      throw error;
    }
    throw err;
  }

  let photos = 0;
  let subfolders = 0;

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) subfolders += 1;
    else if (entry.isFile()) photos += 1;
  }

  return { photos, subfolders, total: photos + subfolders };
}

const PREVIEW_MAX = 4;

function pickEvenlySpaced(items, max) {
  if (items.length <= max) return items;
  const picked = [];
  for (let i = 0; i < max; i++) {
    const idx = Math.floor((i * (items.length - 1)) / (max - 1));
    picked.push(items[idx]);
  }
  return picked;
}

function mergePreviewIds(directIds, childLists, max = PREVIEW_MAX) {
  const merged = [...directIds];
  const seen = new Set(merged);

  for (let round = 0; merged.length < max; round++) {
    let added = false;
    for (const childIds of childLists) {
      const id = childIds[round];
      if (id && !seen.has(id)) {
        merged.push(id);
        seen.add(id);
        added = true;
        if (merged.length >= max) break;
      }
    }
    if (!added) break;
  }

  return merged.slice(0, max);
}

/**
 * @returns {Promise<Array<{ path: string, name: string, photoCount: number, subfolderCount: number, previewIds: string[] }>>}
 */
async function listFolders() {
  const { PHOTOS_DIR } = require("../config");
  const results = [];

  async function walk(currentAbs, currentRel) {
    let entries;
    try {
      entries = await fs.readdir(currentAbs, { withFileTypes: true });
    } catch (err) {
      if (err.code === "ENOENT" && currentRel === "") return [];
      if (err.code === "ENOENT") {
        const error = new Error("Folder not found.");
        error.code = "not_found";
        throw error;
      }
      throw err;
    }

    let photos = 0;
    let subfolders = 0;
    const directPhotoIds = [];

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (entry.isDirectory()) {
        subfolders += 1;
      } else if (entry.isFile()) {
        photos += 1;
        if (isAllowedExtension(entry.name)) {
          const fileRel = currentRel ? `${currentRel}/${entry.name}` : entry.name;
          directPhotoIds.push(encodePhotoId(fileRel));
        }
      }
    }

    directPhotoIds.sort((a, b) => a.localeCompare(b, "en"));
    const directPreviews = pickEvenlySpaced(directPhotoIds, PREVIEW_MAX);

    const childPreviewLists = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const childRel = currentRel ? `${currentRel}/${entry.name}` : entry.name;
      const childPreviews = await walk(path.join(currentAbs, entry.name), childRel);
      if (childPreviews.length) childPreviewLists.push(childPreviews);
    }

    const previewIds = mergePreviewIds(directPreviews, childPreviewLists, PREVIEW_MAX);

    if (currentRel !== "") {
      results.push({
        path: currentRel,
        name: path.basename(currentRel),
        photoCount: photos,
        subfolderCount: subfolders,
        previewIds
      });
    }

    return previewIds;
  }

  await walk(PHOTOS_DIR, "");
  results.sort((a, b) => a.path.localeCompare(b.path, "it"));
  return results;
}

async function createFolder(folderPath) {
  const relative = normalizeFolderPath(folderPath);
  if (!relative) {
    const err = new Error("Cannot create root folder.");
    err.code = "invalid_folder";
    throw err;
  }

  const absolute = resolveFolderPath(relative);
  if (await pathExists(absolute)) {
    const err = new Error("Folder already exists.");
    err.code = "folder_exists";
    throw err;
  }

  await fs.mkdir(absolute, { recursive: true });
  return { path: relative, name: path.basename(relative) };
}

async function renameOrMoveFolder(fromPath, toPath) {
  const fromRel = normalizeFolderPath(fromPath);
  const toRel = normalizeFolderPath(toPath);

  if (!fromRel) {
    const err = new Error("Cannot rename root folder.");
    err.code = "invalid_folder";
    throw err;
  }
  if (!toRel) {
    const err = new Error("Invalid destination folder.");
    err.code = "invalid_folder";
    throw err;
  }

  const fromAbs = resolveFolderPath(fromRel);
  const toAbs = resolveFolderPath(toRel);

  if (!(await pathExists(fromAbs))) {
    const err = new Error("Source folder not found.");
    err.code = "not_found";
    throw err;
  }
  if (toAbs === fromAbs || toAbs.startsWith(fromAbs + path.sep)) {
    const err = new Error("Cannot move folder into itself.");
    err.code = "invalid_move";
    throw err;
  }
  if (await pathExists(toAbs)) {
    const err = new Error("Destination folder already exists.");
    err.code = "folder_exists";
    throw err;
  }

  await fs.mkdir(path.dirname(toAbs), { recursive: true });
  await fs.rename(fromAbs, toAbs);

  const { renameFolderPrefix: renameCovers } = require("./albumCovers");
  const { renameFolderPrefix: renameMeta } = require("./photoMeta");
  await renameCovers(fromRel, toRel);
  await renameMeta(fromRel, toRel);

  return { from: fromRel, to: toRel, name: path.basename(toRel) };
}

async function deleteFolder(folderPath, confirmPath) {
  const relative = normalizeFolderPath(folderPath);
  if (!relative) {
    const err = new Error("Cannot delete root photos directory.");
    err.code = "invalid_folder";
    throw err;
  }

  assertTypedConfirmation(confirmPath, relative);

  const absolute = resolveFolderPath(relative);
  if (!(await pathExists(absolute))) {
    const err = new Error("Folder not found.");
    err.code = "not_found";
    throw err;
  }

  const contents = await countFolderContents(absolute);

  if (FOLDER_DELETE_MODE === "strict" && contents.total > 0) {
    const err = new Error("Folder is not empty.");
    err.code = "folder_not_empty";
    err.details = contents;
    throw err;
  }

  await deleteFolderThumbnails(relative);

  const { removeFolderPrefix: removeCovers } = require("./albumCovers");
  const { removeFolderPrefix: removeMeta } = require("./photoMeta");
  await removeCovers(relative);
  await removeMeta(relative);

  const { trashFolder } = require("./trashStore");
  const item = await trashFolder(relative);
  return { path: relative, trashed: true, trashId: item.id };
}

async function deleteFolderThumbnails(folderRel) {
  const { deleteThumbnail } = require("./thumbnails");
  const { isAllowedExtension } = require("../paths");
  const absolute = resolveFolderPath(folderRel);

  async function walk(dir, rel) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      const childAbs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(childAbs, childRel);
      } else if (entry.isFile() && isAllowedExtension(entry.name)) {
        await deleteThumbnail(childRel);
      }
    }
  }

  await walk(absolute, folderRel);
}

async function deleteFolderToTrash(folderPath, confirmPath) {
  return deleteFolder(folderPath, confirmPath);
}

module.exports = {
  listFolders,
  createFolder,
  renameOrMoveFolder,
  deleteFolder,
  deleteFolderToTrash,
  countFolderContents
};
