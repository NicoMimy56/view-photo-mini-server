const {
  listTrash,
  restoreItem,
  permanentlyDeleteItem,
  getPurgeNotification,
  confirmPurge,
  postponePurge,
  emptyAllTrash,
  markPendingPurge
} = require("../services/trashStore");

function handleTrashError(res, err) {
  if (err.code === "confirmation_mismatch") {
    return res.status(400).json({ error: err.code, message: "Incorrect confirmation text." });
  }
  if (err.code === "not_found") {
    return res.status(404).json({ error: err.code, message: err.message });
  }
  if (err.code === "file_exists") {
    return res.status(409).json({ error: err.code, message: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: "internal_error", message: "Unexpected server error." });
}

function registerTrashRoutes(app) {
  app.get("/api/trash", async (_req, res) => {
    try {
      await markPendingPurge();
      const items = await listTrash();
      const notification = await getPurgeNotification();
      res.json({ items, notification });
    } catch (err) {
      handleTrashError(res, err);
    }
  });

  app.get("/api/trash/notification", async (_req, res) => {
    try {
      await markPendingPurge();
      const notification = await getPurgeNotification();
      res.json({ notification });
    } catch (err) {
      handleTrashError(res, err);
    }
  });

  app.post("/api/trash/restore", async (req, res) => {
    try {
      const { id } = req.body || {};
      const result = await restoreItem(id);
      res.json({ ok: true, ...result });
    } catch (err) {
      handleTrashError(res, err);
    }
  });

  app.post("/api/trash/confirm-purge", async (req, res) => {
    try {
      const { confirmPhrase } = req.body || {};
      const result = await confirmPurge(confirmPhrase);
      res.json({ ok: true, ...result });
    } catch (err) {
      handleTrashError(res, err);
    }
  });

  app.post("/api/trash/postpone", async (_req, res) => {
    try {
      const result = await postponePurge();
      res.json({ ok: true, ...result });
    } catch (err) {
      handleTrashError(res, err);
    }
  });

  app.post("/api/trash/empty", async (req, res) => {
    try {
      const { confirmPhrase } = req.body || {};
      const result = await emptyAllTrash(confirmPhrase);
      res.json({ ok: true, ...result });
    } catch (err) {
      handleTrashError(res, err);
    }
  });

  app.delete("/api/trash/:id", async (req, res) => {
    try {
      const { confirmName } = req.body || {};
      const items = await listTrash();
      const item = items.find((entry) => entry.id === req.params.id);
      if (!item) {
        return res.status(404).json({ error: "not_found", message: "Item not found in trash." });
      }
      const { assertTypedConfirmation } = require("../paths");
      assertTypedConfirmation(confirmName, item.name);
      const result = await permanentlyDeleteItem(req.params.id);
      res.json({ ok: true, ...result });
    } catch (err) {
      handleTrashError(res, err);
    }
  });
}

module.exports = { registerTrashRoutes };
