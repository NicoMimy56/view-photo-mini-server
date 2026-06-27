const VIDEO_EXT = /\.(mp4|mov|m4v|webm|avi|mkv)$/i;

export function isVideoItem(item) {
  if (!item) return false;
  if (item.kind === "video") return true;
  return VIDEO_EXT.test(item.name || "");
}

export function isUploadableFile(file) {
  return file.type.startsWith("image/") || file.type.startsWith("video/");
}
