const fs = require("fs/promises");
const path = require("path");
const {
  resolveFolderPath,
  toRelativePath,
  decodePhotoId,
  encodePhotoId,
  isAllowedExtension,
  assertTypedConfirmation,
  assertBatchDeleteConfirmation,
  normalizeFolderPath
} = require("../paths");
const { deleteThumbnail } = require("./thumbnails");
const { getTakenAt, updatePath, removePath } = require("./photoMeta");
const { isVideoFile } = require("./mediaTypes");
const { trashPhoto, trashFolder } = require("./trashStore");

function sortPhotos(photos, sortBy, order) {
  const dir = order === "asc" ? 1 : -1;
  const key = sortBy || "modified";

  photos.sort((a, b) => {
    let av;
    let bv;
    switch (key) {
      case "name":
        av = a.name.toLowerCase();
        bv = b.name.toLowerCase();
        return av.localeCompare(bv, "it") * dir;
      case "size":
        return (a.size - b.size) * dir;
      case "taken":
        av = a.takenAt || a.modifiedAt;
        bv = b.takenAt || b.modifiedAt;
        break;
      case "modified":
      default:
        av = a.modifiedAt;
        bv = b.modifiedAt;
        break;
    }
    return av.localeCompare(bv) * dir;
  });

  return photos;
}

async function buildPhotoRecord(absolute, relative) {
  const stat = await fs.stat(absolute);
  const extension = path.extname(relative).slice(1).toLowerCase();
  const isVideo = isVideoFile(relative);

  let takenAt = stat.mtime.toISOString();
  try {
    takenAt = (await getTakenAt(relative, absolute)) || takenAt;
  } catch (err) {
    console.error("Metadata read failed:", relative, err.message);
  }

  return {
    id: encodePhotoId(relative),
    name: path.basename(relative),
    folder: path.dirname(relative) === "." ? "" : path.dirname(relative).split(path.sep).join("/"),
    size: stat.size,
    createdAt: stat.birthtime.toISOString(),
    modifiedAt: stat.mtime.toISOString(),
    takenAt,
    extension,
    kind: isVideo ? "video" : "photo"
  };
}

async function listPhotosRecursive({ sort = "modified", order = "desc" } = {}) {
  const { PHOTOS_DIR } = require("../config");
  const photos = [];

  async function walk(currentAbs, currentRel) {
    let entries;
    try {
      entries = await fs.readdir(currentAbs, { withFileTypes: true });
    } catch (err) {
      if (err.code === "ENOENT") return;
      throw err;
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === ".upload-temp") continue;

      const childAbs = path.join(currentAbs, entry.name);
      const childRel = currentRel ? `${currentRel}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        await walk(childAbs, childRel);
        continue;
      }

      if (!entry.isFile() || !isAllowedExtension(entry.name)) continue;
      photos.push(await buildPhotoRecord(childAbs, childRel));
    }
  }

  await walk(PHOTOS_DIR, "");
  return sortPhotos(photos, sort, order);
}

async function listPhotos(folderPath, { sort = "modified", order = "desc" } = {}) {
  const relativeFolder = normalizeFolderPath(folderPath);

  if (relativeFolder === "") {
    return listPhotosRecursive({ sort, order });
  }

  const absoluteFolder = resolveFolderPath(relativeFolder);
  let entries;

  try {
    entries = await fs.readdir(absoluteFolder, { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT") {
      const error = new Error("Folder not found.");
      error.code = "not_found";
      throw error;
    }
    throw err;
  }

  const photos = [];

  for (const entry of entries) {
    if (!entry.isFile() || entry.name.startsWith(".")) continue;
    if (!isAllowedExtension(entry.name)) continue;

    const absolute = path.join(absoluteFolder, entry.name);
    const relative = toRelativePath(absolute);
    photos.push(await buildPhotoRecord(absolute, relative));
  }

  return sortPhotos(photos, sort, order);
}

async function searchPhotos(query, { folder = "", limit = 200, sort = "modified", order = "desc" } = {}) {
  const { PHOTOS_DIR } = require("../config");
  const term = String(query || "").trim().toLowerCase();
  if (!term) return [];

  const results = [];
  const rootFolder = normalizeFolderPath(folder);

  async function walk(currentAbs, currentRel) {
    if (results.length >= limit) return;

    const entries = await fs.readdir(currentAbs, { withFileTypes: true });
    for (const entry of entries) {
      if (results.length >= limit) return;
      if (entry.name.startsWith(".")) continue;

      const childRel = currentRel ? `${currentRel}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        if (!rootFolder || childRel === rootFolder || childRel.startsWith(`${rootFolder}/`)) {
          await walk(path.join(currentAbs, entry.name), childRel);
        }
        continue;
      }

      if (!entry.isFile() || !isAllowedExtension(entry.name)) continue;
      if (rootFolder && currentRel !== rootFolder && !currentRel.startsWith(`${rootFolder}/`)) continue;

      if (!entry.name.toLowerCase().includes(term) && !childRel.toLowerCase().includes(term)) continue;

      const absolute = path.join(currentAbs, entry.name);
      results.push(await buildPhotoRecord(absolute, childRel));
    }
  }

  await walk(PHOTOS_DIR, "");
  return sortPhotos(results, sort, order);
}

