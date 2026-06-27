const fs = require("fs/promises");
const { PHOTOS_DIR, THUMBNAILS_DIR, TRASH_DIR, DATA_DIR } = require("../config");
const packageJson = require("../../package.json");

async function pathOk(dir) {
  try {
    await fs.access(dir);
    return true;
  } catch {
    return false;
  }
}

function registerHealthRoutes(app) {
  app.get("/api/health", async (_req, res) => {
    const checks = {
      photos: await pathOk(PHOTOS_DIR),
      thumbnails: await pathOk(THUMBNAILS_DIR),
      trash: await pathOk(TRASH_DIR),
      data: await pathOk(DATA_DIR)
    };
    const ok = Object.values(checks).every(Boolean);

    res.status(ok ? 200 : 503).json({
      ok,
      service: "viewphoto",
      version: packageJson.version,
      checks
    });
  });
}

module.exports = { registerHealthRoutes };
