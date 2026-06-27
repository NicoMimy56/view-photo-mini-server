const { registerAuthRoutes } = require("./auth");
const { registerHealthRoutes } = require("./health");
const { registerFolderRoutes } = require("./folders");
const { registerPhotoRoutes } = require("./photos");
const { registerUploadRoutes } = require("./upload");
const { registerTrashRoutes } = require("./trash");
const { authGuard } = require("../middleware/authGuard");
const { AUTH_ENABLED } = require("../config");

function registerApiRoutes(app) {
  registerHealthRoutes(app);
  registerAuthRoutes(app);

  if (AUTH_ENABLED) {
    app.use("/api", (req, res, next) => {
      if (req.path === "/health" || req.path.startsWith("/auth/") || req.path === "/upload/share") {
        return next();
      }
      return authGuard(req, res, next);
    });
  }

  registerFolderRoutes(app);
  registerPhotoRoutes(app);
  registerUploadRoutes(app);
  registerTrashRoutes(app);

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "not_found", message: "API route not found." });
  });
}

module.exports = { registerApiRoutes };
