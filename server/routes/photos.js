const fs = require("fs/promises");
const path = require("path");
const {
  listPhotos,
  searchPhotos,
  getPhotoAbsolutePath,
  movePhoto,
  movePhotosBatch,
  renamePhoto,
  deletePhoto,
  deletePhotosBatch
} = require("../services/photoStore");
const { getOrCreateThumbnail, getPreviewStream } = require("../services/thumbnails");
const { isVideoExtension } = require("../services/mediaTypes");
const { decodePhotoId, toRelativePath } = require("../paths");

const VIDEO_THUMB_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="#1a1a21"/><circle cx="200" cy="200" r="56" fill="none" stroke="#818cf8" stroke-width="8"/><path d="M188 170l52 30-52 30V170z" fill="#818cf8"/></svg>`;

function getVideoMime(extension) {
  const map = {
    mp4: "video/mp4",
    mov: "video/quicktime",
    m4v: "video/mp4",
    webm: "video/webm",
    avi: "video/x-msvideo",
    mkv: "video/x-matroska"
  };
  return map[extension] || "video/mp4";
}

function handleStoreError(res, err) {
  if (err.code === "confirmation_mismatch") {
    return res.status(400).json({ error: err.code, message: "Incorrect confirmation text." });
  }
  if (err.code === "not_found") {
    return res.status(404).json({ error: err.code, message: err.message });
  }
  if (err.code === "file_exists") {
    return res.status(409).json({ error: err.code, message: err.message });
  }
  if (err.code === "invalid_request" || err.code === "too_many") {
    return res.status(400).json({ error: err.code, message: err.message });
  }
  if (err.code === "EACCES" || err.code === "EPERM") {
    console.error(err);
    return res.status(500).json({
      error: "internal_error",
      message: "Disk permission denied. Check Photos and trash folders on the host."
    });
  }
  console.error(err);
  return res.status(500).json({
    error: "internal_error",
    message: err.message || "Unexpected server error."
  });
}

function registerPhotoRoutes(app) {
  app.get("/api/photos/search", async (req, res) => {
    try {
      const q = req.query.q || "";
      const folder = req.query.folder || "";
      const sort = req.query.sort || "modified";
      const order = req.query.order || "desc";
      const photos = await searchPhotos(q, { folder, sort, order });
      res.json({ photos, query: q, folder, sort, order });
    } catch (err) {
      handleStoreError(res, err);
    }
  });

  app.get("/api/photos", async (req, res) => {
    try {
      const folder = req.query.folder || "";
      const sort = req.query.sort || "modified";
      const order = req.query.order || "desc";
      const photos = await listPhotos(folder, { sort, order });
      res.json({ photos, folder, sort, order });
    } catch (err) {
      handleStoreError(res, err);
    }
  });

  app.get("/api/photos/:id", async (req, res) => {
    try {
      const absolute = await getPhotoAbsolutePath(req.params.id);
      const relative = decodePhotoId(req.params.id);
      const extension = path.extname(relative).slice(1).toLowerCase();

      if (isVideoExtension(extension)) {
        res.type(getVideoMime(extension));
        return res.sendFile(absolute);
      }

      const preview = await getPreviewStream(absolute, relative, extension);

      if (preview.kind === "preview") {
        res.type("image/jpeg");
        return res.sendFile(preview.path);
      }

      return res.sendFile(absolute);
    } catch (err) {
      handleStoreError(res, err);
    }
  });

  app.get("/api/photos/:id/download", async (req, res) => {
    try {
      const absolute = await getPhotoAbsolutePath(req.params.id);
      const fileName = path.basename(absolute);
      res.download(absolute, fileName);
    } catch (err) {
      handleStoreError(res, err);
    }
  });

  app.post("/api/photos/download-zip", async (req, res) => {
    try {
      const { ids } = req.body || {};
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "invalid_request", message: "No photos selected." });
      }
      if (ids.length > 100) {
        return res.status(400).json({ error: "too_many", message: "Maximum 100 photos per download." });
      }

      const archiver = require("archiver");
      const archive = archiver("zip", { zlib: { level: 6 } });

      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="viewphoto-${new Date().toISOString().slice(0, 10)}.zip"`
      );

      archive.on("error", (err) => {
        console.error("ZIP archive error:", err);
        if (!res.headersSent) {
          handleStoreError(res, err);
        } else {
          res.end();
        }
      });

      archive.pipe(res);

      const usedNames = new Set();
      for (const id of ids) {
        const absolute = await getPhotoAbsolutePath(id);
        const relative = decodePhotoId(id);
        let entryName = relative.split(path.sep).join(" - ");

        if (usedNames.has(entryName)) {
          const ext = path.extname(entryName);
          const base = path.basename(entryName, ext);
          let counter = 2;
          while (usedNames.has(`${base} (${counter})${ext}`)) counter += 1;
          entryName = `${base} (${counter})${ext}`;
        }
        usedNames.add(entryName);

        archive.file(absolute, { name: entryName });
      }

      await archive.finalize();
    } catch (err) {
      if (!res.headersSent) {
        handleStoreError(res, err);
      }
    }
  });

  app.post("/api/photos/move-batch", async (req, res) => {
    try {
      const { ids, folder } = req.body || {};
      const result = await movePhotosBatch(ids, folder || "");
      res.json({ ok: true, ...result });
    } catch (err) {
      handleStoreError(res, err);
    }
  });

  app.post("/api/photos/delete-batch", async (req, res) => {
    try {
      const { ids, confirmPhrase } = req.body || {};
      const result = await deletePhotosBatch(ids, confirmPhrase);
      res.json({ ok: true, ...result });
    } catch (err) {
      handleStoreError(res, err);
    }
  });

  app.get("/api/photos/:id/thumb", async (req, res) => {
    try {
      const absolute = await getPhotoAbsolutePath(req.params.id);
      const relative = decodePhotoId(req.params.id);
      const extension = path.extname(relative).slice(1).toLowerCase();

      if (isVideoExtension(extension)) {
        res.type("image/svg+xml");
        return res.send(VIDEO_THUMB_SVG);
      }

      const thumb = await getOrCreateThumbnail(absolute, relative);
      if (!thumb) {
        return res.status(404).json({ error: "not_found", message: "Thumbnail not available." });
      }
      const buffer = await fs.readFile(thumb);
      res.type("image/jpeg");
      return res.send(buffer);
    } catch (err) {
      handleStoreError(res, err);
    }
  });

  app.patch("/api/photos/:id", async (req, res) => {
    try {
      const { folder, name, confirmName } = req.body || {};
      if (name != null) {
        const photo = await renamePhoto(req.params.id, name, confirmName);
        return res.json({ photo });
      }
      const photo = await movePhoto(req.params.id, folder || "");
      res.json({ photo });
    } catch (err) {
      handleStoreError(res, err);
    }
  });

  app.delete("/api/photos/:id", async (req, res) => {
    try {
      const { confirmName } = req.body || {};
      const result = await deletePhoto(req.params.id, confirmName);
      res.json(result);
    } catch (err) {
      handleStoreError(res, err);
    }
  });
}

module.exports = { registerPhotoRoutes };
