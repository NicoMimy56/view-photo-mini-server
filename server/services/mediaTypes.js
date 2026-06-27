const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "m4v", "webm", "avi", "mkv"]);

function extensionOf(filename) {
  const dot = String(filename || "").lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot + 1).toLowerCase();
}

function isVideoExtension(ext) {
  return VIDEO_EXTENSIONS.has(String(ext || "").toLowerCase());
}

function isVideoFile(filename) {
  return isVideoExtension(extensionOf(filename));
}

module.exports = {
  VIDEO_EXTENSIONS,
  extensionOf,
  isVideoExtension,
  isVideoFile
};
