const {
  listFolders,
  createFolder,
  renameOrMoveFolder,
  deleteFolder
} = require("../services/folderStore");
const { normalizeFolderPath } = require("../paths");

function handleStoreError(res, err) {
  if (err.code === "folder_not_empty") {
    return res.status(409).json({
      error: err.code,
      message: "Elimina prima tutte le foto e le sottocartelle.",
      photos: err.details?.photos ?? 0,
      subfolders: err.details?.subfolders ?? 0
    });
  }
  if (err.code === "confirmation_mismatch") {
    return res.status(400).json({ error: err.code, message: "Conferma digitata non corretta." });
  }
  if (err.code === "folder_exists") {
    return res.status(409).json({ error: err.code, message: err.message });
  }
  if (err.code === "not_found") {
    return res.status(404).json({ error: err.code, message: err.message });
  }
  if (err.code === "invalid_folder" || err.code === "invalid_move") {
    return res.status(400).json({
      error: err.code,
      message: err.message || "Percorso cartella non valido."
    });
  }
  console.error(err);
  return res.status(500).json({ error: "internal_error", message: "Unexpected server error." });
}

function registerFolderRoutes(app) {
  app.get("/api/folders", async (_req, res) => {
    try {
      const folders = await listFolders();
      const { getAllCovers } = require("../services/albumCovers");
      const covers = await getAllCovers();
      res.json({ folders, covers });
    } catch (err) {
      handleStoreError(res, err);
    }
  });

  app.post("/api/folders", async (req, res) => {
    try {
      const { path: folderPath } = req.body || {};
      const folder = await createFolder(folderPath);
      res.status(201).json({ folder });
    } catch (err) {
      handleStoreError(res, err);
    }
  });

  app.patch("/api/folders", async (req, res) => {
    try {
      const { from, to } = req.body || {};
      const folder = await renameOrMoveFolder(from, to);
      res.json({ folder });
    } catch (err) {
      handleStoreError(res, err);
    }
  });

  app.delete("/api/folders", async (req, res) => {
    try {
      const folderPath = req.query.path || "";
      const { confirmPath } = req.body || {};
      const result = await deleteFolder(folderPath, confirmPath);
      res.json({ ok: true, ...result });
    } catch (err) {
      handleStoreError(res, err);
    }
  });

  app.get("/api/folders/inspect", async (req, res) => {
    try {
      const folderPath = normalizeFolderPath(req.query.path || "");
      const { countFolderContents } = require("../services/folderStore");
      const { resolveFolderPath } = require("../paths");
      const absolute = resolveFolderPath(folderPath);
      const contents = await countFolderContents(absolute);
      res.json({ path: folderPath, ...contents, canDelete: contents.total === 0 });
    } catch (err) {
      handleStoreError(res, err);
    }
  });

  app.get("/api/folders/covers", async (_req, res) => {
    try {
      const { getAllCovers } = require("../services/albumCovers");
      const covers = await getAllCovers();
      res.json({ covers });
    } catch (err) {
      handleStoreError(res, err);
    }
  });

  app.put("/api/folders/cover", async (req, res) => {
    try {
      const { folder, photoId } = req.body || {};
      const { setCover } = require("../services/albumCovers");
      const result = await setCover(normalizeFolderPath(folder || ""), photoId || null);
      res.json({ ok: true, ...result });
    } catch (err) {
      handleStoreError(res, err);
    }
  });
}

module.exports = { registerFolderRoutes };
