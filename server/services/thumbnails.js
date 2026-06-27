const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");
const { THUMBNAILS_DIR, THUMB_MAX_PX } = require("../config");

const { isVideoExtension } = require("./mediaTypes");

const HEIC_EXTENSIONS = new Set(["heic", "heif"]);

function thumbPathFor(relativePhotoPath) {
  const safeName = relativePhotoPath.replace(/[/\\]/g, "__") + ".jpg";
  return path.join(THUMBNAILS_DIR, safeName);
}

async function ensureThumbnailsDir() {
  await fs.mkdir(THUMBNAILS_DIR, { recursive: true });
}

/**
 * Returns true if the browser can display the original without conversion.
 * @param {string} extension lowercase without dot
 */
function isBrowserNative(extension) {
  return !HEIC_EXTENSIONS.has(extension);
}

async function generateThumbnail(sourceAbsolute, relativePhotoPath) {
  await ensureThumbnailsDir();
  const output = thumbPathFor(relativePhotoPath);

  await sharp(sourceAbsolute)
    .rotate()
    .resize({
      width: THUMB_MAX_PX,
      height: THUMB_MAX_PX,
      fit: "inside",
      withoutEnlargement: true
    })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(output);

  return output;
}

async function getOrCreateThumbnail(sourceAbsolute, relativePhotoPath) {
  const extension = path.extname(relativePhotoPath).slice(1).toLowerCase();
  if (isVideoExtension(extension)) {
    return null;
  }

  await ensureThumbnailsDir();
  const output = thumbPathFor(relativePhotoPath);

  try {
    const stat = await fs.stat(output);
    const sourceStat = await fs.stat(sourceAbsolute);
    if (stat.mtimeMs >= sourceStat.mtimeMs) {
      return output;
    }
  } catch {
    // regenerate below
  }

  return generateThumbnail(sourceAbsolute, relativePhotoPath);
}

async function getPreviewStream(sourceAbsolute, relativePhotoPath, extension) {
  if (isVideoExtension(extension)) {
    return { kind: "file", path: sourceAbsolute };
  }

  if (isBrowserNative(extension)) {
    return { kind: "file", path: sourceAbsolute };
  }

  const previewPath = await getOrCreateThumbnail(sourceAbsolute, relativePhotoPath);
  return { kind: "preview", path: previewPath };
}

async function deleteThumbnail(relativePhotoPath) {
  const output = thumbPathFor(relativePhotoPath);
  try {
    await fs.unlink(output);
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
}

module.exports = {
  isBrowserNative,
  getOrCreateThumbnail,
  getPreviewStream,
  deleteThumbnail,
  generateThumbnail
};
