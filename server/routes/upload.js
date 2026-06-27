const path = require("path");
const fs = require("fs/promises");
const { MAX_UPLOAD_FILES } = require("../config");
const { createUploadMiddleware } = require("../middleware/uploadLimits");
const { toRelativePath, resolveFolderPath } = require("../paths");
const { getOrCreateThumbnail } = require("../services/thumbnails");
const { buildPhotoRecord } = require("../services/photoStore");
const { extractTakenAt } = require("../services/photoMeta");

const upload = createUploadMiddleware();

async function resolveUniqueName(dir, baseName) {
  const ext = path.extname(baseName);
  const stem = path.basename(baseName, ext);
  let candidate = baseName;
  let counter = 2;

  while (true) {
    try {
      await fs.access(path.join(dir, candidate));
      candidate = `${stem} (${counter})${ext}`;
      counter += 1;
    } catch (err) {
      if (err.code === "ENOENT") return candidate;
      throw err;
    }
  }
}

async function moveUploadFile(from, to) {
  try {
    await fs.rename(from, to);
  } catch (err) {
    if (err.code !== "EXDEV") throw err;
    await fs.copyFile(from, to);
    await fs.unlink(from);
  }
}

async function processUploadedFiles(req) {
  const files = req.files || [];
  const duplicatePolicy = req.query.duplicate || "rename";
  const destDir = resolveFolderPath(req.query.folder || "");
  const uploaded = [];
  const skipped = [];
  const conflicts = [];

  for (const file of files) {
    const originalName = path.basename(file.originalname).replace(/[/\\]/g, "_");
    const targetPath = path.join(destDir, originalName);
    let exists = false;

    try {
      await fs.access(targetPath);
      exists = true;
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }

    if (exists) {
      if (duplicatePolicy === "skip") {
        await fs.unlink(file.path);
        skipped.push({ name: originalName, reason: "duplicate" });
        continue;
      }
      if (duplicatePolicy === "ask") {
        await fs.unlink(file.path);
        conflicts.push({ name: originalName });
        continue;
      }
      if (duplicatePolicy === "replace") {
        await fs.unlink(targetPath);
      }
    }

    let finalPath = targetPath;
    if (exists && duplicatePolicy === "rename") {
      const uniqueName = await resolveUniqueName(destDir, originalName);
      finalPath = path.join(destDir, uniqueName);
    }

    await fs.mkdir(destDir, { recursive: true });
    await moveUploadFile(file.path, finalPath);

    const relative = toRelativePath(finalPath);
    const extension = path.extname(relative).slice(1).toLowerCase();
    const { isVideoExtension } = require("../services/mediaTypes");

    if (!isVideoExtension(extension)) {
      try {
        await getOrCreateThumbnail(finalPath, relative);
        await extractTakenAt(finalPath);
      } catch (thumbErr) {
        console.error("Thumbnail generation failed:", relative, thumbErr.message);
      }
    }

    uploaded.push(await buildPhotoRecord(finalPath, relative));
  }

  if (conflicts.length) {
    return {
      status: 409,
      body: {
        error: "duplicate_conflict",
        message: "Alcuni file esistono già in questo album.",
        conflicts: conflicts.map((item) => item.name),
        uploaded,
        skipped
      }
    };
  }

  return {
    status: 201,
    body: { uploaded, skipped, count: uploaded.length }
  };
}

function registerUploadRoutes(app) {
  app.post("/api/upload", (req, res) => {
    upload.array("photos", MAX_UPLOAD_FILES)(req, res, async (err) => {
      if (err) {
        const message =
          err.code === "LIMIT_FILE_SIZE"
            ? "File troppo grande."
            : err.code === "LIMIT_UNEXPECTED_FILE"
              ? `Troppi file in un solo caricamento (max ${MAX_UPLOAD_FILES}).`
              : err.message || "Upload fallito.";
        return res.status(400).json({ error: "upload_failed", message });
      }

      try {
        const result = await processUploadedFiles(req);
        return res.status(result.status).json(result.body);
      } catch (uploadErr) {
        console.error(uploadErr);
        res.status(500).json({
          error: "upload_failed",
          message: uploadErr.message || "Errore durante il caricamento."
        });
      }
    });
  });

  app.post("/api/upload/share", (req, res) => {
    req.query = { ...(req.query || {}), duplicate: req.query.duplicate || "rename" };
    upload.array("photos", MAX_UPLOAD_FILES)(req, res, async (err) => {
      if (err) {
        const message =
          err.code === "LIMIT_UNEXPECTED_FILE"
            ? `Troppi file in un solo caricamento (max ${MAX_UPLOAD_FILES}).`
            : err.message || "Upload fallito.";
        return res.redirect(303, `/?share_error=${encodeURIComponent(message)}`);
      }
      try {
        const result = await processUploadedFiles(req);
        if (result.status === 409) {
          return res.redirect(303, "/?share_error=duplicate");
        }
        const count = result.body.count || 0;
        return res.redirect(303, `/?uploaded=${count}`);
      } catch (uploadErr) {
        console.error(uploadErr);
        return res.redirect(
          303,
          `/?share_error=${encodeURIComponent(uploadErr.message || "Upload fallito.")}`
        );
      }
    });
  });
}

module.exports = { registerUploadRoutes };