async function getPhotoAbsolutePath(photoId) {
  const relative = decodePhotoId(photoId);
  const absolute = resolveFolderPath(path.dirname(relative) === "." ? "" : path.dirname(relative));
  const fullPath = path.join(absolute, path.basename(relative));

  try {
    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) {
      const err = new Error("Photo not found.");
      err.code = "not_found";
      throw err;
    }
    return fullPath;
  } catch (err) {
    if (err.code === "ENOENT") {
      const error = new Error("Photo not found.");
      error.code = "not_found";
      throw error;
    }
    throw err;
  }
}

async function movePhoto(photoId, targetFolder) {
  const relative = decodePhotoId(photoId);
  const fileName = path.basename(relative);

  const sourceAbs = await getPhotoAbsolutePath(photoId);
  const destFolderAbs = resolveFolderPath(targetFolder);
  const destAbs = path.join(destFolderAbs, fileName);

  if (path.resolve(sourceAbs) === path.resolve(destAbs)) {
    return { id: photoId, folder: normalizeFolderFromRelative(relative) };
  }

  try {
    await fs.access(destAbs);
    const err = new Error("A file with the same name already exists in the destination folder.");
    err.code = "file_exists";
    throw err;
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }

  await fs.mkdir(destFolderAbs, { recursive: true });
  await fs.rename(sourceAbs, destAbs);
  await deleteThumbnail(relative);

  const newRelative = toRelativePath(destAbs);
  await updatePath(relative, newRelative);

  return {
    id: encodePhotoId(newRelative),
    name: fileName,
    folder: normalizeFolderFromRelative(newRelative)
  };
}

async function movePhotosBatch(photoIds, targetFolder) {
  if (!Array.isArray(photoIds) || photoIds.length === 0) {
    const err = new Error("No photos selected.");
    err.code = "invalid_request";
    throw err;
  }
  if (photoIds.length > 100) {
    const err = new Error("Maximum 100 photos per batch move.");
    err.code = "too_many";
    throw err;
  }

  const moved = [];
  for (const photoId of photoIds) {
    moved.push(await movePhoto(photoId, targetFolder || ""));
  }
  return { moved, count: moved.length };
}

async function renamePhoto(photoId, newName, confirmName) {
  const relative = decodePhotoId(photoId);
  const oldName = path.basename(relative);
  assertTypedConfirmation(confirmName, oldName);

  const cleanName = path.basename(String(newName || "").replace(/[/\\]/g, "_"));
  if (!cleanName || !isAllowedExtension(cleanName)) {
    const err = new Error("Invalid file name.");
    err.code = "invalid_request";
    throw err;
  }

  const sourceAbs = await getPhotoAbsolutePath(photoId);
  const destAbs = path.join(path.dirname(sourceAbs), cleanName);

  if (path.resolve(sourceAbs) === path.resolve(destAbs)) {
    return { id: photoId, name: cleanName };
  }

  try {
    await fs.access(destAbs);
    const err = new Error("A file with that name already exists.");
    err.code = "file_exists";
    throw err;
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }

  await fs.rename(sourceAbs, destAbs);
  await deleteThumbnail(relative);

  const newRelative = toRelativePath(destAbs);
  await updatePath(relative, newRelative);

  return {
    id: encodePhotoId(newRelative),
    name: cleanName,
    folder: normalizeFolderFromRelative(newRelative)
  };
}

async function deletePhoto(photoId, confirmName) {
  const relative = decodePhotoId(photoId);
  const fileName = path.basename(relative);
  assertTypedConfirmation(confirmName, fileName, { caseInsensitive: true });

  await getPhotoAbsolutePath(photoId);
  const item = await trashPhoto(relative);
  await removePath(relative);

  return { ok: true, trashed: true, trashId: item.id, name: fileName };
}

async function deletePhotosBatch(photoIds, confirmPhrase) {
  if (!Array.isArray(photoIds) || photoIds.length === 0) {
    const err = new Error("No photos selected.");
    err.code = "invalid_request";
    throw err;
  }
  if (photoIds.length > 100) {
    const err = new Error("Maximum 100 photos per batch delete.");
    err.code = "too_many";
    throw err;
  }

  const expected = `DELETE ${photoIds.length}`;
  assertBatchDeleteConfirmation(confirmPhrase, expected);

  const trashed = [];
  for (const photoId of photoIds) {
    const relative = decodePhotoId(photoId);
    await getPhotoAbsolutePath(photoId);
    const item = await trashPhoto(relative);
    await removePath(relative);
    trashed.push({ id: photoId, trashId: item.id, name: path.basename(relative) });
  }

  return { trashed, count: trashed.length };
}

async function deleteFolderToTrash(folderPath) {
  const relative = normalizeFolderPath(folderPath);
  const item = await trashFolder(relative);
  return { trashed: true, trashId: item.id, path: relative };
}

function normalizeFolderFromRelative(relative) {
  const dir = path.dirname(relative);
  return dir === "." ? "" : dir.split(path.sep).join("/");
}

module.exports = {
  listPhotos,
  searchPhotos,
  getPhotoAbsolutePath,
  movePhoto,
  movePhotosBatch,
  renamePhoto,
  deletePhoto,
  deletePhotosBatch,
  deleteFolderToTrash,
  sortPhotos,
  buildPhotoRecord
};
