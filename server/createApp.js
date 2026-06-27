const express = require("express");
const path = require("path");
const { PUBLIC_DIR } = require("./config");
const { registerApiRoutes } = require("./routes");

function createApp() {
  const app = express();

  app.use(express.json());
  app.use(express.static(PUBLIC_DIR));

  registerApiRoutes(app);

  app.use((_req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "index.html"));
  });

  return app;
}

module.exports = { createApp };
