const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { MAX_UPLOAD_BYTES, MAX_UPLOAD_FILES, ALLOWED_EXTENSIONS, PHOTOS_DIR } = require("../config");
const { isAllowedExtension } = require("../paths");

// Temp sullo stesso volume di Photos (SanDisk mount).
// Evita EXDEV: rename tra filesystem del container e volume esterno fallisce.
const UPLOAD_TEMP_DIR = path.join(PHOTOS_DIR, ".upload-temp");

if (!fs.existsSync(UPLOAD_TEMP_DIR)) {
  fs.mkdirSync(UPLOAD_TEMP_DIR, { recursive: true });
}

function createUploadMiddleware() {
  const storage = multer.diskStorage({
    destination(_req, _file, cb) {
      try {
        fs.mkdirSync(UPLOAD_TEMP_DIR, { recursive: true });
        cb(null, UPLOAD_TEMP_DIR);
      } catch (err) {
        cb(err);
      }
    },
    filename(_req, file, cb) {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${path.basename(file.originalname).replace(/[/\\]/g, "_")}`;
      cb(null, unique);
    }
  });

  function fileFilter(_req, file, cb) {
    if (!isAllowedExtension(file.originalname)) {
      const ext = path.extname(file.originalname).slice(1).toLowerCase() || "sconosciuto";
      return cb(
        new Error(`Tipo file non consentito (.${ext}). Consentiti: ${ALLOWED_EXTENSIONS.join(", ")}`)
      );
    }
    cb(null, true);
  }

  return multer({
    storage,
    limits: { fileSize: MAX_UPLOAD_BYTES, files: MAX_UPLOAD_FILES },
    fileFilter
  });
}

module.exports = { createUploadMiddleware, UPLOAD_TEMP_DIR };
