const path = require("path");
const { PHOTOS_DIR } = require("./config");

/**
 * Normalize a relative folder path from the client.
 * Returns "" for root album. Throws on invalid paths.
 * @param {string} raw
 * @returns {string}
 */
function normalizeFolderPath(raw) {
  if (raw == null || raw === "" || raw === "/") return "";

  let normalized = String(raw).replace(/\\/g, "/").trim();
  normalized = normalized.replace(/^\/+|\/+$/g, "");

  if (!normalized) return "";

  const segments = normalized.split("/");
  for (const segment of segments) {
    if (segment === ".." || segment === ".") {
      const err = new Error("Invalid folder path.");
      err.code = "invalid_folder";
      throw err;
    }
    if (!segment.length) {
      const err = new Error("Invalid folder path.");
      err.code = "invalid_folder";
      throw err;
    }
  }

  return segments.join("/");
}

/**
 * @param {string} folderPath relative path under PHOTOS_DIR
 * @returns {string} absolute path
 */
function resolveFolderPath(folderPath) {
  const relative = normalizeFolderPath(folderPath);
  const absolute = relative
    ? path.join(PHOTOS_DIR, ...relative.split("/"))
    : PHOTOS_DIR;

  const resolved = path.resolve(absolute);
  const photosRoot = path.resolve(PHOTOS_DIR);

  if (resolved !== photosRoot && !resolved.startsWith(photosRoot + path.sep)) {
    const err = new Error("Invalid folder path.");
    err.code = "invalid_folder";
    throw err;
  }

  return resolved;
}

/**
 * @param {string} absolutePath
 * @returns {string} relative path from PHOTOS_DIR
 */
function toRelativePath(absolutePath) {
  const photosRoot = path.resolve(PHOTOS_DIR);
  const resolved = path.resolve(absolutePath);

  if (resolved === photosRoot) return "";

  if (!resolved.startsWith(photosRoot + path.sep)) {
    throw new Error("Path escapes photos directory.");
  }

  return path.relative(photosRoot, resolved).split(path.sep).join("/");
}

/**
 * @param {string} relativePath path under PHOTOS_DIR
 * @returns {string} URL-safe id
 */
function encodePhotoId(relativePath) {
  return Buffer.from(relativePath, "utf8").toString("base64url");
}

/**
 * @param {string} id
 * @returns {string} relative path under PHOTOS_DIR
 */
function decodePhotoId(id) {
  const relative = Buffer.from(id, "base64url").toString("utf8");
  resolveFolderPath(path.dirname(relative) === "." ? "" : path.dirname(relative));
  return relative;
}

/**
 * @param {string} filename
 * @returns {boolean}
 */
function isAllowedExtension(filename) {
  const ext = path.extname(filename).slice(1).toLowerCase();
  const { ALLOWED_EXTENSIONS } = require("./config");
  return ALLOWED_EXTENSIONS.includes(ext);
}

/**
 * @param {string} confirmValue user-typed confirmation
 * @param {string} expected exact value required
 * @param {{ caseInsensitive?: boolean }} [options]
 */
function assertTypedConfirmation(confirmValue, expected, { caseInsensitive = false } = {}) {
  const { REQUIRE_TYPED_CONFIRMATION } = require("./config");
  if (!REQUIRE_TYPED_CONFIRMATION) return;

  const typed = String(confirmValue || "").trim();
  const matches = caseInsensitive
    ? typed.localeCompare(expected, undefined, { sensitivity: "accent" }) === 0
    : typed === expected;

  if (!matches) {
    const err = new Error("Typed confirmation does not match.");
    err.code = "confirmation_mismatch";
    throw err;
  }
}

function normalizeBatchPhrase(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function assertBatchDeleteConfirmation(confirmValue, expected) {
  const { REQUIRE_TYPED_CONFIRMATION } = require("./config");
  if (!REQUIRE_TYPED_CONFIRMATION) return;

  if (normalizeBatchPhrase(confirmValue) !== normalizeBatchPhrase(expected)) {
    const err = new Error("Typed confirmation does not match.");
    err.code = "confirmation_mismatch";
    throw err;
  }
}

module.exports = {
  normalizeFolderPath,
  resolveFolderPath,
  toRelativePath,
  encodePhotoId,
  decodePhotoId,
  isAllowedExtension,
  assertTypedConfirmation,
  assertBatchDeleteConfirmation
};
