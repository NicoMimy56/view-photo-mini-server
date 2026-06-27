const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const { createApp } = require("./server/createApp");
const { PORT, PHOTOS_DIR, THUMBNAILS_DIR, TRASH_DIR, DATA_DIR } = require("./server/config");
const { startTrashScheduler } = require("./server/trashScheduler");
const { reconcileManifest } = require("./server/services/trashStore");
const fs = require("fs");

for (const dir of [PHOTOS_DIR, THUMBNAILS_DIR, TRASH_DIR, DATA_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function start() {
  try {
    const { removed, remaining } = await reconcileManifest();
    if (removed > 0) {
      console.log(`Trash: removed ${removed} orphan entries (${remaining} remaining).`);
    }
  } catch (err) {
    console.error("Trash reconcile failed:", err.message);
  }

  const app = createApp();

  app.listen(PORT, () => {
    console.log(`ViewPhoto server running on http://localhost:${PORT}`);
    console.log(`Photos:     ${PHOTOS_DIR}`);
    console.log(`Thumbnails: ${THUMBNAILS_DIR}`);
    console.log(`Trash:      ${TRASH_DIR}`);
    console.log(`Data:       ${DATA_DIR}`);
    startTrashScheduler();
  });
}

start();
